import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const buyer='00000000-0000-0000-0000-000000000001', seller='00000000-0000-0000-0000-000000000002';
const request='00000000-0000-0000-0000-000000000010', quote='00000000-0000-0000-0000-000000000011', conversation='00000000-0000-0000-0000-000000000012';
const read = name => readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const migration=await read('20261005170000_correct_simulated_payment_funding.sql');
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const scalar=async sql=>(await db.query(sql)).rows[0].value;
try {
  await db.exec(`
    create role anon;create role authenticated;create schema auth;create schema app_private;
    grant usage on schema auth,app_private to authenticated;
    create function auth.uid() returns uuid language sql stable as $$select '${buyer}'::uuid$$;
    create function app_private.has_role(text) returns boolean language sql as $$select $1='buyer'$$;
    create table feature_flags(key text primary key,description text,enabled boolean,targeting_rules jsonb,rollout_percent int);
    insert into feature_flags values('qa_payment_simulation','QA',true,'{"user_ids":["${buyer}","${seller}"]}',0);
    create table booking_requests(id uuid primary key,buyer_id uuid,status text,address_id uuid,household_member_id uuid);
    create table booking_quotes(id uuid primary key,buyer_id uuid,seller_id uuid,request_id uuid,service_id uuid,starts_at timestamptz,ends_at timestamptz,expires_at timestamptz,base_minor bigint,travel_minor bigint,platform_fee_minor bigint,total_minor bigint,currency char(3),policy_snapshot jsonb);
    create table bookings(id uuid primary key,reference text default 'QA',buyer_id uuid,seller_id uuid,request_id uuid,quote_id uuid,service_id uuid,address_id uuid,household_member_id uuid,scheduled_start timestamptz,scheduled_end timestamptz,status text,blocks_calendar boolean,subtotal_minor bigint,platform_fee_minor bigint,total_minor bigint,seller_net_minor bigint,currency char(3),price_snapshot jsonb,cancellation_policy_snapshot jsonb,confirmed_at timestamptz);
    create table payment_intents(id uuid primary key,booking_id uuid,request_id uuid,payer_id uuid,processor text,external_ref text,amount_minor bigint,currency char(3),status text,idempotency_key text,captured_minor bigint,authorized_at timestamptz,captured_at timestamptz);
    create table ledger_accounts(id uuid primary key default gen_random_uuid(),account_type text,owner_user_id uuid,currency char(3),unique nulls not distinct(account_type,owner_user_id,currency));
    create table ledger_transactions(id uuid primary key default gen_random_uuid(),reference_type text,reference_id uuid,event_type text,currency char(3),description text,idempotency_key text unique);
    create table ledger_entries(id uuid primary key default gen_random_uuid(),transaction_id uuid,account_id uuid not null,direction text,amount_minor bigint,booking_id uuid,buyer_id uuid,seller_id uuid);
    create table booking_participants(booking_id uuid,user_id uuid,role text);
    create table booking_status_history(booking_id uuid,to_status text,actor_id uuid,reason_code text,idempotency_key text);
    create table conversations(id uuid primary key,conversation_type text,booking_id uuid,status text);
    create table conversation_members(conversation_id uuid,user_id uuid,role text,left_at timestamptz);
    create table domain_events(aggregate_type text,aggregate_id uuid,event_type text,payload_redacted jsonb);
    create table notification_outbox(recipient_id uuid,template_key text,category text,priority text,variables_redacted jsonb,dedupe_key text);
    create table conversation_access_purchases(id uuid primary key,conversation_id uuid,buyer_id uuid,payment_intent_id uuid,amount_minor bigint,currency char(3),idempotency_key text);
    create table job_posting_plans(code text,active boolean,fee_minor bigint,currency char(3));
    insert into job_posting_plans values('premium',true,1900,'BSD');
    create function app_private.is_conversation_member(uuid) returns boolean language sql stable as $$select exists(select 1 from public.conversation_members where conversation_id=$1 and user_id=auth.uid())$$;
    create function app_private.conversation_is_locked(uuid) returns boolean language sql stable as $$select true$$;
    insert into booking_requests(id,buyer_id,status) values('${request}','${buyer}','offered');
    insert into booking_quotes values('${quote}','${buyer}','${seller}','${request}',gen_random_uuid(),now()+interval '1 day',now()+interval '1 day 3 hours',now()+interval '1 day',7500,0,600,8100,'BSD','{}');
    insert into ledger_accounts(account_type,owner_user_id,currency) values('buyer_wallet','${buyer}','BSD');
    insert into conversations(id,status) values('${conversation}','active');
    insert into conversation_members values('${conversation}','${buyer}','buyer',null),('${conversation}','${seller}','seller',null);
  `);
  const core=(await read('20260824051835_nanas_security_rpc_storage.sql')).match(/create or replace function app_private\.accept_quote_with_simulated_payment\([\s\S]*?\n\$\$;/)[0];
  const message=(await read('20261005130000_enforce_conversation_access.sql')).match(/create function app_private\.simulate_conversation_purchase\([\s\S]*?end; \$\$;/)[0];
  await db.exec(core);
  await db.exec(await read('20261005121000_gate_connected_payment_simulation.sql'));
  await db.exec(message);
  await db.query('select public.accept_quote_with_simulated_payment($1,$2)',[quote,'legacy-booking']);
  await db.query('select app_private.simulate_conversation_purchase($1,1900,$2)',[conversation,'legacy-message']);
  const wallet="select coalesce(sum(case when e.direction='credit' then e.amount_minor else -e.amount_minor end),0)::int value from ledger_entries e join ledger_accounts a on a.id=e.account_id where a.account_type='buyer_wallet'";
  await check('reproduces legacy negative wallet from external simulated payments',async()=>assert.equal(await scalar(wallet),-10000));
  await db.exec(migration);
  await check('append-only correction restores wallet without changing payment receipts',async()=>{assert.equal(await scalar(wallet),0);assert.equal(await scalar('select sum(captured_minor)::int value from payment_intents'),10000);assert.equal(await scalar("select count(*)::int value from ledger_transactions where event_type='simulation_funding_corrected'"),2);});
  await db.exec(migration);
  await check('migration retry does not duplicate corrections',async()=>assert.equal(await scalar("select count(*)::int value from ledger_transactions where event_type='simulation_funding_corrected'"),2));
  await db.exec(`update booking_requests set status='offered';delete from conversation_access_purchases;`);
  await db.query('select public.accept_quote_with_simulated_payment($1,$2)',[quote,'new-booking']);
  await db.query('select app_private.simulate_conversation_purchase($1,1900,$2)',[conversation,'new-message']);
  await check('new booking and message captures use clearing, not customer wallet',async()=>{assert.equal(await scalar(wallet),0);assert.equal(await scalar("select sum(e.amount_minor)::int value from ledger_entries e join ledger_accounts a on a.id=e.account_id where a.account_type='processor_clearing' and e.direction='debit'"),20000);});
  await check('each financial transaction remains balanced',async()=>assert.equal(await scalar("select count(*)::int value from (select transaction_id from ledger_entries group by transaction_id having sum(case when direction='debit' then amount_minor else -amount_minor end)<>0) bad"),0));
  await check('privileged core remains inaccessible to authenticated callers',async()=>assert.equal(await scalar("select has_function_privilege('authenticated','app_private.accept_quote_simulation_core(uuid,text)','execute') value"),false));
  await db.exec(`
    insert into payment_intents(id,booking_id,payer_id,processor,currency,captured_minor,idempotency_key)
      values(gen_random_uuid(),'${request}','${buyer}','real_processor','BSD',500,'real-payment');
    insert into ledger_transactions(id,reference_type,reference_id,event_type,currency,idempotency_key)
      values('${request}','booking','${request}','payment_captured','BSD','capture:real-payment'),
      ('${quote}','booking','${quote}','payment_captured','BSD','unmatched-payment');
    insert into ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id,buyer_id)
      select '${request}',id,'debit',500,'${request}','${buyer}' from ledger_accounts where account_type='buyer_wallet';
    insert into ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id,buyer_id)
      select '${quote}',id,'debit',100,'${quote}','${buyer}' from ledger_accounts where account_type='buyer_wallet';
  `);
  await db.exec(migration);
  await check('repair never reclassifies real-processor or unmatched wallet debits',async()=>{assert.equal(await scalar(wallet),-600);assert.equal(await scalar("select count(*)::int value from ledger_transactions where event_type='simulation_funding_corrected'"),2);});
  await db.exec("update feature_flags set enabled=false");
  await check('simulation enrollment remains mandatory',async()=>await assert.rejects(db.query('select public.accept_quote_with_simulated_payment($1,$2)',[quote,'disabled-booking']),/test_payment_not_enabled/));
  await db.exec(`create table profiles(id uuid primary key,account_status text not null default 'active',deleted_at timestamptz);
    insert into profiles(id) values('${buyer}'),('${seller}');
    update feature_flags set enabled=true;
    update booking_requests set status='offered';
    update profiles set account_status='restricted' where id='${buyer}';`);
  const freshConversation='00000000-0000-0000-0000-000000000013';
  await db.exec(`insert into conversations(id,status) values('${freshConversation}','active');
    insert into conversation_members values('${freshConversation}','${buyer}','buyer',null),('${freshConversation}','${seller}','seller',null);`);
  const accept=key=>db.query('select public.accept_quote_with_simulated_payment($1,$2) value',[quote,key]);
  const unlock=(id,key)=>db.query('select app_private.simulate_conversation_purchase($1,1900,$2) value',[id,key]);
  await check('before guard: restricted buyer can accept quote and buy conversation access',async()=>{
    await db.exec('begin');assert.equal((await accept('restricted-booking-before')).rows[0].value.ok,true);
    assert.equal((await unlock(freshConversation,'restricted-unlock-before')).rows[0].value.ok,true);await db.exec('rollback');
  });
  await db.exec(await read('20261006130000_guard_new_marketplace_activity.sql'));
  const snapshot=async()=> (await db.query(`select
    (select count(*) from bookings) bookings,(select count(*) from payment_intents) payments,
    (select count(*) from conversation_access_purchases) purchases,(select count(*) from ledger_entries) entries,
    (select count(*) from booking_participants) participants,(select count(*) from notification_outbox) notifications,
    (select status from booking_requests where id='${request}') request_status`)).rows[0];
  await check('restricted quote acceptance and unlock roll back all financial and notification writes',async()=>{
    const before=await snapshot();
    await assert.rejects(accept('restricted-booking-after'),/account_new_activity_restricted/);
    await assert.rejects(unlock(freshConversation,'restricted-unlock-after'),/account_new_activity_restricted/);
    assert.deepEqual(await snapshot(),before);
  });
  await check('restricted buyer can retrieve prior booking and conversation receipts without new writes',async()=>{
    const before=await snapshot();assert.equal((await accept('new-booking')).rows[0].value.replayed,true);
    assert.equal((await unlock(conversation,'new-message')).rows[0].value.replayed,true);assert.deepEqual(await snapshot(),before);
  });
  await db.exec(`update profiles set account_status='active' where id='${buyer}';update profiles set account_status='restricted' where id='${seller}';`);
  await check('restricted counterparty prevents purchase of unusable messaging access and booking',async()=>{
    const before=await snapshot();await assert.rejects(accept('restricted-provider-booking'),/marketplace_account_unavailable/);
    await assert.rejects(unlock(freshConversation,'restricted-provider-unlock'),/marketplace_account_unavailable/);
    assert.deepEqual(await snapshot(),before);
  });
  await db.exec(`update profiles set account_status='active' where id='${seller}';`);
  await check('restored participants can complete both actual checkout functions',async()=>{
    const before=await snapshot();assert.equal((await accept('restored-booking')).rows[0].value.ok,true);
    assert.equal((await unlock(freshConversation,'restored-message')).rows[0].value.ok,true);
    const after=await snapshot();assert.equal(Number(after.payments)-Number(before.payments),2);
    assert.equal(Number(after.bookings)-Number(before.bookings),1);assert.equal(Number(after.purchases)-Number(before.purchases),1);
    assert.equal(Number(after.entries)-Number(before.entries),4);
  });
  console.log(`${checks} financial SQL checks passed.`);
} catch (error) { console.error(error.message); process.exitCode=1; } finally { await db.close(); }
