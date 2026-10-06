import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const buyer='00000000-0000-0000-0000-000000000001',outsider='00000000-0000-0000-0000-000000000002',seller='00000000-0000-0000-0000-000000000003';
const service='00000000-0000-0000-0000-000000000010',area='00000000-0000-0000-0000-000000000011',island='00000000-0000-0000-0000-000000000012';
const read=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
let checks=0;const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const identity=async(uid,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('qa.uid',$1,false)",[uid]);await db.exec('set role '+role);};
const payload={service_id:service,service_area_id:area,desired_start:'2099-01-01T14:00:00Z',desired_end:'2099-01-01T17:00:00Z',care_summary:'Fictional QA care request. Not a real job.',category_code:'qa',subcategory_code:'qa',address:{line1:'QA ONLY address',locality:'Nassau',island_id:island},posting_plan_code:'premium',expected_fee_minor:1900,simulated_payment_confirmed:true,idempotency_key:'qa-posting-1'};
const publish=async(p=payload)=>(await db.query('select public.create_care_request($1::jsonb) value',[JSON.stringify(p)])).rows[0].value;
const count=async(table)=>{await db.exec('reset role');return Number((await db.query('select count(*) n from '+table)).rows[0].n);};
try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;
    grant usage on schema auth,app_private to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
    create function app_private.has_role(text) returns boolean language sql stable as $$select $1='buyer' and auth.uid() in('${buyer}'::uuid,'${outsider}'::uuid)$$;
    create function app_private.has_admin_permission(text) returns boolean language sql stable as $$select false$$;
    create function app_private.payment_simulation_allowed() returns boolean language sql stable security definer as $$select auth.uid()='${buyer}'::uuid$$;
    create type booking_mode as enum('scheduled','instant');
    create table profiles(id uuid primary key);insert into profiles values('${buyer}'),('${outsider}'),('${seller}');
    create table services(id uuid primary key,active boolean);insert into services values('${service}',true);
    create table service_areas(id uuid primary key,active boolean);insert into service_areas values('${area}',true);
    create table islands(id uuid primary key,active boolean);insert into islands values('${island}',true);
    create table household_members(id uuid primary key,household_id uuid);create table households(id uuid primary key,owner_user_id uuid);
    create table addresses(id uuid primary key default gen_random_uuid(),owner_user_id uuid,label text,line1_private text,line2_private text,locality text,island_id uuid,postal_code text,access_notes_private text,deleted_at timestamptz);
    create table booking_requests(id uuid primary key,buyer_id uuid,household_member_id uuid,address_id uuid,service_id uuid,service_area_id uuid,mode booking_mode,desired_start timestamptz,desired_end timestamptz,care_summary text,budget_minor bigint,status text default 'requested',expires_at timestamptz);
    create table booking_request_private(request_id uuid primary key,buyer_id uuid,care_requirements_private jsonb,access_notes_private text);
    create table domain_events(aggregate_type text,aggregate_id uuid,event_type text,payload_redacted jsonb);
    create table care_intake_subcategories(category_code text,code text,service_id uuid,active boolean);insert into care_intake_subcategories values('qa','qa','${service}',true);
    create table booking_request_intake_answers(request_id uuid primary key,buyer_id uuid,category_code text,subcategory_code text,private_answers jsonb,public_summary jsonb);
    create table payment_intents(id uuid primary key,request_id uuid references booking_requests(id),payer_id uuid,processor text,external_ref text,amount_minor bigint,currency char(3),status text,idempotency_key text,captured_minor bigint,authorized_at timestamptz,captured_at timestamptz,unique(payer_id,idempotency_key));
    create table ledger_accounts(id uuid primary key default gen_random_uuid(),account_type text,owner_user_id uuid,currency char(3),status text default 'active',unique nulls not distinct(account_type,owner_user_id,currency));
    create table ledger_transactions(id uuid primary key,reference_type text,reference_id uuid,event_type text,currency char(3),description text,idempotency_key text unique);
    create table ledger_entries(transaction_id uuid,account_id uuid not null,direction text,amount_minor bigint check(amount_minor>0),buyer_id uuid);
    create table idempotency_keys(key text,actor_id uuid,scope text,request_hash text,status text,response_code int,response_body_redacted jsonb,expires_at timestamptz,primary key(actor_id,scope,key));
  `);
  const legacy=await read('20260824155632_expanded_care_request_posting_plans.sql');
  await db.exec(legacy.slice(0,legacy.indexOf('create or replace function app_private.admin_upsert_job_posting_plan')));
  await db.exec(await read('20260824160631_enforce_first_posting_allowance.sql'));
  const intake=await read('20260824163431_care_category_intake_templates.sql');
  await db.exec(intake.slice(intake.indexOf('create or replace function app_private.attach_care_request_intake')));
  await identity(outsider);
  await check('reproduces unenrolled premium publishing without any receipt',async()=>{
    await db.exec('begin');const r=await publish();assert.equal(r.ok,true);assert.equal(await count('payment_intents'),0);await db.exec('rollback');
  });
  await db.exec('reset role');await db.exec(await read('20261006000000_record_request_posting_payments.sql'));
  await identity('', 'anon');await check('anonymous publishing is denied',async()=>await assert.rejects(publish(),/permission denied/));
  await identity(seller);await check('provider without buyer role cannot publish',async()=>await assert.rejects(publish(),/buyer_required/));
  await identity(outsider);await check('boolean cannot bypass test enrollment',async()=>await assert.rejects(publish(),/test_payment_not_enabled/));
  await identity(buyer);await check('missing retry key is rejected',async()=>await assert.rejects(publish({...payload,idempotency_key:null}),/idempotency_key_required/));
  await check('stale, forged and missing accepted prices fail closed',async()=>{for(const amount of [null,0,1,1901])await assert.rejects(publish({...payload,expected_fee_minor:amount}),/price_changed/);});
  await check('simulation requires explicit confirmation',async()=>await assert.rejects(publish({...payload,simulated_payment_confirmed:false}),/posting_payment_required/));
  let result;await check('enrolled paid request creates receipt and attaches intake once',async()=>{result=await publish();assert.equal(result.amount_minor,1900);assert.equal(result.simulation,true);assert.ok(result.payment_intent_id);assert.equal(await count('booking_request_intake_answers'),1);});
  await check('capture is balanced clearing-to-platform, not a buyer-wallet debit',async()=>{
    const rows=(await db.query('select a.account_type,e.direction,e.amount_minor from ledger_entries e join ledger_accounts a on a.id=e.account_id order by direction')).rows;
    assert.deepEqual(rows.map(r=>[r.account_type,r.direction,Number(r.amount_minor)]),[['platform_revenue','credit',1900],['processor_clearing','debit',1900]]);
    assert.equal((await db.query('select payment_intent_id from booking_request_publications')).rows[0].payment_intent_id,result.payment_intent_id);
  });
  await identity(buyer);await check('retry returns same request and payment without new writes',async()=>{const r=await publish();assert.equal(r.request_id,result.request_id);assert.equal(r.payment_intent_id,result.payment_intent_id);assert.equal(r.replayed,true);assert.equal(await count('payment_intents'),1);assert.equal(await count('booking_requests'),1);});
  await identity(buyer);await check('same key cannot buy another payload',async()=>await assert.rejects(publish({...payload,care_summary:'Another fictional request'}),/idempotency_key_conflict/));
  await check('direct core and intake attachment are not callable by authenticated users',async()=>{await assert.rejects(db.query('select app_private.create_care_request_core($1::jsonb)',[JSON.stringify(payload)]),/permission denied/);await assert.rejects(db.query("select app_private.attach_care_request_intake('{}','{}')"),/permission denied/);});
  await check('invalid intake rolls back request, address and payment',async()=>{await assert.rejects(publish({...payload,idempotency_key:'bad-intake',subcategory_code:'invalid'}),/invalid_care_category_service/);assert.equal(await count('booking_requests'),1);assert.equal(await count('addresses'),1);assert.equal(await count('payment_intents'),1);});
  await db.exec("update ledger_accounts set status='held' where account_type='platform_revenue'");await identity(buyer);
  await check('unavailable ledger account rolls back publication and receipt',async()=>{await assert.rejects(publish({...payload,idempotency_key:'held-account'}),/posting_accounts_unavailable/);assert.equal(await count('booking_requests'),1);assert.equal(await count('payment_intents'),1);});
  await db.exec("update ledger_accounts set status='active'");await identity(outsider);
  const free={...payload,posting_plan_code:'free',expected_fee_minor:0,simulated_payment_confirmed:false,idempotency_key:'free-post-1'};
  await check('first free posting does not require simulation enrollment or payment',async()=>{const r=await publish(free);assert.equal(r.ok,true);assert.equal(r.payment_intent_id,undefined);assert.equal(await count('payment_intents'),1);});
  await identity(outsider);await check('free retry succeeds but a new-key second free posting is rejected',async()=>{assert.equal((await publish(free)).replayed,true);await assert.rejects(publish({...free,idempotency_key:'free-post-2'}),/free_posting_allowance_used/);});
  await db.exec('reset role');await db.exec("update job_posting_plans set active=false where code='premium'");await identity(buyer);
  await check('saved retry survives later plan withdrawal; new purchases do not',async()=>{assert.equal((await publish()).replayed,true);await assert.rejects(publish({...payload,idempotency_key:'inactive-plan'}),/posting_plan_unavailable/);});
  await db.exec('reset role');
  await db.exec(`alter table profiles add column account_status text not null default 'active';
    alter table profiles add column deleted_at timestamptz;
    create or replace function app_private.has_role(text) returns boolean language sql stable security definer as $$
      select $1='buyer' and auth.uid() in('${buyer}'::uuid,'${outsider}'::uuid)
        and exists(select 1 from public.profiles where id=auth.uid() and account_status in('active','restricted') and deleted_at is null)$$;
    create table booking_quotes(id uuid primary key default gen_random_uuid(),buyer_id uuid,seller_id uuid);
    create table bookings(id uuid primary key default gen_random_uuid(),buyer_id uuid,seller_id uuid,status text default 'confirmed');
    create table conversation_access_purchases(id uuid primary key,buyer_id uuid,conversation_id uuid);
    update job_posting_plans set active=true where code='premium';
    update profiles set account_status='restricted' where id='${buyer}';`);
  await identity(buyer);
  await check('before guard: restricted buyer can create a new paid request and capture',async()=>{
    await db.exec('begin');const r=await publish({...payload,idempotency_key:'restricted-before'});
    assert.equal(r.ok,true);assert.equal(r.amount_minor,1900);assert.equal(await count('payment_intents'),2);
    await db.exec('rollback');
  });
  await db.exec('reset role');await db.exec(await read('20261006130000_guard_new_marketplace_activity.sql'));
  await identity(buyer);
  await check('restricted paid posting fails and rolls back address, intake, receipt and retry record',async()=>{
    const tables=['booking_requests','addresses','booking_request_intake_answers','payment_intents','idempotency_keys','ledger_entries'];
    const before=await Promise.all(tables.map(count));await identity(buyer);
    await assert.rejects(publish({...payload,idempotency_key:'restricted-after'}),/account_new_activity_restricted/);
    assert.deepEqual(await Promise.all(tables.map(count)),before);
  });
  await identity(buyer);
  await check('restricted first-free posting is denied too',async()=>await assert.rejects(publish({...free,idempotency_key:'restricted-free'}),/account_new_activity_restricted/));
  await check('restricted buyer can replay a committed checkout without a new capture',async()=>{
    const r=await publish();assert.equal(r.replayed,true);assert.equal(r.request_id,result.request_id);assert.equal(await count('payment_intents'),1);
  });
  await check('new request, quote, booking and payment are guarded even for privileged inserts',async()=>{
    const rows=[['booking_requests','buyer_id',[buyer]],['booking_quotes','buyer_id,seller_id',[buyer,seller]],['bookings','buyer_id,seller_id',[buyer,seller]],['payment_intents','payer_id',[buyer]]];
    for(const [table,cols,users] of rows)await assert.rejects(db.query(`insert into ${table}(id,${cols}) values(gen_random_uuid(),${users.map((_,i)=>'$'+(i+1)).join(',')})`,users),/account_new_activity_restricted/);
  });
  await db.exec(`update profiles set account_status='active' where id='${buyer}';`);
  await identity(buyer);
  await check('restored active buyer can make a fresh request',async()=>assert.equal((await publish({...payload,idempotency_key:'restored-post'})).ok,true));
  await db.exec('reset role');
  let historicalBooking;
  await check('active participants can create quotes, bookings and payment intents',async()=>{
    await db.query('insert into booking_quotes(buyer_id,seller_id) values($1,$2)',[buyer,seller]);
    historicalBooking=(await db.query('insert into bookings(buyer_id,seller_id) values($1,$2) returning id',[buyer,seller])).rows[0].id;
    await db.query("insert into payment_intents(id,payer_id,idempotency_key) values(gen_random_uuid(),$1,'active-payment')",[buyer]);
  });
  await db.exec(`update profiles set account_status='restricted' where id='${seller}';`);
  await identity(buyer);await db.exec('reset role');
  await check('restricted provider blocks new quotes and bookings without exposing their status',async()=>{
    for(const table of ['booking_quotes','bookings'])await assert.rejects(db.query(`insert into ${table}(buyer_id,seller_id) values($1,$2)`,[buyer,seller]),/marketplace_account_unavailable/);
  });
  await check('participant reassignment cannot introduce a restricted account',async()=>{
    await db.query('insert into bookings(buyer_id,seller_id) values($1,$2)',[buyer,outsider]);
    await assert.rejects(db.query('update bookings set seller_id=$1 where seller_id=$2',[seller,outsider]),/marketplace_account_unavailable/);
    await assert.rejects(db.query('update payment_intents set payer_id=$1 where id=$2',[seller,result.payment_intent_id]),/marketplace_account_unavailable/);
    await assert.rejects(db.query('update booking_requests set buyer_id=$1 where id=$2',[seller,result.request_id]),/marketplace_account_unavailable/);
    await assert.rejects(db.query('update booking_quotes set buyer_id=$1',[seller]),/marketplace_account_unavailable/);
  });
  await db.exec(`update profiles set account_status='restricted' where id='${buyer}';`);
  await check('existing obligation updates and same-participant updates survive restriction',async()=>{
    await db.query("update bookings set buyer_id=buyer_id,seller_id=seller_id,status='cancelled_buyer' where id=$1",[historicalBooking]);
    await db.query("update payment_intents set payer_id=payer_id,status='refunded' where id=$1",[result.payment_intent_id]);
    await db.query("update booking_requests set buyer_id=buyer_id,status='cancelled_buyer' where id=$1",[result.request_id]);
    await db.exec('update booking_quotes set buyer_id=buyer_id,seller_id=seller_id');
    assert.equal((await db.query('select status from bookings where id=$1',[historicalBooking])).rows[0].status,'cancelled_buyer');
  });
  await check('suspended, closed, deleted and absent profiles cannot create new purchases',async()=>{
    for(const state of ['suspended','closed']){
      await db.query('update profiles set account_status=$1 where id=$2',[state,buyer]);
      await assert.rejects(db.query('insert into payment_intents(id,payer_id) values(gen_random_uuid(),$1)',[buyer]),/account_new_activity_restricted/);
    }
    await db.query("update profiles set account_status='active',deleted_at=now() where id=$1",[buyer]);
    await assert.rejects(db.query('insert into payment_intents(id,payer_id) values(gen_random_uuid(),$1)',[buyer]),/account_new_activity_restricted/);
    await assert.rejects(db.exec('insert into payment_intents(id,payer_id) values(gen_random_uuid(),gen_random_uuid())'),/marketplace_account_unavailable/);
    await assert.rejects(db.exec('insert into payment_intents(id,payer_id) values(gen_random_uuid(),null)'),/marketplace_account_unavailable/);
  });
  await identity(buyer);
  await check('private guard cannot be used as an account-status lookup by ordinary callers',async()=>await assert.rejects(db.query('select app_private.require_active_marketplace_accounts($1::uuid[])',[[seller]]),/permission denied/));
  await identity('', 'anon');
  await check('anonymous callers cannot execute the account guard',async()=>await assert.rejects(db.query('select app_private.require_active_marketplace_accounts($1::uuid[])',[[seller]]),/permission denied/));
  console.log(`${checks} request posting SQL checks passed. Isolated PostgreSQL fixture, not full connected UI coverage.`);
}catch(error){console.error(error.message);process.exitCode=1;}finally{await db.close();}
