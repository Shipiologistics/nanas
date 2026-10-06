// Execute the real completion migration in a focused PostgreSQL fixture schema.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const buyer='00000000-0000-0000-0000-000000000001', seller='00000000-0000-0000-0000-000000000002', outsider='00000000-0000-0000-0000-000000000003';
let checks=0, sequence=10;
const check=async(name,fn)=>{await fn();console.log(`PASS ${name}`);checks++;};
const identity=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('qa.uid',$1,false)",[id]);await db.exec(`set role ${role}`);};
const sweep=async(id=null,limit=100)=>(await db.query('select public.auto_complete_bookings($1,$2) result',[limit,id])).rows[0].result;
const transition=async(id,key='qa-complete-key')=>(await db.query("select public.transition_booking($1,'completed','QA',$2) result",[id,key])).rows[0].result;
const fixture=async(hours=25)=>{
  await db.exec('reset role');
  const id=`00000000-0000-0000-0000-${String(sequence++).padStart(12,'0')}`;
  await db.query(`insert into bookings(id,buyer_id,seller_id,status,started_at,ended_at,total_minor,seller_net_minor,currency)
    values($1,$2,$3,'completion_pending',now()-($4+3)*interval '1 hour',now()-$4*interval '1 hour',8100,7500,'BSD')`,[id,buyer,seller,hours]);
  await db.query("insert into payment_intents(booking_id,processor,status,captured_minor,refunded_minor,currency) values($1,'simulation','captured',8100,0,'BSD')",[id]);
  await db.query("insert into ledger_entries(transaction_id,account_id,direction,amount_minor,booking_id) select gen_random_uuid(),id,'credit',8100,$1 from ledger_accounts where account_type='protected_funds'",[id]);
  await db.query("insert into booking_checkins(booking_id,user_id,event_type,method,code_verified) values($1,$2,'check_in','session_code',true),($1,$2,'check_out','authenticated_provider',false)",[id,seller]);
  return id;
};
const booking=async(id)=>(await db.query('select status,version,blocks_calendar,completed_at from bookings where id=$1',[id])).rows[0];
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema app_private;
    grant usage on schema auth,app_private to authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
    create type booking_status as enum('confirmed','in_progress','completion_pending','completed','cancelled','disputed','resolved');
    create type case_priority as enum('normal','high');
    create table bookings(id uuid primary key,buyer_id uuid,seller_id uuid,status booking_status,scheduled_start timestamptz,scheduled_end timestamptz,started_at timestamptz,ended_at timestamptz,completed_at timestamptz,version int default 1,blocks_calendar boolean default true,total_minor bigint,seller_net_minor bigint,currency char(3));
    create table payment_intents(id uuid primary key default gen_random_uuid(),booking_id uuid,processor text,status text,captured_minor bigint,refunded_minor bigint,currency char(3));
    create table booking_checkins(booking_id uuid,user_id uuid,event_type text,method text,code_verified boolean);
    create table booking_status_history(booking_id uuid,from_status booking_status,to_status booking_status,actor_id uuid,reason_code text,source text default 'app',idempotency_key text,created_at timestamptz default now());
    create table service_disputes(booking_id uuid,status text);
    create table seller_profiles(user_id uuid primary key,completed_bookings int default 0);
    insert into seller_profiles values('${seller}',0);
    create table ledger_accounts(id uuid primary key default gen_random_uuid(),account_type text,owner_user_id uuid,currency char(3),unique nulls not distinct(account_type,owner_user_id,currency));
    insert into ledger_accounts(account_type,currency) values('protected_funds','BSD');
    create table ledger_transactions(id uuid primary key,reference_type text,reference_id uuid,event_type text,currency char(3),description text,idempotency_key text unique);
    create table ledger_entries(transaction_id uuid,account_id uuid not null,direction text,amount_minor bigint check(amount_minor>0),booking_id uuid,buyer_id uuid,seller_id uuid);
    create table domain_events(aggregate_type text,aggregate_id uuid,event_type text,payload_redacted jsonb);
    create table notification_outbox(recipient_id uuid,template_key text,category text,priority case_priority,variables_redacted jsonb,dedupe_key text unique);
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261005200000_atomic_booking_completion.sql',import.meta.url),'utf8'));
  await db.exec(`create function public.transition_booking(uuid,booking_status,text,text) returns jsonb language sql security invoker as $$select app_private.transition_booking($1,$2,$3,$4)$$;
    revoke all on function public.transition_booking(uuid,booking_status,text,text),app_private.transition_booking(uuid,booking_status,text,text) from public,anon;
    grant execute on function public.transition_booking(uuid,booking_status,text,text),app_private.transition_booking(uuid,booking_status,text,text) to authenticated;`);

  const legacy=await fixture();
  await check('legacy status-only completion strands all protected funds',async()=>{
    await db.query("update bookings set status='completed',completed_at=now() where id=$1",[legacy]);
    assert.equal((await db.query('select count(*)::int n from ledger_transactions where reference_id=$1',[legacy])).rows[0].n,0);
    assert.equal((await db.query('select version from bookings where id=$1',[legacy])).rows[0].version,1);
    assert.equal((await db.query("select sum(case when direction='credit' then amount_minor else -amount_minor end)::int balance from ledger_entries where booking_id=$1",[legacy])).rows[0].balance,8100);
  });
  const due=await fixture();
  await check('only the service role can run automatic completion',async()=>{
    for(const role of ['anon','authenticated']){await identity(buyer,role);await assert.rejects(sweep(due),/permission denied/);}
    await identity(buyer);await assert.rejects(db.query("select app_private.complete_booking($1,$2,'app','QA','qa-key')",[due,buyer]),/permission denied/);
  });
  await check('due completion atomically releases funds and increments version',async()=>{
    await identity('', 'service_role');assert.deepEqual(await sweep(due),{ok:true,completed:1,skipped:0,failures:[]});
    await db.exec('reset role');const b=await booking(due);assert.equal(b.status,'completed');assert.equal(b.version,2);assert.equal(b.blocks_calendar,false);assert.ok(b.completed_at);
    const amounts=(await db.query("select a.account_type,e.direction,e.amount_minor from ledger_entries e join ledger_accounts a on a.id=e.account_id join ledger_transactions t on t.id=e.transaction_id where t.reference_id=$1 order by a.account_type",[due])).rows;
    assert.deepEqual(amounts.map(x=>[x.account_type,x.direction,x.amount_minor]),[['platform_revenue','credit',600],['protected_funds','debit',8100],['seller_wallet','credit',7500]]);
    assert.equal((await db.query('select completed_bookings from seller_profiles')).rows[0].completed_bookings,1);
  });
  await check('worker retry does not duplicate funds, history or notifications',async()=>{
    await identity('','service_role');assert.equal((await sweep(due)).completed,0);await db.exec('reset role');
    assert.equal((await db.query('select * from booking_status_history where booking_id=$1',[due])).rows.length,1);
    assert.equal((await db.query("select * from notification_outbox where variables_redacted->>'booking_id'=$1",[due])).rows.length,2);
    assert.equal((await db.query('select completed_bookings from seller_profiles')).rows[0].completed_bookings,1);
  });
  const early=await fixture(23);
  await check('less than 24 hours after checkout is not automatically completed',async()=>{await identity('','service_role');assert.equal((await sweep(early)).completed,0);});
  const disputed=await fixture();
  await db.query("insert into service_disputes values($1,'escalated')",[disputed]);
  await check('open or escalated disputes prevent both automatic and buyer completion',async()=>{
    await identity('','service_role');assert.equal((await sweep(disputed)).skipped,1);
    await identity(buyer);await assert.rejects(transition(disputed),/active_dispute/);
  });
  const manual=await fixture(1);
  await check('buyer completion uses the same settlement and replays safely',async()=>{
    await identity(buyer);assert.equal((await transition(manual)).status,'completed');assert.equal((await transition(manual)).replayed,true);
  });
  await check('provider and outsider cannot self-complete or replay buyer completion',async()=>{
    await identity(seller);await assert.rejects(transition(early),/transition_not_allowed/);await assert.rejects(transition(manual),/idempotency_key_conflict/);
    await identity(outsider);await assert.rejects(transition(manual),/booking_access_denied/);
  });
  for(const [label,change,error] of [
    ['unverified attendance',"update booking_checkins set code_verified=false where booking_id=$1",'verified_attendance_required'],
    ['missing capture',"delete from payment_intents where booking_id=$1",'captured_funds_unavailable'],
    ['partly refunded capture',"update payment_intents set refunded_minor=100,status='partially_refunded' where booking_id=$1",'payment_booking_mismatch'],
    ['wrong currency',"update payment_intents set currency='USD' where booking_id=$1",'payment_booking_mismatch'],
    ['real processor',"update payment_intents set processor='real-provider' where booking_id=$1",'payment_processor_not_connected'],
    ['missing protected funds',"delete from ledger_entries where booking_id=$1",'protected_funds_unavailable'],
    ['invalid allocation',"update bookings set seller_net_minor=9000 where id=$1",'invalid_settlement_amounts'],
  ]) {
    const id=await fixture();await db.query(change,[id]);
    await check(`${label} fails closed without a completed booking`,async()=>{
      await identity('','service_role');const result=await sweep(id);assert.equal(result.ok,false);assert.equal(result.failures[0].error,error);
      await db.exec('reset role');assert.equal((await booking(id)).status,'completion_pending');assert.equal((await booking(id)).version,1);
      assert.equal((await db.query('select * from ledger_transactions where reference_id=$1',[id])).rows.length,0);
    });
  }
  const rollback=await fixture();
  await check('a late notification failure rolls back financial and status writes',async()=>{
    await db.exec(`create function reject_notification() returns trigger language plpgsql as $$begin if new.variables_redacted->>'booking_id'='${rollback}' then raise exception 'qa_notification_failure'; end if;return new;end;$$;
      create trigger reject_notification before insert on notification_outbox for each row execute function reject_notification();`);
    await identity('','service_role');const result=await sweep(rollback);assert.equal(result.failures[0].error,'qa_notification_failure');
    await db.exec('reset role');assert.equal((await booking(rollback)).status,'completion_pending');
    assert.equal((await db.query('select * from ledger_transactions where reference_id=$1',[rollback])).rows.length,0);
    assert.equal((await db.query('select * from booking_status_history where booking_id=$1',[rollback])).rows.length,0);
    await db.exec('drop trigger reject_notification on notification_outbox');
  });
  await check('invalid batch sizes are rejected',async()=>{await identity('','service_role');for(const limit of [0,101,null])await assert.rejects(sweep(null,limit),/invalid_batch_limit/);});
  await check('successful release transactions are individually balanced',async()=>{
    await db.exec('reset role');assert.equal((await db.query("select t.id from ledger_transactions t join ledger_entries e on e.transaction_id=t.id group by t.id having sum(case when direction='credit' then amount_minor else -amount_minor end)<>0")).rows.length,0);
  });
  const restrictedManual=await fixture(),restrictedAuto=await fixture();
  await db.exec(`create table profiles(id uuid primary key,account_status text,deleted_at timestamptz);
    insert into profiles values('${buyer}','restricted',null),('${seller}','restricted',null);
    create table booking_requests(id uuid,buyer_id uuid);
    create table booking_quotes(id uuid,buyer_id uuid,seller_id uuid);
    create table conversation_access_purchases(id uuid,buyer_id uuid,conversation_id uuid);
    alter table payment_intents add column payer_id uuid default '${buyer}';`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261006130000_guard_new_marketplace_activity.sql',import.meta.url),'utf8'));
  await identity(buyer);
  await check('restricted participants retain completion and settlement of care already delivered',async()=>{
    assert.equal((await transition(restrictedManual,'qa-restricted-complete')).status,'completed');
    assert.equal((await transition(restrictedManual,'qa-restricted-complete')).replayed,true);
    await identity('','service_role');assert.equal((await sweep(restrictedAuto)).completed,1);
    assert.equal((await sweep(restrictedAuto)).completed,0);
    await db.exec('reset role');
    for(const id of [restrictedManual,restrictedAuto]) {
      assert.equal((await booking(id)).status,'completed');
      assert.equal((await db.query('select count(*)::int n from ledger_transactions where reference_id=$1',[id])).rows[0].n,1);
    }
  });
  console.log(`${checks} completion SQL checks passed.`);
} finally {await db.close();}
