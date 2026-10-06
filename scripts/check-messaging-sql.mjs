// Executes the real migration against a focused PostgreSQL fixture schema.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const buyer="00000000-0000-0000-0000-000000000001", seller="00000000-0000-0000-0000-000000000002", outsider="00000000-0000-0000-0000-000000000003";
const conversation="00000000-0000-0000-0000-000000000010", other="00000000-0000-0000-0000-000000000011";
let checks=0;
const check=async(name,fn)=>{await fn(); console.log(`PASS ${name}`); checks++;};
const identity=async(id)=>{await db.exec("reset role");await db.query("select set_config('qa.uid',$1,false)",[id]);await db.exec("set role authenticated");};
const purchase=(amount=1900,key="qa-message-purchase")=>db.query("select public.simulate_conversation_purchase($1,$2,$3) as result",[conversation,amount,key]);
const state=async()=> (await db.query("select public.conversation_access_state() as result")).rows[0].result;
try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema app_private;
    grant usage on schema auth,app_private to authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('qa.uid',true),'')::uuid $$;
    create table profiles(id uuid primary key);
    insert into profiles values('${buyer}'),('${seller}'),('${outsider}');
    create table conversations(id uuid primary key,status text);
    insert into conversations values('${conversation}','active'),('${other}','active');
    create table conversation_members(conversation_id uuid,user_id uuid,role text,left_at timestamptz,last_read_at timestamptz);
    insert into conversation_members values('${conversation}','${buyer}','buyer',null,null),('${conversation}','${seller}','seller',null,null);
    create table messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender_id uuid,message_type text default 'text',body text,deleted_at timestamptz,created_at timestamptz default now());
    alter table messages enable row level security;
    grant select,insert on messages to authenticated;
    grant update(last_read_at) on conversation_members to authenticated;
    create function app_private.is_conversation_member(uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from public.conversation_members where conversation_id=$1 and user_id=auth.uid() and left_at is null) $$;
    create policy messages_members_only on messages for select to authenticated using(app_private.is_conversation_member(conversation_id));
    create policy messages_member_insert on messages for insert to authenticated with check(sender_id=auth.uid() and app_private.is_conversation_member(conversation_id));
    create table blocks(blocker_user_id uuid,blocked_user_id uuid);
    create table feature_flags(key text,enabled boolean,targeting_rules jsonb);
    insert into feature_flags values('qa_payment_simulation',true,'{"user_ids":["${buyer}","${seller}"]}');
    create function app_private.payment_simulation_allowed() returns boolean language sql stable security definer as $$ select exists(select 1 from public.feature_flags where enabled and targeting_rules->'user_ids' ? auth.uid()::text) and auth.uid()='${buyer}'::uuid $$;
    create table job_posting_plans(code text,active boolean,fee_minor bigint,currency char(3));
    insert into job_posting_plans values('premium',true,1900,'BSD');
    create table payment_intents(id uuid primary key,payer_id uuid,processor text,external_ref text,amount_minor bigint,currency char(3),status text,idempotency_key text,captured_minor bigint,authorized_at timestamptz,captured_at timestamptz,unique(payer_id,idempotency_key));
    create table ledger_accounts(id uuid primary key default gen_random_uuid(),account_type text,owner_user_id uuid,currency char(3),unique nulls not distinct(account_type,owner_user_id,currency));
    create table ledger_transactions(id uuid primary key,reference_type text,reference_id uuid,event_type text,currency char(3),description text,idempotency_key text unique);
    create table ledger_entries(transaction_id uuid,account_id uuid,direction text,amount_minor bigint,buyer_id uuid);
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261005130000_enforce_conversation_access.sql',import.meta.url),'utf8'));
  await identity(buyer);
  await check('buyer can send first message before a provider reply',async()=>{
    assert.equal((await state())[0].locked,false);
    await db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'QA buyer')",[conversation,buyer]);
  });
  await identity(seller);
  await check('provider reads and replies to the buyer',async()=>{
    assert.equal((await db.query('select * from messages')).rows.length,1);
    await db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'QA provider reply')",[conversation,seller]);
  });
  await identity(buyer);
  await check('locked reply is withheld by SELECT, metadata contains no body',async()=>{
    assert.deepEqual((await db.query('select body from messages')).rows,[{body:'QA buyer'}]);
    const rows=await state();assert.equal(rows[0].locked,true);assert.equal(rows[0].unread_count,1);assert.ok(!JSON.stringify(rows).includes('QA provider reply'));
  });
  await check('locked buyer cannot send, self-grant access or mark reply read',async()=>{
    await assert.rejects(db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'bypass')",[conversation,buyer]),/row-level security/);
    await assert.rejects(db.query('select public.mark_conversation_read($1)',[conversation]),/conversation_locked/);
    await assert.rejects(db.query('update conversation_members set last_read_at=now()'),/permission denied/);
    await assert.rejects(db.query('insert into conversation_access_purchases(conversation_id,buyer_id) values($1,$2)',[conversation,buyer]),/permission denied/);
  });
  await identity(outsider);
  await check('outsider cannot read, send or purchase',async()=>{
    assert.equal((await db.query('select * from messages')).rows.length,0);assert.deepEqual(await state(),[]);
    await assert.rejects(db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'bypass')",[conversation,outsider]),/row-level security/);
    await assert.rejects(purchase(),/test_payment_not_enabled/);
  });
  await identity(buyer);
  await check('stale or forged checkout amount is rejected',async()=>{await assert.rejects(purchase(1),/price_changed/);});
  await db.exec(`reset role;update feature_flags set targeting_rules='{"user_ids":["${buyer}"]}';`);
  await identity(buyer);
  await check('provider must also be enrolled for a simulated purchase',async()=>{await assert.rejects(purchase(),/test_provider_not_enabled/);});
  await db.exec(`reset role;update feature_flags set targeting_rules='{"user_ids":["${buyer}","${seller}"]}';`);
  await identity(buyer);
  await check('purchase unlocks both bodies and retries do not charge twice',async()=>{
    const first=(await purchase()).rows[0].result; const again=(await purchase()).rows[0].result;
    assert.equal(first.purchase_id,again.purchase_id);assert.equal(again.replayed,true);
    assert.equal((await db.query('select * from messages')).rows.length,2);assert.equal((await state())[0].locked,false);
    await assert.rejects(db.query("select public.simulate_conversation_purchase($1,1900,'qa-message-purchase')",[other]),/idempotency_key_conflict/);
    await db.exec('reset role');
    assert.equal((await db.query('select * from payment_intents')).rows.length,1);
    assert.equal(Number((await db.query("select sum(case when direction='debit' then amount_minor else -amount_minor end) as balance from ledger_entries")).rows[0].balance),0);
    await identity(buyer);
  });
  await check('server-timed read acknowledgement clears unread',async()=>{
    await db.query('select public.mark_conversation_read($1)',[conversation]);
    assert.equal((await state())[0].unread_count,0);assert.ok((await state())[0].last_read_at);
  });
  await identity(seller);
  await check('sender sees recipient read receipt and cannot spoof another sender',async()=>{
    assert.ok((await state())[0].other_last_read_at);
    await assert.rejects(db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'spoof')",[conversation,buyer]),/row-level security/);
    await assert.rejects(db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'   ')",[conversation,seller]),/row-level security/);
  });
  await db.exec(`reset role;insert into blocks values('${buyer}','${seller}');`);
  await identity(seller);
  await check('blocked participants cannot send new messages',async()=>{
    assert.equal((await state())[0].can_send,false);
    await assert.rejects(db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'blocked')",[conversation,seller]),/row-level security/);
  });
  await db.exec("reset role;delete from blocks;update conversations set status='closed';");
  await identity(seller);
  await check('closed conversations retain history but disallow sending',async()=>{
    assert.equal((await db.query('select * from messages')).rows.length,2);
    await assert.rejects(db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'closed')",[conversation,seller]),/row-level security/);
  });
  await db.exec('reset role');
  await check('anonymous access to privileged routines is denied',async()=>{
    assert.equal((await db.query("select has_function_privilege('anon','public.simulate_conversation_purchase(uuid,bigint,text)','execute') as allowed")).rows[0].allowed,false);
  });
  await db.exec(`reset role;
    update conversations set status='active'; alter table conversations add last_message_at timestamptz;
    alter table conversation_members add muted boolean default false;
    create function app_private.safe_uuid(text) returns uuid language plpgsql immutable as $$ begin return $1::uuid; exception when invalid_text_representation then return null; end; $$;
    create table user_roles(user_id uuid,role text,revoked_at timestamptz);
    insert into user_roles values('${buyer}','buyer',null),('${seller}','buyer',null),('${seller}','seller',null);
    create table bookings(id uuid,buyer_id uuid,seller_id uuid);
    create table notification_preferences(user_id uuid,event_category text,in_app boolean);
    create table notification_outbox(id uuid primary key default gen_random_uuid(),recipient_id uuid,template_key text,category text,priority text,variables_redacted jsonb,dedupe_key text unique,status text default 'queued');
    create table notifications(id uuid primary key,recipient_id uuid,event_type text,category text,title text,body text,deep_link text,related_type text,related_id uuid,read_at timestamptz);
    create table notification_deliveries(id uuid primary key,outbox_id uuid,notification_id uuid,channel text,vendor text,status text,attempts int,delivered_at timestamptz);
    alter table notifications enable row level security;
    grant select on notifications to authenticated;
    grant update(read_at) on notifications to authenticated;
    create policy own_notifications on notifications for all to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261005140000_transactional_in_app_notifications.sql',import.meta.url),'utf8'));
  await identity(buyer);
  await check('message atomically queues generic in-app notification for other party',async()=>{
    await db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'PRIVATE TEXT MUST NOT LEAK')",[conversation,buyer]);
    assert.equal((await db.query('select * from notifications')).rows.length,0);
    await identity(seller);
    const n=(await db.query('select * from notifications')).rows[0];
    assert.equal(n.deep_link,`/app/seller/messages/${conversation}`);assert.equal(n.body,'You have a new secure message.');
    assert.ok(!JSON.stringify(n).includes('PRIVATE TEXT'));
    await db.exec('reset role');
    assert.equal((await db.query('select status from notification_outbox')).rows[0].status,'queued');
    assert.deepEqual((await db.query('select channel,status from notification_deliveries')).rows,[{channel:'in_app',status:'delivered'}]);
  });
  await check('replayed in-app delivery neither duplicates nor resets read state',async()=>{
    const id=(await db.query('select id from notifications')).rows[0].id;
    await identity(seller);await db.query('update notifications set read_at=now() where id=$1',[id]);
    await db.exec('reset role');await db.query('select app_private.deliver_in_app_notification($1)',[id]);
    assert.equal((await db.query('select * from notifications')).rows.length,1);
    assert.ok((await db.query('select read_at from notifications')).rows[0].read_at);
  });
  await check('opt-out suppresses in-app delivery but preserves external queue',async()=>{
    await db.exec(`insert into notification_preferences values('${seller}','messages',false);`);
    await identity(buyer);await db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'muted preference test')",[conversation,buyer]);
    await db.exec('reset role');assert.equal((await db.query('select * from notifications')).rows.length,1);
    assert.equal((await db.query('select * from notification_outbox')).rows.length,2);
  });
  await check('muted member receives no new notification queue item',async()=>{
    await db.exec(`update conversation_members set muted=true where user_id='${seller}';`);
    await identity(buyer);await db.query("insert into messages(conversation_id,sender_id,body) values($1,$2,'muted thread test')",[conversation,buyer]);
    await db.exec('reset role');assert.equal((await db.query('select * from notification_outbox')).rows.length,2);
  });
  await check('outbox transaction rollback leaves no orphan notification',async()=>{
    await db.exec(`begin;insert into notification_outbox(recipient_id,template_key,category,variables_redacted,dedupe_key) values('${buyer}','quote_received','booking','{}','rollback-only');rollback;`);
    assert.equal((await db.query('select * from notifications')).rows.length,1);
  });
  await identity(outsider);
  await check('outsider cannot read notifications or invoke delivery helper',async()=>{
    assert.equal((await db.query('select * from notifications')).rows.length,0);
    await assert.rejects(db.query('select app_private.deliver_in_app_notification($1)',[conversation]),/permission denied/);
  });
  await db.exec('reset role');
  await check('cancellation notices identify the event, retain read state and route both parties', async () => {
    await db.exec(`insert into bookings values('${other}','${buyer}','${seller}');
      insert into notification_outbox(recipient_id,template_key,category,variables_redacted,dedupe_key)
      values('${buyer}','booking_cancelled','booking','{"booking_id":"${other}"}','cancel-old');
      update notifications set read_at=now() where event_type='booking_cancelled';`);
    const before=(await db.query("select id,read_at from notifications where event_type='booking_cancelled'")).rows[0];
    const migration=await readFile(new URL('../supabase/migrations/20261005191000_describe_cancellation_notifications.sql',import.meta.url),'utf8');
    await db.exec(migration);
    await db.exec(`insert into notification_outbox(recipient_id,template_key,category,variables_redacted,dedupe_key)
      values('${seller}','booking_cancelled','booking','{"booking_id":"${other}"}','cancel-new');`);
    const rows=(await db.query("select id,body,deep_link,read_at from notifications where event_type='booking_cancelled' order by deep_link")).rows;
    assert.equal(rows.length,2);
    assert.equal(rows[0].id,before.id); assert.deepEqual(rows[0].read_at,before.read_at);
    assert.deepEqual(rows.map(r=>r.deep_link),['/app/buyer/bookings','/app/seller/bookings']);
    assert.ok(rows.every(r=>r.body.includes('booking was cancelled')));
    await db.exec(migration);
    assert.equal((await db.query("select count(*)::int n from notifications where event_type='booking_cancelled'")).rows[0].n,2);
  });
  await db.exec(await readFile(new URL('../supabase/migrations/20261006090000_message_read_watermark.sql',import.meta.url),'utf8'));
  const oldMessage='00000000-0000-0000-0000-000000000090',newMessage='00000000-0000-0000-0000-000000000091';
  await db.exec(`insert into messages(id,conversation_id,sender_id,body,created_at) values('${oldMessage}','${conversation}','${seller}','loaded history','2026-01-01T00:00:00Z'),('${newMessage}','${conversation}','${seller}','not loaded yet','2026-01-02T00:00:00Z');update conversation_members set last_read_at=null where user_id='${buyer}';`);
  await identity(buyer);
  await check('read watermark stops at the loaded message, leaving later replies unread',async()=>{
    await db.query('select public.mark_conversation_read_through($1,$2)',[conversation,oldMessage]);
    const entry=(await state()).find(r=>r.conversation_id===conversation);
    assert.equal(new Date(entry.last_read_at).toISOString(),'2026-01-01T00:00:00.000Z');assert.ok(entry.unread_count>=1);
  });
  await check('replaying older history cannot move read state backwards',async()=>{
    await db.query('select public.mark_conversation_read_through($1,$2)',[conversation,newMessage]);
    await db.query('select public.mark_conversation_read_through($1,$2)',[conversation,oldMessage]);
    assert.equal(new Date((await state()).find(r=>r.conversation_id===conversation).last_read_at).toISOString(),'2026-01-02T00:00:00.000Z');
  });
  await check('read watermark rejects absent and wrong-conversation message IDs',async()=>{
    await assert.rejects(db.query('select public.mark_conversation_read_through($1,$2)',[conversation,other]),/message_unavailable/);
    await assert.rejects(db.query('select public.mark_conversation_read_through($1,$2)',[other,oldMessage]),/conversation_unavailable/);
  });
  await identity(outsider);
  await check('unrelated accounts cannot acknowledge private conversation history',async()=>{
    await assert.rejects(db.query('select public.mark_conversation_read_through($1,$2)',[conversation,oldMessage]),/conversation_unavailable/);
  });
  await identity(buyer);
  await check('before retirement: old RPC still clears messages beyond the fetched watermark',async()=>{
    await db.exec('begin');await db.query('select public.mark_conversation_read($1)',[conversation]);
    assert.equal((await state()).find(r=>r.conversation_id===conversation).unread_count,0);await db.exec('rollback');
  });
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../supabase/migrations/20261006140000_retire_unbounded_read_receipts.sql',import.meta.url),'utf8'));
  await identity(buyer);
  await check('both old receipt entry points are denied to authenticated clients',async()=>{
    for(const schema of ['public','app_private'])await assert.rejects(db.query(`select ${schema}.mark_conversation_read($1)`,[conversation]),/permission denied/);
    await assert.rejects(db.query('update conversation_members set last_read_at=now() where conversation_id=$1',[conversation]),/permission denied/);
  });
  await db.exec('reset role');
  await check('legacy owner call fails explicitly rather than inventing a read-through message',async()=>{
    await assert.rejects(db.query('select public.mark_conversation_read($1)',[conversation]),/read_message_id_required/);
    assert.equal((await db.query("select has_function_privilege('anon','public.mark_conversation_read(uuid)','execute') value")).rows[0].value,false);
  });
  await identity(buyer);
  await check('bounded acknowledgement remains available after retiring the legacy RPC',async()=>{
    const receipt=(await db.query('select public.mark_conversation_read_through($1,$2) value',[conversation,newMessage])).rows[0].value;
    assert.equal(receipt.ok,true);assert.equal(new Date(receipt.read_through).toISOString(),'2026-01-02T00:00:00.000Z');
    assert.ok((await state()).find(r=>r.conversation_id===conversation).unread_count>0);
  });
  await db.exec(`reset role;alter table messages add sender_nonce text default gen_random_uuid()::text;
    alter table messages add unique(sender_id,sender_nonce);
    update conversation_members set muted=false;delete from notification_preferences;`);
  const queued=async()=>Number((await db.query('select count(*)::int value from notification_outbox')).rows[0].value);
  await check('duplicate message nonce leaves one transactional notification and unchanged conversation timestamp',async()=>{
    const before=await queued();await identity(buyer);
    await db.query("insert into messages(conversation_id,sender_id,body,sender_nonce) values($1,$2,'retry QA','same-qa-nonce')",[conversation,buyer]);
    await db.exec('reset role');const time=(await db.query('select last_message_at from conversations where id=$1',[conversation])).rows[0].last_message_at;
    assert.equal(await queued(),before+1);await identity(buyer);
    await assert.rejects(db.query("insert into messages(conversation_id,sender_id,body,sender_nonce) values($1,$2,'retry QA','same-qa-nonce')",[conversation,buyer]),/duplicate key/);
    await db.exec('reset role');assert.equal(await queued(),before+1);
    assert.deepEqual((await db.query('select last_message_at from conversations where id=$1',[conversation])).rows[0].last_message_at,time);
  });
  await check('delayed older message cannot move last-message time backwards',async()=>{
    const time=(await db.query('select last_message_at from conversations where id=$1',[conversation])).rows[0].last_message_at;
    await db.query("insert into messages(conversation_id,sender_id,body,created_at) values($1,$2,'delayed QA','2025-01-01')",[conversation,buyer]);
    assert.deepEqual((await db.query('select last_message_at from conversations where id=$1',[conversation])).rows[0].last_message_at,time);
  });
  await check('notification failure rolls back the message and last-message timestamp together',async()=>{
    const before=await queued(),time=(await db.query('select last_message_at from conversations where id=$1',[conversation])).rows[0].last_message_at;
    await db.exec(`create function reject_message_notification() returns trigger language plpgsql as $$begin raise exception 'qa_notification_failure';end;$$;
      create trigger reject_message_notification before insert on notification_outbox for each row execute function reject_message_notification();`);
    await identity(buyer);
    await assert.rejects(db.query("insert into messages(conversation_id,sender_id,body,sender_nonce) values($1,$2,'fail atomically','qa-rollback-message')",[conversation,buyer]),/qa_notification_failure/);
    await db.exec('reset role');assert.equal(await queued(),before);
    assert.equal((await db.query("select count(*)::int n from messages where sender_nonce='qa-rollback-message'")).rows[0].n,0);
    assert.deepEqual((await db.query('select last_message_at from conversations where id=$1',[conversation])).rows[0].last_message_at,time);
    await db.exec('drop trigger reject_message_notification on notification_outbox');
  });
  console.log(`${checks} messaging/notification PostgreSQL checks passed; fixture schema, not full Supabase runtime.`);
} finally {await db.close();}
