begin;

create or replace function app_private.authorize_booking_transition(
  p_booking_id uuid,
  p_target public.booking_status,
  p_actor uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $function$
declare
  v_booking public.bookings%rowtype;
begin
  p_actor := coalesce(p_actor,(select auth.uid()));
  if p_actor is null then return false; end if;
  select * into v_booking from public.bookings where id=p_booking_id;
  if not found then return false; end if;
  return
    (p_actor=v_booking.seller_id and v_booking.status='confirmed' and p_target='in_progress') or
    (p_actor=v_booking.seller_id and v_booking.status='in_progress' and p_target='completion_pending') or
    (p_actor=v_booking.buyer_id and v_booking.status='completion_pending' and p_target='completed') or
    (p_actor in (v_booking.buyer_id,v_booking.seller_id) and v_booking.status in ('confirmed','requested','offered') and p_target='cancelled') or
    (p_actor in (v_booking.buyer_id,v_booking.seller_id) and v_booking.status in ('confirmed','in_progress','completion_pending','completed') and p_target='disputed') or
    (p_actor=(select auth.uid()) and app_private.has_admin_permission('bookings.manage'));
end
$function$;

create or replace function app_private.check_review_eligibility(
  p_booking_id uuid,
  p_author_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $function$
declare
  v_booking public.bookings%rowtype;
  v_subject uuid;
begin
  p_author_id := coalesce(p_author_id,(select auth.uid()));
  if p_author_id is null then return false; end if;
  select * into v_booking from public.bookings where id=p_booking_id;
  if not found or v_booking.status not in ('completed','resolved') then return false; end if;
  if p_author_id=v_booking.buyer_id then v_subject:=v_booking.seller_id;
  elsif p_author_id=v_booking.seller_id then v_subject:=v_booking.buyer_id;
  else return false;
  end if;
  return not exists (
    select 1 from public.reviews
    where booking_id=p_booking_id and author_id=p_author_id and subject_id=v_subject
  );
end
$function$;

create or replace function app_private.enqueue_domain_event(
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_event_type text,
  p_payload_redacted jsonb default '{}'::jsonb,
  p_trace_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_event_id uuid;
begin
  if char_length(trim(p_aggregate_type)) not between 2 and 80 then raise exception 'invalid_aggregate_type'; end if;
  if char_length(trim(p_event_type)) not between 2 and 120 then raise exception 'invalid_event_type'; end if;
  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted,trace_id)
  values(trim(p_aggregate_type),p_aggregate_id,trim(p_event_type),coalesce(p_payload_redacted,'{}'::jsonb),p_trace_id)
  returning id into v_event_id;
  return v_event_id;
end
$function$;

create or replace function app_private.post_ledger_transaction(
  p_reference_type text,
  p_reference_id uuid,
  p_event_type text,
  p_currency text,
  p_description text,
  p_idempotency_key text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transaction_id uuid;
  v_debits bigint;
  v_credits bigint;
  v_line jsonb;
begin
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'invalid_currency'; end if;
  if char_length(coalesce(p_idempotency_key,'')) < 8 then raise exception 'idempotency_key_required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then raise exception 'ledger_lines_required'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) line
    where coalesce((line->>'amount_minor')::bigint,0) <= 0
       or line->>'direction' not in ('debit','credit')
       or nullif(line->>'account_id','') is null
  ) then raise exception 'invalid_ledger_line'; end if;

  select
    coalesce(sum((line->>'amount_minor')::bigint) filter(where line->>'direction'='debit'),0),
    coalesce(sum((line->>'amount_minor')::bigint) filter(where line->>'direction'='credit'),0)
  into v_debits,v_credits
  from jsonb_array_elements(p_lines) line;
  if v_debits<>v_credits then raise exception 'unbalanced_ledger_transaction'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) line
    left join public.ledger_accounts a on a.id=(line->>'account_id')::uuid
    where a.id is null or a.currency<>p_currency or a.status<>'active'
  ) then raise exception 'invalid_ledger_account'; end if;

  insert into public.ledger_transactions(
    reference_type,reference_id,event_type,currency,description,idempotency_key
  ) values (
    p_reference_type,p_reference_id,p_event_type,p_currency,p_description,p_idempotency_key
  ) on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning id into v_transaction_id;

  if not exists(select 1 from public.ledger_entries where transaction_id=v_transaction_id) then
    for v_line in select value from jsonb_array_elements(p_lines)
    loop
      insert into public.ledger_entries(
        transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id
      ) values (
        v_transaction_id,(v_line->>'account_id')::uuid,(v_line->>'direction')::public.ledger_direction,
        (v_line->>'amount_minor')::bigint,nullif(v_line->>'booking_id','')::uuid,
        nullif(v_line->>'buyer_id','')::uuid,nullif(v_line->>'seller_id','')::uuid
      );
    end loop;
  end if;
  return v_transaction_id;
