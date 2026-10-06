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
  -- No external refund adapter is connected. Never label real money refunded.
  if v_payment.processor <> 'simulation' then raise exception 'refund_processor_not_connected'; end if;
  if v_payment.currency<>v_booking.currency or v_payment.captured_minor<>v_booking.total_minor then
    raise exception 'payment_booking_mismatch';
  end if;

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

create or replace function app_private.open_service_dispute(p_booking_id uuid, p_reason_code text, p_summary text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_dispute_id uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if char_length(trim(coalesce(p_reason_code,''))) not between 3 and 80 then raise exception 'invalid_reason_code'; end if;
  if char_length(trim(coalesce(p_summary,''))) not between 10 and 3000 then raise exception 'invalid_summary'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_user not in (v_booking.buyer_id, v_booking.seller_id) then raise exception 'booking_access_denied'; end if;
  if v_booking.status not in ('confirmed','in_progress','completion_pending','completed','disputed') then raise exception 'dispute_not_allowed'; end if;

  select id into v_dispute_id from public.service_disputes
  where booking_id = p_booking_id and status not in ('resolved','closed') for update;
  if v_dispute_id is not null then
    return jsonb_build_object('ok',true,'replayed',true,'dispute_id',v_dispute_id,'booking_id',p_booking_id,
      'status',(select status from public.service_disputes where id=v_dispute_id));
  end if;
  if v_dispute_id is null then
    insert into public.service_disputes (booking_id,opened_by,reason_code,summary,priority)
    values (p_booking_id,v_user,left(trim(p_reason_code),80),trim(p_summary),'high') returning id into v_dispute_id;
  end if;

  if v_booking.status <> 'disputed' then
    update public.bookings set status='disputed',blocks_calendar=false,version=version+1 where id=p_booking_id;
    insert into public.booking_status_history (booking_id,from_status,to_status,actor_id,reason_code)
    values (p_booking_id,v_booking.status,'disputed',v_user,'service_dispute_opened');
  end if;
  insert into public.domain_events (aggregate_type,aggregate_id,event_type,payload_redacted)
  values ('service_dispute',v_dispute_id,'service_dispute.opened',jsonb_build_object('booking_id',p_booking_id));
  insert into public.notification_outbox (recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  values (case when v_user=v_booking.buyer_id then v_booking.seller_id else v_booking.buyer_id end,'service_dispute_opened','safety','high',jsonb_build_object('booking_id',p_booking_id),'dispute:'||v_dispute_id::text||':party')
  on conflict (dedupe_key) do nothing;
  return jsonb_build_object('ok',true,'dispute_id',v_dispute_id,'booking_id',p_booking_id,'status','open');
end;
$$;

-- A buyer must be able to read an admin-approved refund of their booking.
revoke all on function app_private.open_service_dispute(uuid,text,text) from public,anon;
grant execute on function app_private.open_service_dispute(uuid,text,text) to authenticated;
drop policy if exists refunds_parties_admin on public.refunds;
create policy refunds_parties_admin on public.refunds for select to authenticated using (
  requested_by=(select auth.uid()) or exists(select 1 from public.bookings b where b.id=booking_id
    and (b.buyer_id=(select auth.uid()) or b.seller_id=(select auth.uid())))
  or app_private.has_admin_permission('finance.read'));
create or replace function app_private.deliver_in_app_notification(p_outbox_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare
  v_item public.notification_outbox%rowtype; v_role text; v_context text;
  v_conversation uuid; v_booking uuid; v_request uuid; v_link text; v_title text; v_body text;
begin
  select * into v_item from public.notification_outbox where id=p_outbox_id;
  if not found then return; end if;
  if exists(select 1 from public.notification_preferences where user_id=v_item.recipient_id
    and event_category=v_item.category and not in_app) then return; end if;
  v_conversation:=app_private.safe_uuid(v_item.variables_redacted->>'conversation_id');
  v_booking:=app_private.safe_uuid(v_item.variables_redacted->>'booking_id');
  v_request:=app_private.safe_uuid(v_item.variables_redacted->>'request_id');
  if v_conversation is not null then
    select role::text into v_context from public.conversation_members
      where conversation_id=v_conversation and user_id=v_item.recipient_id and left_at is null;
  elsif v_booking is not null then
    select case when buyer_id=v_item.recipient_id then 'buyer' when seller_id=v_item.recipient_id then 'seller' end
      into v_context from public.bookings where id=v_booking;
  end if;
  select role::text into v_role from public.user_roles where user_id=v_item.recipient_id and revoked_at is null
    order by case when role::text=v_context then 0
      when v_item.template_key like 'verification_%' and role::text='seller' then 1
      when v_item.template_key='quote_received' and role::text='buyer' then 1
      when role::text='buyer' then 2 when role::text='seller' then 3 else 4 end limit 1;
  v_link:=case when v_role in ('buyer','seller','admin') then '/app/'||v_role else '/auth' end;
  if v_link<>'/auth' then
    v_link:=v_link||case
      when v_conversation is not null then '/messages'||case when v_role='admin' then '' else '/'||v_conversation::text end
      when v_booking is not null then '/bookings'
      when v_role='admin' then '/notifications'
      when v_item.template_key in ('verification_decision','verification_submitted') then case when v_role='seller' then '/kyc' else '/account' end
      when v_item.template_key='quote_received' then '/quotes'
      when v_request is not null then case when v_role='seller' then '/requests' else '/care-requests' end
      else '/notifications' end;
  end if;
  v_title:=case v_item.category when 'booking' then 'Nanas booking update' when 'messages' then 'New Nanas message'
    when 'payments' then 'Nanas payment update' when 'account' then 'Nanas account update' else 'Nanas update' end;
  -- Never copy a private message body, care note or document into a notification.
  v_body:=case v_item.template_key when 'new_message' then 'You have a new secure message.'
    when 'quote_received' then 'You received a new quote for your care request.'
    when 'booking_confirmed' then 'A Nanas care booking has been confirmed.'
    when 'booking_status_changed' then 'The status of your care booking changed.'
    when 'payment_captured' then 'A payment update is available in your booking.'
    when 'service_dispute_opened' then 'A service dispute was opened for your booking. Review the case in booking details.'
    when 'service_dispute_escalated' then 'Your booking dispute was escalated for further review.'
    when 'service_dispute_resolved' then 'Your booking dispute has a resolution. Review booking details and financial records.'
    when 'verification_decision' then 'Your provider verification has been updated.'
    else 'There is a new update in your Nanas account.' end;
  insert into public.notifications(id,recipient_id,event_type,category,title,body,deep_link,related_type,related_id)
    values(v_item.id,v_item.recipient_id,v_item.template_key,v_item.category,v_title,v_body,v_link,
      case when v_booking is not null then 'booking' when v_request is not null then 'booking_request' when v_conversation is not null then 'conversation' end,
      coalesce(v_booking,v_request,v_conversation)) on conflict(id) do nothing;
  insert into public.notification_deliveries(id,outbox_id,notification_id,channel,vendor,status,attempts,delivered_at)
    values(v_item.id,v_item.id,v_item.id,'in_app','nanas-database','delivered',1,now()) on conflict(id) do nothing;
end; $$;
revoke all on function app_private.deliver_in_app_notification(uuid) from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
