import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite }=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite();
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const buyer=id(1),seller=id(2),outsider=id(3),admin=id(4);
let checks=0;
const check=async(name,fn)=>{await fn();console.log('PASS '+name);checks++;};
const read=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const identity=async user=>{await db.exec('reset role');await db.query("select set_config('qa.uid',$1,false)",[user]);await db.exec('set role authenticated');};
const resolve=async(n,outcome='partial_refund',amount=1000,note='LOCAL QA ONLY resolution')=>(await db.query('select public.admin_resolve_service_dispute($1,$2,$3,$4) result',[id(n+1000),outcome,note,amount])).rows[0].result;
const balance=async(n,type)=>Number((await db.query("select coalesce(sum(case when e.direction='credit' then e.amount_minor else -e.amount_minor end),0) balance from ledger_entries e join ledger_accounts a on a.id=e.account_id where e.booking_id=$1 and a.account_type=$2",[id(n),type])).rows[0].balance);
async function seed(n,{released=false,processor='simulation'}={}) {
  await db.exec('reset role');
  await db.query("insert into bookings(id,buyer_id,seller_id,status,total_minor,seller_net_minor,currency,ended_at,completed_at) values($1,$2,$3,'disputed',8100,7500,'BSD',now(),case when $4 then now() else null end)",[id(n),buyer,seller,released]);
  await db.query("insert into service_disputes(id,booking_id,opened_by,reason_code,summary) values($1,$2,$3,'payment_or_fee','LOCAL QA ONLY')",[id(n+1000),id(n),buyer]);
  await db.query("insert into payment_intents(id,booking_id,payer_id,processor,currency,status,captured_minor) values($1,$2,$3,$4,'BSD','captured',8100)",[id(n+2000),id(n),buyer,processor]);
  await db.query("insert into ledger_transactions(id,reference_type,reference_id,event_type,currency,description,idempotency_key) values($1,'booking',$2,'payment_captured','BSD','QA capture',$3)",[id(n+3000),id(n),'capture:'+n]);
  await db.query("insert into ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id) select $1,id,case when account_type='processor_clearing' then 'debit' else 'credit' end,8100,$2,$3,$4 from ledger_accounts where account_type in ('processor_clearing','protected_funds')",[id(n+3000),id(n),buyer,seller]);
  if(released){
    await db.query("insert into ledger_transactions(id,reference_type,reference_id,event_type,currency,description,idempotency_key) values($1,'booking',$2,'funds_released','BSD','QA release',$3)",[id(n+4000),id(n),'release:'+id(n)]);
    await db.query("insert into ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id) select $1,id,case when account_type='protected_funds' then 'debit' else 'credit' end,case account_type when 'protected_funds' then 8100 when 'seller_wallet' then 7500 else 600 end,$2,$3,$4 from ledger_accounts where account_type in ('protected_funds','seller_wallet','platform_revenue')",[id(n+4000),id(n),buyer,seller]);
  }
  await identity(admin);
}
try{
  await db.exec(`
    create role anon;create role authenticated;create schema auth;create schema app_private;
    grant usage on schema auth,app_private to authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
    create function app_private.has_admin_permission(text) returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
    create type payment_status as enum('captured','partially_refunded','refunded');
    create table bookings(id uuid primary key,buyer_id uuid,seller_id uuid,status text,total_minor bigint,seller_net_minor bigint,currency char(3),blocks_calendar boolean default true,version integer default 1,ended_at timestamptz,completed_at timestamptz);
    create table service_disputes(id uuid primary key default gen_random_uuid(),booking_id uuid,opened_by uuid,reason_code text,summary text,priority text,status text default 'open',assigned_admin_id uuid,resolution_code text,resolution_note text,resolved_at timestamptz,updated_at timestamptz);
    create table payment_intents(id uuid primary key,booking_id uuid,payer_id uuid,processor text,currency char(3),status payment_status,captured_minor bigint,refunded_minor bigint default 0,created_at timestamptz default now(),updated_at timestamptz);
    create table ledger_accounts(id uuid primary key default gen_random_uuid(),account_type text,owner_user_id uuid,currency char(3),unique nulls not distinct(account_type,owner_user_id,currency));
    insert into ledger_accounts(account_type,owner_user_id,currency) values('processor_clearing',null,'BSD'),('protected_funds',null,'BSD'),('platform_revenue',null,'BSD'),('seller_wallet','${seller}','BSD'),('buyer_wallet','${buyer}','BSD');
    create table ledger_transactions(id uuid primary key default gen_random_uuid(),reference_type text,reference_id uuid,event_type text,currency char(3),description text,idempotency_key text unique);
    create table ledger_entries(transaction_id uuid,account_id uuid not null,direction text,amount_minor bigint check(amount_minor>0),booking_id uuid,buyer_id uuid,seller_id uuid);
    create table refunds(booking_id uuid,payment_intent_id uuid,amount_minor bigint,currency char(3),reason text,status payment_status,requested_by uuid,approved_by uuid,processed_at timestamptz);
    alter table refunds enable row level security;grant select on refunds,bookings to authenticated;
    create table seller_profiles(user_id uuid primary key,completed_bookings integer default 0);insert into seller_profiles(user_id) values('${seller}');
    create table booking_status_history(booking_id uuid,from_status text,to_status text,actor_id uuid,reason_code text);
    create table case_events(dispute_id uuid,actor_id uuid,event_type text,note_redacted text,metadata_redacted jsonb,created_at timestamptz default now());
    create table domain_events(aggregate_type text,aggregate_id uuid,event_type text,payload_redacted jsonb);
    create table admin_audit_logs(actor_id uuid,action text,target_type text,target_id uuid,before_redacted jsonb,after_redacted jsonb,reason text);
    create table notification_outbox(recipient_id uuid,template_key text,category text,priority text,variables_redacted jsonb,dedupe_key text unique);
  `);
  await db.exec(await read('20260824075936_admin_dispute_resolution.sql'));
  await seed(10);await resolve(10);await db.exec('reset role');
  await check('reproduces stranded protected funds in legacy partial-refund path',async()=>assert.equal(await balance(10,'protected_funds'),7100));
  await db.exec(await read('20261005180000_settle_dispute_balances.sql'));
  await seed(20);await db.exec('reset role');
  await db.query('delete from ledger_entries where booking_id=$1',[id(20)]);
  await identity(admin);await resolve(20);await db.exec('reset role');
  await check('reproduces settlement without captured ledger funds',async()=>assert.equal(await balance(20,'protected_funds'),-8100));
  await db.exec(await read('20261005220000_validate_dispute_settlement.sql'));
  await seed(11);await resolve(11);await db.exec('reset role');
  await check('partial refund before release settles all remaining funds',async()=>{assert.equal(await balance(11,'protected_funds'),0);assert.equal(await balance(11,'buyer_wallet'),1000);assert.equal(await balance(11,'seller_wallet'),6500);assert.equal(await balance(11,'platform_revenue'),600);});
  await identity(admin);
  await check('identical retry returns authoritative outcome and amount',async()=>{const r=await resolve(11);assert.equal(r.replayed,true);assert.equal(r.refund_minor,1000);assert.equal(r.resolution_code,'partial_refund');});
  await check('changed final outcome or refund is rejected',async()=>{await assert.rejects(resolve(11,'full_refund'),/dispute_already_resolved/);await assert.rejects(resolve(11,'partial_refund',1100),/dispute_already_resolved/);});
  await seed(12,{released:true});await resolve(12);await db.exec('reset role');
  await check('post-completion partial refund debits seller without a second release',async()=>{assert.equal(await balance(12,'buyer_wallet'),1000);assert.equal(await balance(12,'seller_wallet'),6500);assert.equal(await balance(12,'protected_funds'),0);assert.equal((await db.query("select count(*)::int n from ledger_transactions where reference_id=$1 and event_type='funds_released'",[id(12)])).rows[0].n,1);});
  await seed(13);await resolve(13,'full_refund');await db.exec('reset role');
  await check('full refund before release drains protection without paying provider',async()=>{assert.equal(await balance(13,'protected_funds'),0);assert.equal(await balance(13,'buyer_wallet'),8100);assert.equal(await balance(13,'seller_wallet'),0);});
  await seed(14,{released:true});await resolve(14,'full_refund');await db.exec('reset role');
  await check('full refund after release reverses provider and platform',async()=>{assert.equal(await balance(14,'buyer_wallet'),8100);assert.equal(await balance(14,'seller_wallet'),0);assert.equal(await balance(14,'platform_revenue'),0);});
  await seed(15);await resolve(15,'release_funds');await db.exec('reset role');
  await check('release outcome settles original provider and platform amounts',async()=>{assert.equal(await balance(15,'protected_funds'),0);assert.equal(await balance(15,'seller_wallet'),7500);assert.equal(await balance(15,'platform_revenue'),600);});
  await seed(16);await resolve(16,'escalate');
  await check('escalation retry is idempotent and reports escalated status',async()=>{const r=await resolve(16,'escalate');assert.equal(r.status,'escalated');assert.equal(r.replayed,true);});
  await db.exec('reset role');
  await check('escalation leaves money untouched and creates one audit event',async()=>{assert.equal(await balance(16,'protected_funds'),8100);assert.equal((await db.query("select count(*)::int n from case_events where dispute_id=$1",[id(1016)])).rows[0].n,1);});
  await seed(17,{processor:'real_processor'});
  await check('real-money refund is blocked without a processor adapter',async()=>await assert.rejects(resolve(17),/refund_processor_not_connected/));
  await seed(18);
  await check('invalid or excess refund and null outcome fail closed',async()=>{await assert.rejects(resolve(18,'partial_refund',9000),/refund_amount_unavailable/);await assert.rejects(resolve(18,'partial_refund',0),/partial_refund_amount_required/);await assert.rejects(resolve(18,null),/invalid_resolution_code/);});
  for(const user of [buyer,seller,outsider]){await identity(user);await check('non-admin '+user.slice(-1)+' cannot resolve',async()=>await assert.rejects(resolve(18),/permission_denied/));}
  await identity(buyer);
  await check('buyer can read admin-approved refund',async()=>assert.equal((await db.query('select * from refunds where booking_id=$1',[id(12)])).rows.length,1));
  await identity(outsider);
  await check('outsider cannot read another booking refund',async()=>assert.equal((await db.query('select * from refunds where booking_id=$1',[id(12)])).rows.length,0));
  await identity(buyer);
  await check('opening an existing escalated case returns saved status without new event',async()=>{const r=(await db.query('select app_private.open_service_dispute($1,$2,$3) result',[id(16),'payment_or_fee','LOCAL QA retry'])).rows[0].result;assert.equal(r.status,'escalated');assert.equal(r.replayed,true);});
  await db.exec('reset role');
  await check('all financial transactions balance and refunds notify both parties',async()=>{assert.equal((await db.query("select transaction_id from ledger_entries group by transaction_id having sum(case when direction='debit' then amount_minor else -amount_minor end)<>0")).rows.length,0);assert.equal((await db.query("select count(*)::int n from notification_outbox where variables_redacted->>'dispute_id'=$1",[id(1012)])).rows[0].n,2);});
  const corruptions=[
    ['missing protection',false,"delete from ledger_entries where booking_id=$1",/booking_ledger_mismatch/],
    ['duplicate captures',false,"insert into payment_intents(id,booking_id,payer_id,processor,currency,status,captured_minor) select gen_random_uuid(),booking_id,payer_id,processor,currency,status,captured_minor from payment_intents where booking_id=$1",/ambiguous_booking_capture/],
    ['wrong payer',false,`update payment_intents set payer_id='${outsider}' where booking_id=$1`,/payment_booking_mismatch/],
    ['wrong currency',false,"update payment_intents set currency='USD' where booking_id=$1",/payment_booking_mismatch/],
    ['invalid provider allocation',false,"update bookings set seller_net_minor=9000 where id=$1",/payment_booking_mismatch/],
    ['inconsistent refund metadata',false,"update payment_intents set refunded_minor=100 where booking_id=$1",/payment_booking_mismatch/],
    ['release without ledger entries',true,"delete from ledger_entries where transaction_id in (select id from ledger_transactions where reference_id=$1 and event_type='funds_released')",/booking_ledger_mismatch/],
    ['missing provider release credit',true,"delete from ledger_entries where booking_id=$1 and account_id in(select id from ledger_accounts where account_type='seller_wallet')",/booking_ledger_mismatch/],
    ['duplicate releases',true,"insert into ledger_transactions(reference_type,reference_id,event_type,currency) values('booking',$1,'funds_released','BSD')",/ambiguous_booking_release/],
  ];
  for(const [index,[label,released,mutation,error]] of corruptions.entries()){
    const n=30+index;await seed(n,{released});await db.exec('reset role');await db.query(mutation,[id(n)]);await identity(admin);
    await check(label+' rejects settlement without partial writes',async()=>{
      for(const outcome of ['partial_refund','full_refund','release_funds','no_action','warning'])await assert.rejects(resolve(n,outcome),error);
      await db.exec('reset role');
      assert.equal((await db.query('select status from bookings where id=$1',[id(n)])).rows[0].status,'disputed');
      assert.equal((await db.query('select status from service_disputes where id=$1',[id(n+1000)])).rows[0].status,'open');
      assert.equal((await db.query('select * from refunds where booking_id=$1',[id(n)])).rows.length,0);
      assert.equal((await db.query('select * from case_events where dispute_id=$1',[id(n+1000)])).rows.length,0);
      assert.equal((await db.query("select * from ledger_transactions where reference_type='service_dispute' and reference_id=$1",[id(n+1000)])).rows.length,0);
    });
  }
  await identity(admin);
  await check('inconsistent records can still be escalated without financial writes',async()=>{assert.equal((await resolve(30,'escalate')).status,'escalated');});
  await seed(50,{released:true});await db.exec('reset role');
  await db.query("update payment_intents set status='partially_refunded',refunded_minor=1000 where booking_id=$1",[id(50)]);
  await db.query("insert into ledger_transactions(id,reference_type,reference_id,event_type,currency) values($1,'booking',$2,'previous_refund','BSD')",[id(5050),id(50)]);
  await db.query("insert into ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id) select $1,id,case when account_type='seller_wallet' then 'debit' else 'credit' end,1000,$2 from ledger_accounts where account_type in ('seller_wallet','buyer_wallet')",[id(5050),id(50)]);
  await identity(admin);
  await check('consistent previous refund permits settling only the remainder',async()=>{
    assert.equal((await resolve(50,'full_refund')).refund_minor,7100);await db.exec('reset role');
    assert.equal(await balance(50,'buyer_wallet'),8100);assert.equal(await balance(50,'seller_wallet'),0);assert.equal(await balance(50,'platform_revenue'),0);
  });
  await seed(60);await db.exec('reset role');
  await db.exec(`create table profiles(id uuid primary key,account_status text,deleted_at timestamptz);
    insert into profiles values('${buyer}','restricted',null),('${seller}','restricted',null);
    create table booking_requests(id uuid,buyer_id uuid);
    create table booking_quotes(id uuid,buyer_id uuid,seller_id uuid);
    create table conversation_access_purchases(id uuid,buyer_id uuid,conversation_id uuid);`);
  await db.exec(await read('20261006130000_guard_new_marketplace_activity.sql'));
  await identity(admin);
  await check('restricted participants can still receive an audited existing-dispute refund',async()=>{
    assert.equal((await resolve(60,'full_refund')).refund_minor,8100);
    assert.equal((await resolve(60,'full_refund')).replayed,true);await db.exec('reset role');
    assert.equal(await balance(60,'protected_funds'),0);assert.equal(await balance(60,'buyer_wallet'),8100);
    assert.equal((await db.query('select count(*)::int n from refunds where booking_id=$1',[id(60)])).rows[0].n,1);
  });
  console.log(`${checks} dispute SQL checks passed.`);
}catch(error){console.error(error.message);process.exitCode=1;}finally{await db.close();}
