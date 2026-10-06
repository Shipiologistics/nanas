begin;

-- Keep legacy publications unchanged: a historical simulated_paid label is not
-- evidence of a captured payment. New captures explicitly link their receipt.
alter table public.booking_request_publications add column payment_intent_id uuid unique references public.payment_intents(id);
alter function app_private.create_care_request(jsonb) rename to create_care_request_core;
revoke all on function app_private.create_care_request_core(jsonb) from public,anon,authenticated;

create function app_private.create_care_request(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_key text := p_payload->>'idempotency_key';
  v_hash text;
  v_existing public.idempotency_keys%rowtype;
  v_plan public.job_posting_plans%rowtype;
  v_result jsonb; v_request uuid;
  v_payment uuid := gen_random_uuid(); v_tx uuid := gen_random_uuid();
  v_debit uuid; v_credit uuid;
begin
  if v_user is null or not app_private.has_role('buyer') then raise exception 'buyer_required'; end if;
  if char_length(coalesce(v_key,'')) not between 8 and 200 then raise exception 'idempotency_key_required'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_request'; end if;
  v_hash := encode(sha256(convert_to((p_payload-'idempotency_key')::text,'UTF8')),'hex');
  -- Serialize all publication attempts for this buyer, including free allowance
  -- checks made with different keys, not merely retries of a single checkout.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('care-request:'||v_user::text,0));
  select * into v_existing from public.idempotency_keys where actor_id=v_user and scope='create_care_request' and key=v_key;
  if found then
    if v_existing.request_hash<>v_hash then raise exception 'idempotency_key_conflict'; end if;
    if v_existing.status<>'completed' or v_existing.response_body_redacted is null then raise exception 'request_in_progress'; end if;
    return v_existing.response_body_redacted || jsonb_build_object('replayed',true);
  end if;
  select * into v_plan from public.job_posting_plans where code=coalesce(nullif(p_payload->>'posting_plan_code',''),'free') and active for share;
  if not found then raise exception 'posting_plan_unavailable'; end if;
  if (p_payload->>'expected_fee_minor')::bigint is distinct from v_plan.fee_minor then raise exception 'price_changed'; end if;
  if v_plan.fee_minor>0 then
    if not app_private.payment_simulation_allowed() then raise exception 'test_payment_not_enabled'; end if;
    if coalesce((p_payload->>'simulated_payment_confirmed')::boolean,false)=false then raise exception 'posting_payment_required'; end if;
  end if;

  v_result := app_private.create_care_request_core(p_payload);
  perform app_private.attach_care_request_intake(p_payload,v_result);
  v_request := (v_result->>'request_id')::uuid;
  if v_plan.fee_minor>0 then
    insert into public.payment_intents(id,request_id,payer_id,processor,external_ref,amount_minor,currency,status,idempotency_key,captured_minor,authorized_at,captured_at)
    values(v_payment,v_request,v_user,'simulation','sim_request_'||v_request::text,v_plan.fee_minor,v_plan.currency,'captured','request-posting:'||v_key,v_plan.fee_minor,now(),now());
    insert into public.ledger_accounts(account_type,owner_user_id,currency) values('processor_clearing',null,v_plan.currency),('platform_revenue',null,v_plan.currency) on conflict do nothing;
    select id into v_debit from public.ledger_accounts where account_type='processor_clearing' and owner_user_id is null and currency=v_plan.currency and status='active';
    select id into v_credit from public.ledger_accounts where account_type='platform_revenue' and owner_user_id is null and currency=v_plan.currency and status='active';
    if v_debit is null or v_credit is null then raise exception 'posting_accounts_unavailable'; end if;
    insert into public.ledger_transactions(id,reference_type,reference_id,event_type,currency,description,idempotency_key)
    values(v_tx,'care_request',v_request,'payment_captured',v_plan.currency,'TEST ONLY: simulated care-request publication','request-posting-capture:'||v_request::text);
    insert into public.ledger_entries(transaction_id,account_id,direction,amount_minor,buyer_id)
    values(v_tx,v_debit,'debit',v_plan.fee_minor,v_user),(v_tx,v_credit,'credit',v_plan.fee_minor,v_user);
    update public.booking_request_publications set payment_intent_id=v_payment where request_id=v_request;
    v_result := v_result || jsonb_build_object('payment_intent_id',v_payment,'amount_minor',v_plan.fee_minor,'currency',v_plan.currency,'simulation',true);
  end if;
  insert into public.idempotency_keys(key,actor_id,scope,request_hash,status,response_code,response_body_redacted,expires_at)
  values(v_key,v_user,'create_care_request',v_hash,'completed',200,v_result,'infinity'::timestamptz);
  return v_result;
end; $$;

-- Intake attachment is inside the guarded transaction so replay cannot insert
-- it twice, and an intake validation failure cannot leave a payment behind.
create or replace function public.create_care_request(p_payload jsonb)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.create_care_request(p_payload); $$;
revoke all on function app_private.create_care_request(jsonb),public.create_care_request(jsonb) from public,anon;
grant execute on function app_private.create_care_request(jsonb),public.create_care_request(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
