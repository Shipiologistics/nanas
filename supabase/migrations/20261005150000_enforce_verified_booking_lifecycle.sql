begin;

-- Six-digit code hashes must not be downloadable for offline guessing.
-- Parties use the narrowly scoped generation/verification RPCs instead.
revoke all on public.booking_session_codes from public, anon, authenticated;

create or replace function app_private.generate_session_code(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_code text;
  v_id uuid;
  v_until timestamptz;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_user <> v_booking.buyer_id then raise exception 'only_buyer_can_generate_session_code'; end if;
  if v_booking.status <> 'confirmed' then raise exception 'session_code_not_allowed'; end if;
  if now() < v_booking.scheduled_start - interval '2 hours' or now() >= v_booking.scheduled_end + interval '2 hours' then raise exception 'outside_session_code_window'; end if;
  update public.booking_session_codes set consumed_at=now() where booking_id=p_booking_id and consumed_at is null;
  v_code := lpad(((('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint % 1000000))::text,6,'0');
  v_until := least(now()+interval '15 minutes',v_booking.scheduled_end+interval '2 hours');
  insert into public.booking_session_codes(booking_id,code_digest,valid_from,valid_until,buyer_verified_at)
  values(p_booking_id,extensions.crypt(v_code,extensions.gen_salt('bf',8)),now(),v_until,now()) returning id into v_id;
  return jsonb_build_object('ok',true,'session_code_id',v_id,'code',v_code,'valid_until',v_until);
end;
$$;

create or replace function app_private.verify_session_code(p_booking_id uuid,p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_code public.booking_session_codes%rowtype;
  v_attempts integer;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then raise exception 'invalid_session_code'; end if;
  -- Generation, verification and check-in share this lock order.
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found or v_user <> v_booking.seller_id then raise exception 'only_seller_can_verify_session_code'; end if;
  if v_booking.status <> 'confirmed' then raise exception 'session_code_not_allowed'; end if;
  if now() < v_booking.scheduled_start - interval '2 hours' or now() >= v_booking.scheduled_end + interval '2 hours' then raise exception 'outside_session_code_window'; end if;
  select * into v_code from public.booking_session_codes
  where booking_id=p_booking_id and consumed_at is null
  order by created_at desc,id desc limit 1 for update;
  if not found or now() < v_code.valid_from or now() >= v_code.valid_until then raise exception 'session_code_expired'; end if;
  if v_code.attempt_count >= 5 then
    return jsonb_build_object('ok',false,'error','session_code_locked','attempts_remaining',0);
  end if;
  if extensions.crypt(p_code,v_code.code_digest) <> v_code.code_digest then
    v_attempts := v_code.attempt_count+1;
    update public.booking_session_codes set attempt_count=v_attempts,seller_verified_at=null where id=v_code.id;
    if v_attempts=5 then
      insert into public.risk_signals(user_id,booking_id,signal_type,source,score,evidence_redacted)
      values(v_user,p_booking_id,'session_code_failures','verify_session_code',0.8,jsonb_build_object('attempts',v_attempts));
    end if;
    -- An exception here would undo the attempt counter and risk signal.
    return jsonb_build_object('ok',false,'error',case when v_attempts=5 then 'session_code_locked' else 'session_code_incorrect' end,'attempts_remaining',5-v_attempts);
  end if;
  update public.booking_session_codes set seller_verified_at=now() where id=v_code.id;
  return jsonb_build_object('ok',true,'booking_id',p_booking_id,'verified',true);
end;
$$;

create or replace function app_private.transition_booking(p_booking_id uuid,p_target public.booking_status,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_history public.booking_status_history%rowtype;
  v_code_id uuid;
  v_tx_id uuid;
  v_protected uuid;
  v_seller_wallet uuid;
  v_platform uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 200 then raise exception 'idempotency_key_required'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_user not in (v_booking.buyer_id,v_booking.seller_id) then raise exception 'booking_access_denied'; end if;
  -- Authorize before replaying; a key is bound to the actor and target.
  select * into v_history from public.booking_status_history
  where booking_id=p_booking_id and idempotency_key=p_idempotency_key order by created_at limit 1;
  if found then
    if v_history.actor_id is distinct from v_user or v_history.to_status is distinct from p_target then raise exception 'idempotency_key_conflict'; end if;
    return jsonb_build_object('ok',true,'booking_id',p_booking_id,'status',v_booking.status,'version',v_booking.version,'replayed',true);
  end if;
  -- Cancellation/refund and dispute creation have their own atomic RPCs.
  -- No generic administrative override may skip those workflows or release funds.
  if not (
    (v_user=v_booking.seller_id and v_booking.status='confirmed' and p_target='in_progress') or
    (v_user=v_booking.seller_id and v_booking.status='in_progress' and p_target='completion_pending') or
    (v_user=v_booking.buyer_id and v_booking.status='completion_pending' and p_target='completed')
  ) or p_target is null then raise exception 'transition_not_allowed'; end if;

  if p_target='in_progress' then
    if now() < v_booking.scheduled_start - interval '2 hours' or now() >= v_booking.scheduled_end + interval '2 hours' then raise exception 'outside_session_code_window'; end if;
    select id into v_code_id from public.booking_session_codes
    where booking_id=p_booking_id and consumed_at is null and attempt_count<5
      and buyer_verified_at is not null and seller_verified_at is not null
      and now()>=valid_from and now()<valid_until
    order by created_at desc,id desc limit 1 for update;
    if not found then raise exception 'verified_session_code_required'; end if;
    update public.booking_session_codes set consumed_at=now() where id=v_code_id;
    insert into public.booking_checkins(booking_id,user_id,event_type,method,code_verified)
    values(p_booking_id,v_user,'check_in','session_code',true);
  elsif p_target='completion_pending' then
    if v_booking.started_at is null then raise exception 'booking_not_checked_in'; end if;
    insert into public.booking_checkins(booking_id,user_id,event_type,method,code_verified)
    values(p_booking_id,v_user,'check_out','authenticated_provider',false);
  elsif v_booking.started_at is null or v_booking.ended_at is null then
    raise exception 'booking_not_checked_out';
  end if;

  update public.bookings set status=p_target,blocks_calendar=p_target in ('confirmed','in_progress','completion_pending'),version=version+1,
    started_at=case when p_target='in_progress' then now() else started_at end,
    ended_at=case when p_target='completion_pending' then now() else ended_at end,
    completed_at=case when p_target='completed' then now() else completed_at end
  where id=p_booking_id;
  insert into public.booking_status_history(booking_id,from_status,to_status,actor_id,reason_code,idempotency_key)
  values(p_booking_id,v_booking.status,p_target,v_user,left(coalesce(p_reason,'user_action'),80),p_idempotency_key);

  if p_target='completed' then
    insert into public.ledger_accounts(account_type,owner_user_id,currency) values('seller_wallet',v_booking.seller_id,v_booking.currency) on conflict do nothing;
    insert into public.ledger_accounts(account_type,owner_user_id,currency) values('platform_revenue',null,v_booking.currency) on conflict do nothing;
    select id into v_protected from public.ledger_accounts where account_type='protected_funds' and owner_user_id is null and currency=v_booking.currency;
    select id into v_seller_wallet from public.ledger_accounts where account_type='seller_wallet' and owner_user_id=v_booking.seller_id and currency=v_booking.currency;
    select id into v_platform from public.ledger_accounts where account_type='platform_revenue' and owner_user_id is null and currency=v_booking.currency;
    v_tx_id := gen_random_uuid();
    insert into public.ledger_transactions(id,reference_type,reference_id,event_type,currency,description,idempotency_key)
    values(v_tx_id,'booking',v_booking.id,'funds_released',v_booking.currency,'Simulated booking funds released','release:'||v_booking.id::text);
    insert into public.ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id)
    values(v_tx_id,v_protected,'debit',v_booking.total_minor,v_booking.id,v_booking.buyer_id,v_booking.seller_id),
      (v_tx_id,v_seller_wallet,'credit',v_booking.seller_net_minor,v_booking.id,v_booking.buyer_id,v_booking.seller_id);
    if v_booking.total_minor>v_booking.seller_net_minor then
      insert into public.ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id)
      values(v_tx_id,v_platform,'credit',v_booking.total_minor-v_booking.seller_net_minor,v_booking.id,v_booking.buyer_id,v_booking.seller_id);
    end if;
    update public.seller_profiles set completed_bookings=completed_bookings+1 where user_id=v_booking.seller_id;
  end if;
  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values('booking',p_booking_id,'booking.'||p_target::text,jsonb_build_object('actor_id',v_user,'from',v_booking.status,'to',p_target));
  insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  select party_id,'booking_status_changed','booking','normal'::public.case_priority,
    jsonb_build_object('booking_id',p_booking_id,'status',p_target),
    'booking_status:'||p_booking_id::text||':'||p_target::text||':'||party_id::text
  from (values(v_booking.buyer_id),(v_booking.seller_id)) p(party_id);
  return jsonb_build_object('ok',true,'booking_id',p_booking_id,'status',p_target,'version',v_booking.version+1);
end;
$$;

commit;
