begin;

-- Simulated external checkout is funded by processor clearing, not an unfunded
-- customer wallet. The QA enrollment guard remains in the public entry points.

create or replace function app_private.accept_quote_simulation_core(p_quote_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_quote public.booking_quotes%rowtype;
  v_request public.booking_requests%rowtype;
  v_booking_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_conversation_id uuid := gen_random_uuid();
  v_tx_id uuid := gen_random_uuid();
  v_clearing_account uuid;
  v_protected_account uuid;
  v_seller_net bigint;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then raise exception 'idempotency_key_required'; end if;
  select * into v_quote from public.booking_quotes where id = p_quote_id for update;
  if not found or v_quote.buyer_id <> v_user or v_quote.expires_at <= now() then raise exception 'quote_unavailable'; end if;
  select * into v_request from public.booking_requests where id = v_quote.request_id for update;
  if not found or v_request.status not in ('requested','offered') then raise exception 'request_unavailable'; end if;
  if exists (select 1 from public.payment_intents where payer_id=v_user and idempotency_key=p_idempotency_key) then
    select booking_id into v_booking_id from public.payment_intents where payer_id=v_user and idempotency_key=p_idempotency_key;
    return jsonb_build_object('ok',true,'booking_id',v_booking_id,'replayed',true);
  end if;

  v_seller_net := greatest(v_quote.total_minor - v_quote.platform_fee_minor, 0);
  insert into public.bookings (id,buyer_id,seller_id,request_id,quote_id,service_id,address_id,household_member_id,scheduled_start,scheduled_end,status,blocks_calendar,subtotal_minor,platform_fee_minor,total_minor,seller_net_minor,currency,price_snapshot,cancellation_policy_snapshot,confirmed_at)
  values (v_booking_id,v_user,v_quote.seller_id,v_request.id,v_quote.id,v_quote.service_id,v_request.address_id,v_request.household_member_id,v_quote.starts_at,v_quote.ends_at,'confirmed',true,v_quote.base_minor+v_quote.travel_minor,v_quote.platform_fee_minor,v_quote.total_minor,v_seller_net,v_quote.currency,jsonb_build_object('base_minor',v_quote.base_minor,'travel_minor',v_quote.travel_minor,'platform_fee_minor',v_quote.platform_fee_minor),v_quote.policy_snapshot,now());
  update public.booking_requests set status='confirmed' where id=v_request.id;

  insert into public.payment_intents (id,booking_id,request_id,payer_id,processor,external_ref,amount_minor,currency,status,idempotency_key,captured_minor,authorized_at,captured_at)
  values (v_payment_id,v_booking_id,v_request.id,v_user,'simulation','sim_'||substr(replace(v_payment_id::text,'-',''),1,18),v_quote.total_minor,v_quote.currency,'captured',p_idempotency_key,v_quote.total_minor,now(),now());

  insert into public.ledger_accounts(account_type,owner_user_id,currency) values('processor_clearing',null,v_quote.currency) on conflict do nothing;
  select id into v_clearing_account from public.ledger_accounts where account_type='processor_clearing' and owner_user_id is null and currency=v_quote.currency;
  insert into public.ledger_accounts (account_type,owner_user_id,currency) values ('protected_funds',null,v_quote.currency) on conflict do nothing;
  select id into v_protected_account from public.ledger_accounts where account_type='protected_funds' and owner_user_id is null and currency=v_quote.currency;
  insert into public.ledger_transactions (id,reference_type,reference_id,event_type,currency,description,idempotency_key)
  values (v_tx_id,'booking',v_booking_id,'payment_captured',v_quote.currency,'Simulated protected payment captured','capture:'||p_idempotency_key);
  insert into public.ledger_entries (transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id)
  values (v_tx_id,v_clearing_account,'debit',v_quote.total_minor,v_booking_id,v_user,v_quote.seller_id),
         (v_tx_id,v_protected_account,'credit',v_quote.total_minor,v_booking_id,v_user,v_quote.seller_id);

  insert into public.booking_participants (booking_id,user_id,role) values (v_booking_id,v_user,'buyer'),(v_booking_id,v_quote.seller_id,'seller');
  insert into public.booking_status_history (booking_id,to_status,actor_id,reason_code,idempotency_key) values (v_booking_id,'confirmed',v_user,'quote_accepted',p_idempotency_key);
  insert into public.conversations (id,conversation_type,booking_id,status) values (v_conversation_id,'booking',v_booking_id,'active');
  insert into public.conversation_members (conversation_id,user_id,role) values (v_conversation_id,v_user,'buyer'),(v_conversation_id,v_quote.seller_id,'seller');
  insert into public.domain_events (aggregate_type,aggregate_id,event_type,payload_redacted) values ('booking',v_booking_id,'booking.confirmed',jsonb_build_object('buyer_id',v_user,'seller_id',v_quote.seller_id));
  insert into public.notification_outbox (recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  values (v_quote.seller_id,'booking_confirmed','booking','high',jsonb_build_object('booking_id',v_booking_id),'booking_confirmed:'||v_booking_id::text||':'||v_quote.seller_id::text),
         (v_user,'payment_captured','payments','normal',jsonb_build_object('booking_id',v_booking_id,'amount_minor',v_quote.total_minor),'payment_captured:'||v_booking_id::text);
  return jsonb_build_object('ok',true,'booking_id',v_booking_id,'payment_intent_id',v_payment_id,'reference',(select reference from public.bookings where id=v_booking_id));
end;
$$;

create or replace function app_private.simulate_conversation_purchase(p_conversation_id uuid,p_expected_amount_minor bigint,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
  v_user uuid := (select auth.uid()); v_existing public.conversation_access_purchases%rowtype;
  v_amount bigint; v_currency char(3); v_id uuid:=gen_random_uuid(); v_payment uuid:=gen_random_uuid();
  v_tx uuid:=gen_random_uuid(); v_debit uuid; v_credit uuid;
begin
  if not app_private.payment_simulation_allowed() then raise exception 'test_payment_not_enabled'; end if;
  if char_length(coalesce(p_idempotency_key,'')) not between 8 and 200 then raise exception 'idempotency_key_required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_idempotency_key,0));
  select * into v_existing from public.conversation_access_purchases where buyer_id=v_user and idempotency_key=p_idempotency_key;
  if found and v_existing.conversation_id<>p_conversation_id then raise exception 'idempotency_key_conflict'; end if;
  perform 1 from public.conversations where id=p_conversation_id for update;
  if not found or not app_private.is_conversation_member(p_conversation_id) or not exists(
    select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=v_user and role='buyer' and left_at is null)
    then raise exception 'conversation_unavailable'; end if;
  if exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.role='seller'
    and not exists(select 1 from public.feature_flags f where f.key='qa_payment_simulation' and f.enabled
      and f.targeting_rules->'user_ids' ? cm.user_id::text)) then raise exception 'test_provider_not_enabled'; end if;
  select * into v_existing from public.conversation_access_purchases where buyer_id=v_user and conversation_id=p_conversation_id;
  if found then return jsonb_build_object('ok',true,'purchase_id',v_existing.id,'replayed',true); end if;
  if not app_private.conversation_is_locked(p_conversation_id) then raise exception 'conversation_not_locked'; end if;
  select fee_minor,currency into v_amount,v_currency from public.job_posting_plans where code='premium' and active;
  if v_amount is null or v_amount<=0 then raise exception 'messaging_price_unavailable'; end if;
  if p_expected_amount_minor is distinct from v_amount then raise exception 'price_changed'; end if;
  insert into public.payment_intents(id,payer_id,processor,external_ref,amount_minor,currency,status,idempotency_key,captured_minor,authorized_at,captured_at)
    values(v_payment,v_user,'simulation','sim_message_'||v_id::text,v_amount,v_currency,'captured','message:'||p_idempotency_key,v_amount,now(),now());
  insert into public.conversation_access_purchases(id,conversation_id,buyer_id,payment_intent_id,amount_minor,currency,idempotency_key)
    values(v_id,p_conversation_id,v_user,v_payment,v_amount,v_currency,p_idempotency_key);
  insert into public.ledger_accounts(account_type,owner_user_id,currency) values('processor_clearing',null,v_currency),('platform_revenue',null,v_currency) on conflict do nothing;
  select id into v_debit from public.ledger_accounts where account_type='processor_clearing' and owner_user_id is null and currency=v_currency;
  select id into v_credit from public.ledger_accounts where account_type='platform_revenue' and owner_user_id is null and currency=v_currency;
  insert into public.ledger_transactions(id,reference_type,reference_id,event_type,currency,description,idempotency_key)
    values(v_tx,'conversation_access',v_id,'payment_captured',v_currency,'TEST ONLY: simulated conversation access','message-capture:'||v_id::text);
  insert into public.ledger_entries(transaction_id,account_id,direction,amount_minor,buyer_id)
    values(v_tx,v_debit,'debit',v_amount,v_user),(v_tx,v_credit,'credit',v_amount,v_user);
  return jsonb_build_object('ok',true,'purchase_id',v_id,'amount_minor',v_amount,'simulation',true);
end; $$;

-- Preserve immutable history. These balanced corrections undo only wallet debits
-- backed by an actual simulated capture; refunds remain buyer-wallet credits.
do $repair$
declare r record; v_tx uuid; v_clearing uuid;
begin
  for r in
    select e.*,t.currency
    from public.ledger_entries e
    join public.ledger_accounts a on a.id=e.account_id
    join public.ledger_transactions t on t.id=e.transaction_id
    where a.account_type='buyer_wallet' and e.direction='debit'
      and a.owner_user_id=e.buyer_id and a.currency=t.currency
      and t.event_type='payment_captured'
      and (
        (t.reference_type='booking' and e.booking_id=t.reference_id and exists(
          select 1 from public.payment_intents p where p.booking_id=t.reference_id
          and p.processor='simulation' and p.payer_id=e.buyer_id
          and p.currency=t.currency and p.captured_minor=e.amount_minor
          and t.idempotency_key='capture:'||p.idempotency_key))
        or (t.reference_type='conversation_access' and exists(
          select 1 from public.conversation_access_purchases c
          join public.payment_intents p on p.id=c.payment_intent_id
          where c.id=t.reference_id and c.buyer_id=e.buyer_id
          and p.processor='simulation' and p.payer_id=e.buyer_id
          and p.currency=t.currency and p.captured_minor=e.amount_minor
          and t.idempotency_key='message-capture:'||c.id::text))
      )
  loop
    v_tx := null;
    insert into public.ledger_accounts(account_type,owner_user_id,currency)
      values('processor_clearing',null,r.currency) on conflict do nothing;
    select id into v_clearing from public.ledger_accounts
      where account_type='processor_clearing' and owner_user_id is null and currency=r.currency;
    insert into public.ledger_transactions(reference_type,reference_id,event_type,currency,description,idempotency_key)
      values('ledger_entry',r.id,'simulation_funding_corrected',r.currency,
        'TEST ONLY: reclassify simulated external payment funding; original entry retained',
        'simulation-funding-correction:'||r.id::text)
      on conflict(idempotency_key) do nothing returning id into v_tx;
    if v_tx is not null then
      insert into public.ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id)
      values(v_tx,v_clearing,'debit',r.amount_minor,r.booking_id,r.buyer_id,r.seller_id),
        (v_tx,r.account_id,'credit',r.amount_minor,r.booking_id,r.buyer_id,r.seller_id);
    end if;
  end loop;
end;
$repair$;

revoke all on function app_private.accept_quote_simulation_core(uuid,text) from public,anon,authenticated;
revoke all on function app_private.simulate_conversation_purchase(uuid,bigint,text) from public,anon;
grant execute on function app_private.simulate_conversation_purchase(uuid,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;

