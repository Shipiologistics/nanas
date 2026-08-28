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
begin
  if v_admin is null or not app_private.has_admin_permission('disputes.manage') then
    raise exception 'permission_denied';
  end if;
  if p_resolution_code not in ('release_funds','full_refund','partial_refund','no_action','warning','escalate') then
    raise exception 'invalid_resolution_code';
  end if;
  if char_length(trim(coalesce(p_note, ''))) not between 5 and 2000 then
    raise exception 'resolution_note_required';
  end if;

  select * into v_dispute
  from public.service_disputes
  where id = p_dispute_id
  for update;
  if not found then raise exception 'dispute_not_found'; end if;

  select * into v_booking
  from public.bookings
  where id = v_dispute.booking_id
  for update;
  if not found then raise exception 'booking_not_found'; end if;

  v_before := jsonb_build_object(
    'dispute_status', v_dispute.status,
    'booking_status', v_booking.status,
    'resolution_code', v_dispute.resolution_code
  );

  if v_dispute.status in ('resolved','closed') then
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'dispute_id', v_dispute.id,
      'booking_id', v_booking.id,
      'status', v_dispute.status,
      'resolution_code', v_dispute.resolution_code
    );
  end if;

  if p_resolution_code = 'escalate' then
    update public.service_disputes
    set status = 'escalated', assigned_admin_id = v_admin,
        resolution_note = left(trim(p_note), 2000), updated_at = now()
    where id = p_dispute_id;

    insert into public.case_events(dispute_id, actor_id, event_type, note_redacted, metadata_redacted)
    values(p_dispute_id, v_admin, 'dispute.escalated', left(trim(p_note), 500), jsonb_build_object('resolution_code', p_resolution_code));
    insert into public.admin_audit_logs(actor_id, action, target_type, target_id, before_redacted, after_redacted, reason)
    values(v_admin, 'dispute.escalated', 'service_dispute', p_dispute_id, v_before,
      jsonb_build_object('status', 'escalated', 'booking_id', v_booking.id), trim(p_note));
    return jsonb_build_object('ok', true, 'dispute_id', p_dispute_id, 'booking_id', v_booking.id, 'status', 'escalated');
  end if;

  select exists(
    select 1 from public.ledger_transactions
    where reference_type = 'booking' and reference_id = v_booking.id and event_type = 'funds_released'
  ) into v_was_released;

  select * into v_payment
  from public.payment_intents
  where booking_id = v_booking.id and status in ('captured','partially_refunded','refunded')
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'captured_payment_not_found'; end if;

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
      v_seller_debit := least(v_refund, v_booking.seller_net_minor);
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
  else
    -- Release/no-action/warning outcomes all settle any still-protected funds.
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
      values(v_tx_id, v_protected, 'debit', v_booking.total_minor, v_booking.id, v_booking.buyer_id, v_booking.seller_id),
            (v_tx_id, v_seller_wallet, 'credit', v_booking.seller_net_minor, v_booking.id, v_booking.buyer_id, v_booking.seller_id);
      if v_booking.total_minor > v_booking.seller_net_minor then
        insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
        values(v_tx_id, v_platform, 'credit', v_booking.total_minor-v_booking.seller_net_minor, v_booking.id, v_booking.buyer_id, v_booking.seller_id);
      end if;
      update public.seller_profiles set completed_bookings=completed_bookings+1 where user_id=v_booking.seller_id;
    end if;
  end if;

  update public.bookings
  set status = 'resolved', blocks_calendar = false, version = version + 1,
      completed_at = case when p_resolution_code in ('release_funds','no_action','warning') then coalesce(completed_at, now()) else completed_at end
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

create or replace function public.admin_resolve_service_dispute(
  p_dispute_id uuid,
  p_resolution_code text,
  p_note text,
  p_refund_minor bigint default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.admin_resolve_service_dispute(p_dispute_id,p_resolution_code,p_note,p_refund_minor);
$$;

revoke all on function public.admin_resolve_service_dispute(uuid,text,text,bigint) from public, anon;
grant execute on function public.admin_resolve_service_dispute(uuid,text,text,bigint) to authenticated;
revoke all on function app_private.admin_resolve_service_dispute(uuid,text,text,bigint) from public, anon;
grant execute on function app_private.admin_resolve_service_dispute(uuid,text,text,bigint) to authenticated;

commit;
