begin;

-- Only trusted callers below choose the actor/source. No client may call this
-- helper directly; manual and automatic completion share one locked settlement.
create or replace function app_private.complete_booking(
  p_booking_id uuid, p_actor_id uuid, p_source text, p_reason text, p_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  b public.bookings%rowtype; payment public.payment_intents%rowtype;
  protected_balance bigint; protected_id uuid; seller_wallet uuid; platform_id uuid;
  tx uuid := gen_random_uuid();
begin
  if p_source not in ('app','maintenance') or p_source is null then raise exception 'invalid_completion_source'; end if;
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if p_source='app' and p_actor_id is distinct from b.buyer_id then raise exception 'only_buyer_can_complete'; end if;
  if p_source='maintenance' and p_actor_id is not null then raise exception 'invalid_completion_actor'; end if;
  if b.status<>'completion_pending' then raise exception 'booking_not_pending_completion'; end if;
  if exists(select 1 from public.service_disputes where booking_id=b.id and status not in ('resolved','closed')) then raise exception 'active_dispute'; end if;
  if b.started_at is null or b.ended_at is null or b.started_at>b.ended_at or b.ended_at>now() then raise exception 'booking_not_checked_out'; end if;
  if p_source='maintenance' and b.ended_at>now()-interval '24 hours' then raise exception 'completion_not_due'; end if;
  if not exists(select 1 from public.booking_checkins where booking_id=b.id and user_id=b.seller_id and event_type='check_in' and code_verified)
    or not exists(select 1 from public.booking_checkins where booking_id=b.id and user_id=b.seller_id and event_type='check_out') then raise exception 'verified_attendance_required'; end if;
  if b.total_minor<=0 or b.seller_net_minor<=0 or b.seller_net_minor>b.total_minor then raise exception 'invalid_settlement_amounts'; end if;
  if (select count(*) from public.payment_intents where booking_id=b.id and status in ('captured','partially_refunded'))<>1 then raise exception 'captured_funds_unavailable'; end if;
  select * into payment from public.payment_intents where booking_id=b.id and status in ('captured','partially_refunded') for update;
  if payment.processor<>'simulation' then raise exception 'payment_processor_not_connected'; end if;
  if payment.currency<>b.currency or payment.captured_minor<>b.total_minor or payment.refunded_minor<>0 then raise exception 'payment_booking_mismatch'; end if;
  select coalesce(sum(case when e.direction='credit' then e.amount_minor else -e.amount_minor end),0)
    into protected_balance from public.ledger_entries e join public.ledger_accounts a on a.id=e.account_id
    where e.booking_id=b.id and a.account_type='protected_funds' and a.owner_user_id is null and a.currency=b.currency;
  if protected_balance<>b.total_minor then raise exception 'protected_funds_unavailable'; end if;
  if exists(select 1 from public.ledger_transactions where reference_type='booking' and reference_id=b.id and event_type='funds_released') then raise exception 'funds_already_released'; end if;

  insert into public.ledger_accounts(account_type,owner_user_id,currency)
    values('seller_wallet',b.seller_id,b.currency),('platform_revenue',null,b.currency) on conflict do nothing;
  select id into protected_id from public.ledger_accounts where account_type='protected_funds' and owner_user_id is null and currency=b.currency;
  select id into seller_wallet from public.ledger_accounts where account_type='seller_wallet' and owner_user_id=b.seller_id and currency=b.currency;
  select id into platform_id from public.ledger_accounts where account_type='platform_revenue' and owner_user_id is null and currency=b.currency;
  insert into public.ledger_transactions(id,reference_type,reference_id,event_type,currency,description,idempotency_key)
    values(tx,'booking',b.id,'funds_released',b.currency,'Simulated booking funds released','release:'||b.id::text);
  insert into public.ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id)
    values(tx,protected_id,'debit',b.total_minor,b.id,b.buyer_id,b.seller_id),
      (tx,seller_wallet,'credit',b.seller_net_minor,b.id,b.buyer_id,b.seller_id);
  if b.total_minor>b.seller_net_minor then
    insert into public.ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id)
      values(tx,platform_id,'credit',b.total_minor-b.seller_net_minor,b.id,b.buyer_id,b.seller_id);
  end if;
  update public.bookings set status='completed',blocks_calendar=false,completed_at=now(),version=version+1 where id=b.id;
  update public.seller_profiles set completed_bookings=completed_bookings+1 where user_id=b.seller_id;
  if not found then raise exception 'provider_profile_missing'; end if;
  insert into public.booking_status_history(booking_id,from_status,to_status,actor_id,reason_code,source,idempotency_key)
    values(b.id,b.status,'completed',p_actor_id,left(coalesce(p_reason,'completion'),80),p_source,p_key);
  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
    values('booking',b.id,'booking.completed',jsonb_build_object('actor_id',p_actor_id,'source',p_source,'from',b.status,'to','completed'));
  insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
    select party_id,'booking_status_changed','booking','normal'::public.case_priority,
      jsonb_build_object('booking_id',b.id,'status','completed'),
      'booking_status:'||b.id::text||':completed:'||party_id::text
    from (values(b.buyer_id),(b.seller_id)) parties(party_id);
  return jsonb_build_object('ok',true,'booking_id',b.id,'status','completed','version',b.version+1,'ledger_transaction_id',tx);
