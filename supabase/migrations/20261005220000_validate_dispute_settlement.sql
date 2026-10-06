begin;

create or replace function app_private.admin_resolve_service_dispute(
  p_dispute_id uuid,
  p_resolution_code text,
  p_note text,
  p_refund_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  v_dispute public.service_disputes%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.payment_intents%rowtype;
  v_before jsonb;
  v_tx_id uuid;
  v_protected uuid;
  v_seller_wallet uuid;
  v_platform uuid;
  v_buyer_wallet uuid;
  v_refund bigint := 0;
  v_seller_debit bigint := 0;
  v_platform_debit bigint := 0;
  v_was_released boolean := false;
  v_remaining bigint := 0;
  v_seller_remaining bigint := 0;
  v_saved_refund bigint := 0;
  v_capture_count integer;
  v_release_count integer;
  v_protected_balance bigint;
  v_seller_balance bigint;
  v_platform_balance bigint;
  v_expected_seller bigint;
begin
  if v_admin is null or not app_private.has_admin_permission('disputes.manage') then
    raise exception 'permission_denied';
  end if;
  if p_resolution_code is null or p_resolution_code not in ('release_funds','full_refund','partial_refund','no_action','warning','escalate') then
    raise exception 'invalid_resolution_code';
  end if;
  if char_length(trim(coalesce(p_note, ''))) not between 5 and 2000 then
    raise exception 'resolution_note_required';
  end if;

  -- Match opening/completion lock order: booking first, then the case.
  select * into v_dispute from public.service_disputes where id=p_dispute_id;
  if not found then raise exception 'dispute_not_found'; end if;

  select * into v_booking
  from public.bookings
  where id = v_dispute.booking_id
  for update;
  if not found then raise exception 'booking_not_found'; end if;
  select * into v_dispute from public.service_disputes where id=p_dispute_id for update;

  v_before := jsonb_build_object(
    'dispute_status', v_dispute.status,
    'booking_status', v_booking.status,
    'resolution_code', v_dispute.resolution_code
  );

  if v_dispute.status in ('resolved','closed') then
    select coalesce((metadata_redacted->>'refund_minor')::bigint,0) into v_saved_refund
      from public.case_events where dispute_id=p_dispute_id and event_type='dispute.resolved'
      order by created_at desc limit 1;
    v_saved_refund := coalesce(v_saved_refund,0);
    if v_dispute.resolution_code is distinct from p_resolution_code
      or v_dispute.resolution_note is distinct from trim(p_note)
      or (p_resolution_code='partial_refund' and p_refund_minor is distinct from v_saved_refund)
    then raise exception 'dispute_already_resolved'; end if;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'dispute_id', v_dispute.id,
      'booking_id', v_booking.id,
      'status', v_dispute.status,
      'resolution_code', v_dispute.resolution_code,
      'refund_minor', v_saved_refund
    );
  end if;

  if v_booking.status <> 'disputed' then raise exception 'booking_not_disputed'; end if;

  if p_resolution_code = 'escalate' then
    if v_dispute.status='escalated' and v_dispute.resolution_note=trim(p_note) then
      return jsonb_build_object('ok',true,'replayed',true,'dispute_id',p_dispute_id,'booking_id',v_booking.id,'status','escalated','resolution_code','escalate');
    end if;
    update public.service_disputes
    set status = 'escalated', assigned_admin_id = v_admin,
        resolution_note = left(trim(p_note), 2000), updated_at = now()
    where id = p_dispute_id;

    insert into public.case_events(dispute_id, actor_id, event_type, note_redacted, metadata_redacted)
    values(p_dispute_id, v_admin, 'dispute.escalated', left(trim(p_note), 500), jsonb_build_object('resolution_code', p_resolution_code));
    insert into public.admin_audit_logs(actor_id, action, target_type, target_id, before_redacted, after_redacted, reason)
    values(v_admin, 'dispute.escalated', 'service_dispute', p_dispute_id, v_before,
      jsonb_build_object('status', 'escalated', 'booking_id', v_booking.id), trim(p_note));
    insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
    select party_id,'service_dispute_escalated','safety','high',
      jsonb_build_object('booking_id',v_booking.id,'dispute_id',p_dispute_id),
      'dispute_escalated:'||p_dispute_id::text||':'||party_id::text
    from (values(v_booking.buyer_id),(v_booking.seller_id)) parties(party_id)
    on conflict(dedupe_key) do nothing;
    return jsonb_build_object('ok', true, 'dispute_id', p_dispute_id, 'booking_id', v_booking.id, 'status', 'escalated','resolution_code','escalate');
  end if;

  -- All supported writers serialize on the booking lock. Lock the capture
  -- records too and reject ambiguous captures rather than choosing the latest.
  perform id from public.payment_intents where booking_id=v_booking.id order by id for update;
  select count(*) into v_capture_count from public.payment_intents
    where booking_id=v_booking.id and status in ('captured','partially_refunded','refunded');
  if v_capture_count=0 then raise exception 'captured_payment_not_found'; end if;
  if v_capture_count<>1 then raise exception 'ambiguous_booking_capture'; end if;
  select count(*) into v_release_count from public.ledger_transactions
    where reference_type='booking' and reference_id=v_booking.id and event_type='funds_released';
  if v_release_count>1 then raise exception 'ambiguous_booking_release'; end if;
  v_was_released := v_release_count=1;

  select * into v_payment
  from public.payment_intents
  where booking_id = v_booking.id and status in ('captured','partially_refunded','refunded')
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'captured_payment_not_found'; end if;
  -- No external refund adapter is connected. Never label real money refunded.
  if v_payment.processor <> 'simulation' then raise exception 'refund_processor_not_connected'; end if;
  if v_payment.currency is distinct from v_booking.currency
    or v_payment.payer_id is distinct from v_booking.buyer_id
    or v_payment.captured_minor is distinct from v_booking.total_minor
    or v_booking.total_minor is null or v_booking.total_minor<=0
    or v_booking.seller_net_minor is null or v_booking.seller_net_minor<0
    or v_booking.seller_net_minor>v_booking.total_minor
    or v_payment.refunded_minor is null or v_payment.refunded_minor<0
    or v_payment.refunded_minor>v_payment.captured_minor
    or (v_payment.status='captured' and v_payment.refunded_minor<>0)
    or (v_payment.status='partially_refunded' and (v_payment.refunded_minor=0 or v_payment.refunded_minor=v_payment.captured_minor))
    or (v_payment.status='refunded' and v_payment.refunded_minor<>v_payment.captured_minor)
  then raise exception 'payment_booking_mismatch'; end if;

  -- Payment metadata alone is not proof of money available for settlement.
  -- Validate the booking's actual balances, including the existing release
  -- allocation before reversing it. Escalation remains available above.
  select
    coalesce(sum(case when e.direction='credit' then e.amount_minor else -e.amount_minor end)
      filter(where a.account_type='protected_funds' and a.owner_user_id is null),0),
    coalesce(sum(case when e.direction='credit' then e.amount_minor else -e.amount_minor end)
      filter(where a.account_type='seller_wallet' and a.owner_user_id=v_booking.seller_id),0),
    coalesce(sum(case when e.direction='credit' then e.amount_minor else -e.amount_minor end)
      filter(where a.account_type='platform_revenue' and a.owner_user_id is null),0)
    into v_protected_balance,v_seller_balance,v_platform_balance
  from public.ledger_entries e join public.ledger_accounts a on a.id=e.account_id
  where e.booking_id=v_booking.id and a.currency=v_booking.currency;
  v_remaining := v_payment.captured_minor-v_payment.refunded_minor;
  v_expected_seller := least(v_remaining,greatest(v_booking.seller_net_minor-v_payment.refunded_minor,0));
  if v_protected_balance <> (case when v_was_released then 0 else v_remaining end)
    or v_seller_balance <> (case when v_was_released then v_expected_seller else 0 end)
    or v_platform_balance <> (case when v_was_released then v_remaining-v_expected_seller else 0 end)
  then raise exception 'booking_ledger_mismatch'; end if;

  if p_resolution_code in ('full_refund','partial_refund') then
    if p_resolution_code = 'full_refund' then
      v_refund := v_payment.captured_minor - v_payment.refunded_minor;
    else
      if p_refund_minor is null or p_refund_minor <= 0 then raise exception 'partial_refund_amount_required'; end if;
      v_refund := p_refund_minor;
    end if;
    if v_refund <= 0 or v_refund > v_payment.captured_minor - v_payment.refunded_minor then
      raise exception 'refund_amount_unavailable';
    end if;

    insert into public.ledger_accounts(account_type, owner_user_id, currency)
    values ('buyer_wallet', v_booking.buyer_id, v_booking.currency),
           ('protected_funds', null, v_booking.currency),
           ('seller_wallet', v_booking.seller_id, v_booking.currency),
           ('platform_revenue', null, v_booking.currency)
    on conflict do nothing;
    select id into v_buyer_wallet from public.ledger_accounts where account_type='buyer_wallet' and owner_user_id=v_booking.buyer_id and currency=v_booking.currency;
    select id into v_protected from public.ledger_accounts where account_type='protected_funds' and owner_user_id is null and currency=v_booking.currency;
    select id into v_seller_wallet from public.ledger_accounts where account_type='seller_wallet' and owner_user_id=v_booking.seller_id and currency=v_booking.currency;
    select id into v_platform from public.ledger_accounts where account_type='platform_revenue' and owner_user_id is null and currency=v_booking.currency;

    v_tx_id := gen_random_uuid();
    insert into public.ledger_transactions(id, reference_type, reference_id, event_type, currency, description, idempotency_key)
    values(v_tx_id, 'service_dispute', p_dispute_id, 'dispute_refund', v_booking.currency,
      'Admin-approved simulated dispute refund', 'dispute-refund:' || p_dispute_id::text);

    if v_was_released then
      v_seller_debit := least(v_refund, greatest(v_booking.seller_net_minor-v_payment.refunded_minor,0));
      v_platform_debit := v_refund - v_seller_debit;
      if v_seller_debit > 0 then
        insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
        values(v_tx_id, v_seller_wallet, 'debit', v_seller_debit, v_booking.id, v_booking.buyer_id, v_booking.seller_id);
      end if;
      if v_platform_debit > 0 then
        insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
        values(v_tx_id, v_platform, 'debit', v_platform_debit, v_booking.id, v_booking.buyer_id, v_booking.seller_id);
      end if;
    else
      insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
      values(v_tx_id, v_protected, 'debit', v_refund, v_booking.id, v_booking.buyer_id, v_booking.seller_id);
    end if;
    insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
    values(v_tx_id, v_buyer_wallet, 'credit', v_refund, v_booking.id, v_booking.buyer_id, v_booking.seller_id);

    insert into public.refunds(booking_id, payment_intent_id, amount_minor, currency, reason, status, requested_by, approved_by, processed_at)
    values(v_booking.id, v_payment.id, v_refund, v_booking.currency, 'dispute:' || p_resolution_code,
      'refunded', v_admin, v_admin, now());
    update public.payment_intents
    set refunded_minor = refunded_minor + v_refund,
        status = case when refunded_minor + v_refund = captured_minor then 'refunded'::public.payment_status else 'partially_refunded'::public.payment_status end,
        updated_at = now()
    where id = v_payment.id;
  end if;

  -- Every final outcome settles the remaining captured balance exactly once.
  -- A partial refund debits provider earnings first, preserving the existing
  -- refund allocation policy; the residual provider/platform amounts release.
  v_remaining := v_payment.captured_minor-v_payment.refunded_minor-v_refund;
  v_seller_remaining := least(v_remaining,greatest(v_booking.seller_net_minor-v_payment.refunded_minor-v_refund,0));
  if v_remaining>0 then
    -- Release/no-action/warning outcomes also settle still-protected funds.
    -- If care had already completed, the original release transaction remains authoritative.
    if not v_was_released then
      insert into public.ledger_accounts(account_type, owner_user_id, currency)
      values ('protected_funds', null, v_booking.currency),
             ('seller_wallet', v_booking.seller_id, v_booking.currency),
             ('platform_revenue', null, v_booking.currency)
      on conflict do nothing;
      select id into v_protected from public.ledger_accounts where account_type='protected_funds' and owner_user_id is null and currency=v_booking.currency;
      select id into v_seller_wallet from public.ledger_accounts where account_type='seller_wallet' and owner_user_id=v_booking.seller_id and currency=v_booking.currency;
      select id into v_platform from public.ledger_accounts where account_type='platform_revenue' and owner_user_id is null and currency=v_booking.currency;

      v_tx_id := gen_random_uuid();
      insert into public.ledger_transactions(id, reference_type, reference_id, event_type, currency, description, idempotency_key)
      values(v_tx_id, 'booking', v_booking.id, 'funds_released', v_booking.currency,
        'Simulated funds released after admin dispute decision', 'release:' || v_booking.id::text);
      insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
      values(v_tx_id, v_protected, 'debit', v_remaining, v_booking.id, v_booking.buyer_id, v_booking.seller_id);
      if v_seller_remaining>0 then
        insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
        values(v_tx_id,v_seller_wallet,'credit',v_seller_remaining,v_booking.id,v_booking.buyer_id,v_booking.seller_id);
      end if;
      if v_remaining > v_seller_remaining then
        insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
        values(v_tx_id, v_platform, 'credit', v_remaining-v_seller_remaining, v_booking.id, v_booking.buyer_id, v_booking.seller_id);
      end if;
      if v_booking.ended_at is not null and v_booking.completed_at is null then
        update public.seller_profiles set completed_bookings=completed_bookings+1 where user_id=v_booking.seller_id;
      end if;
    end if;
  end if;

  update public.bookings
  set status = 'resolved', blocks_calendar = false, version = version + 1,
      completed_at = case when v_remaining>0 and ended_at is not null then coalesce(completed_at, now()) else completed_at end
  where id = v_booking.id;
  insert into public.booking_status_history(booking_id, from_status, to_status, actor_id, reason_code)
  values(v_booking.id, v_booking.status, 'resolved', v_admin, left('dispute_' || p_resolution_code, 80));

  update public.service_disputes
  set status='resolved', assigned_admin_id=v_admin, resolution_code=p_resolution_code,
      resolution_note=left(trim(p_note),2000), resolved_at=now(), updated_at=now()
  where id=p_dispute_id;

  insert into public.case_events(dispute_id, actor_id, event_type, note_redacted, metadata_redacted)
  values(p_dispute_id, v_admin, 'dispute.resolved', left(trim(p_note),500),
    jsonb_build_object('resolution_code',p_resolution_code,'refund_minor',v_refund,'ledger_transaction_id',v_tx_id));
  insert into public.domain_events(aggregate_type, aggregate_id, event_type, payload_redacted)
  values('service_dispute',p_dispute_id,'service_dispute.resolved',
    jsonb_build_object('booking_id',v_booking.id,'resolution_code',p_resolution_code,'refund_minor',v_refund));
  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, before_redacted, after_redacted, reason)
  values(v_admin,'dispute.resolved','service_dispute',p_dispute_id,v_before,
    jsonb_build_object('status','resolved','booking_id',v_booking.id,'resolution_code',p_resolution_code,'refund_minor',v_refund),trim(p_note));
  insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  select party_id,'service_dispute_resolved','safety','high',
    jsonb_build_object('booking_id',v_booking.id,'dispute_id',p_dispute_id,'resolution_code',p_resolution_code,'refund_minor',v_refund),
    'dispute_resolved:'||p_dispute_id::text||':'||party_id::text
  from (values(v_booking.buyer_id),(v_booking.seller_id)) parties(party_id)
  on conflict(dedupe_key) do nothing;

  return jsonb_build_object(
    'ok',true,'dispute_id',p_dispute_id,'booking_id',v_booking.id,'status','resolved',
    'resolution_code',p_resolution_code,'refund_minor',v_refund,'ledger_transaction_id',v_tx_id
  );
end;
$$;

commit;