end
$function$;

create or replace function app_private.accept_booking_offer(
  p_offer_id uuid,
  p_accept boolean,
  p_decline_code text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_offer public.booking_offers%rowtype;
begin
  if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
  if char_length(coalesce(p_idempotency_key,'')) < 8 then raise exception 'idempotency_key_required'; end if;
  select * into v_offer from public.booking_offers where id=p_offer_id for update;
  if not found or v_offer.seller_id<>v_user then raise exception 'offer_not_found'; end if;
  if v_offer.status not in ('queued','sent','viewed') or v_offer.expires_at<=now() then raise exception 'offer_unavailable'; end if;

  update public.booking_offers
  set status=case when p_accept then 'accepted'::public.offer_status else 'declined'::public.offer_status end,
      responded_at=now(), decline_code=case when p_accept then null else left(coalesce(p_decline_code,'seller_declined'),80) end,
      updated_at=now()
  where id=v_offer.id;
  if p_accept then
    update public.booking_offers set status='withdrawn',updated_at=now()
    where request_id=v_offer.request_id and id<>v_offer.id and status in ('queued','sent','viewed');
    update public.booking_requests set status='offered',updated_at=now() where id=v_offer.request_id and status='requested';
  end if;
  perform app_private.enqueue_domain_event(
    'booking_offer',v_offer.id,case when p_accept then 'booking_offer.accepted' else 'booking_offer.declined' end,
    jsonb_build_object('request_id',v_offer.request_id,'seller_id',v_user,'quote_id',v_offer.quote_id)
  );
  return jsonb_build_object('ok',true,'offer_id',v_offer.id,'status',case when p_accept then 'accepted' else 'declined' end,'quote_id',v_offer.quote_id);
end
$function$;

create or replace function public.accept_booking_offer(
  p_offer_id uuid,
  p_accept boolean,
  p_decline_code text default null,
  p_idempotency_key text default null
)
returns jsonb language sql security invoker set search_path=''
as $function$ select app_private.accept_booking_offer(p_offer_id,p_accept,p_decline_code,p_idempotency_key); $function$;

create or replace function app_private.evaluate_user_badges(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_seller public.seller_profiles%rowtype;
  v_badge public.badges%rowtype;
  v_result boolean;
  v_evaluated integer := 0;
  v_awarded integer := 0;
  v_metrics jsonb;
begin
  select * into v_seller from public.seller_profiles where user_id=p_user_id;
  if not found then raise exception 'seller_not_found'; end if;
  v_metrics:=jsonb_build_object('rating',v_seller.rating_average,'reviews',v_seller.rating_count,'completed',v_seller.completed_bookings,'response_rate',v_seller.response_rate,'seller_status',v_seller.status);
  for v_badge in select * from public.badges where active
  loop
    v_result:=case v_badge.code
      when 'identity_verified' then v_seller.status='approved'
      when 'highly_rated' then v_seller.rating_count>=10 and v_seller.rating_average>=4.8
      when 'reliable_responder' then v_seller.response_rate>=90
      when 'experienced_seller' then v_seller.completed_bookings>=25
      else false end;
    insert into public.badge_evaluation_runs(badge_id,rule_version,user_id,metrics_snapshot,result,result_reason)
    values(v_badge.id,v_badge.rule_version,p_user_id,v_metrics,v_result,case when v_result then 'rule_requirements_met' else 'rule_requirements_not_met' end);
    v_evaluated:=v_evaluated+1;
    if v_result then
      insert into public.user_badges(user_id,badge_id,source_type,source_id,rule_version,metric_snapshot)
      values(p_user_id,v_badge.id,'rule',p_user_id,v_badge.rule_version,v_metrics)
      on conflict do nothing;
      v_awarded:=v_awarded+1;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'user_id',p_user_id,'evaluated',v_evaluated,'awarded',v_awarded);
end
$function$;

revoke all on function app_private.authorize_booking_transition(uuid,public.booking_status,uuid) from public,anon,authenticated;
revoke all on function app_private.check_review_eligibility(uuid,uuid) from public,anon,authenticated;
revoke all on function app_private.enqueue_domain_event(text,uuid,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function app_private.post_ledger_transaction(text,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function app_private.evaluate_user_badges(uuid) from public,anon,authenticated;
revoke all on function app_private.accept_booking_offer(uuid,boolean,text,text) from public,anon;
revoke all on function public.accept_booking_offer(uuid,boolean,text,text) from public,anon;
grant execute on function app_private.accept_booking_offer(uuid,boolean,text,text) to authenticated;
grant execute on function public.accept_booking_offer(uuid,boolean,text,text) to authenticated;

commit;