end; $$;
revoke all on function app_private.complete_booking(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;

-- Bounded service-only sweep. Each candidate settles atomically; failures are
-- returned explicitly and cannot leave a half-completed booking or ledger.
create or replace function public.auto_complete_bookings(p_limit integer default 100,p_booking_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare candidate uuid; completed integer:=0; skipped integer:=0; failures jsonb:='[]'::jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_batch_limit'; end if;
  for candidate in select id from public.bookings where status='completion_pending'
    and ended_at<=now()-interval '24 hours' and (p_booking_id is null or id=p_booking_id)
    order by ended_at,id limit p_limit for update skip locked
  loop
    begin
      if exists(select 1 from public.service_disputes where booking_id=candidate and status not in ('resolved','closed')) then
        skipped:=skipped+1;
      else
        perform app_private.complete_booking(candidate,null,'maintenance','auto_complete','auto-complete:'||candidate::text);
        completed:=completed+1;
      end if;
    exception when others then
      failures:=failures||jsonb_build_array(jsonb_build_object('booking_id',candidate,'error',left(sqlerrm,160)));
    end;
  end loop;
  return jsonb_build_object('ok',jsonb_array_length(failures)=0,'completed',completed,'skipped',skipped,'failures',failures);
end; $$;
revoke all on function public.auto_complete_bookings(integer,uuid) from public,anon,authenticated;
grant execute on function public.auto_complete_bookings(integer,uuid) to service_role;

create or replace function app_private.transition_booking(p_booking_id uuid,p_target public.booking_status,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_history public.booking_status_history%rowtype;
  v_code_id uuid;
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

  if p_target='completed' then
    return app_private.complete_booking(p_booking_id,v_user,'app',p_reason,p_idempotency_key);
  end if;

  update public.bookings set status=p_target,blocks_calendar=p_target in ('confirmed','in_progress','completion_pending'),version=version+1,
    started_at=case when p_target='in_progress' then now() else started_at end,
    ended_at=case when p_target='completion_pending' then now() else ended_at end,
    completed_at=case when p_target='completed' then now() else completed_at end
  where id=p_booking_id;
  insert into public.booking_status_history(booking_id,from_status,to_status,actor_id,reason_code,idempotency_key)
  values(p_booking_id,v_booking.status,p_target,v_user,left(coalesce(p_reason,'user_action'),80),p_idempotency_key);

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

notify pgrst,'reload schema';
commit;
