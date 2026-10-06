// Execute real report schema, RLS, intake RPC and current visibility predicates.
// PGlite is isolated; these checks do not certify hosted/manual acceptance.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite();
const uid=n=>`43000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const buyer=uid(1),seller=uid(2),outsider=uid(3),admin=uid(4),hidden=uid(5);
const conversation=uid(10),message=uid(11),ownMessage=uid(12),review=uid(13),peerReview=uid(14);
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const read=name=>readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8');
const root=async(sql='')=>db.exec('reset role;'+sql);
const identity=async(id='',role='authenticated')=>{await root();await db.query("select set_config('qa.uid',$1,false)",[id]);await db.exec('set role '+role);};
const report=async(type='message',target=message,reason='unsafe_content',details='QA private report details')=>(await db.query('select public.report_content($1,$2,$3,$4) as result',[type,target,reason,details])).rows[0].result;
const ownReports=()=>db.query('select * from public.moderation_reports');
const stats=async()=>{await root();return (await db.query('select (select count(*)::int from moderation_reports) reports,(select count(*)::int from domain_events) events')).rows[0];};
const sqlFunction=(source,name)=>{const start=source.indexOf('create or replace function '+name+'(');assert.ok(start>=0,name);const end=source.indexOf('$$;',start);assert.ok(end>start);return source.slice(start,end+3);};
try {
 const core=await read('20260824051429_nanas_core_schema');
 const security=await read('20260824051835_nanas_security_rpc_storage');
 const current=await read('20261006120000_enforce_moderation_decisions');
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;
 grant usage on schema auth,app_private to anon,authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
 create function app_private.has_admin_permission(text) returns boolean language sql stable as $$select coalesce(auth.uid()='${admin}'::uuid,false)$$;
 create table profiles(id uuid primary key,account_status text,deleted_at timestamptz);
 insert into profiles values('${buyer}','active',null),('${seller}','active',null),('${outsider}','active',null),('${admin}','active',null),('${hidden}','active',null);
 create table badges(id uuid primary key);
 create table seller_profiles(user_id uuid primary key,status text,profile_published_at timestamptz);
 insert into seller_profiles values('${seller}','approved',now()),('${hidden}','draft',null);
 create table app_private.provider_moderation(provider_id uuid,visibility text);
 create table blocks(blocker_user_id uuid,blocked_user_id uuid);
 create table conversations(id uuid primary key);insert into conversations values('${conversation}');
 create table conversation_members(conversation_id uuid,user_id uuid,role text,left_at timestamptz);
 insert into conversation_members values('${conversation}','${buyer}','buyer',null),('${conversation}','${seller}','seller',null);
 create table conversation_access_purchases(conversation_id uuid,buyer_id uuid);
 insert into conversation_access_purchases values('${conversation}','${buyer}');
 create table messages(id uuid primary key,conversation_id uuid,sender_id uuid,body text,deleted_at timestamptz,moderation_status text);
 insert into messages values('${message}','${conversation}','${seller}','Private provider body',null,'allowed'),('${ownMessage}','${conversation}','${buyer}','Private buyer body',null,'allowed');
 create table reviews(id uuid primary key,author_id uuid,subject_id uuid,status text);
 insert into reviews values('${review}','${seller}','${buyer}','published'),('${peerReview}','${buyer}','${seller}','pending_peer');
 create table bookings(id uuid primary key,buyer_id uuid,seller_id uuid);
 create table domain_events(aggregate_type text,aggregate_id uuid,event_type text,payload_redacted jsonb);
 `);
 for(const type of ['case_priority','case_status'])await db.exec(core.match(new RegExp('create type public\\.'+type+'[^;]+;'))[0]);
 const tableStart=core.indexOf('create table public.moderation_reports (');
 await db.exec(core.slice(tableStart,core.indexOf('\n);',tableStart)+4));
 await db.exec('alter table moderation_reports enable row level security;grant select,insert,update on moderation_reports to authenticated;');
 for(const name of ['moderation_reporter_admin','moderation_reporter_insert'])await db.exec(security.match(new RegExp('create policy '+name+'[^;]+;'))[0]);
 await db.exec(sqlFunction(security,'app_private.is_conversation_member'));
 await db.exec(sqlFunction(current,'app_private.provider_directory_visible'));
 await db.exec(sqlFunction(current,'app_private.conversation_is_locked'));
 await db.exec(await read('20260824094630_badge_and_moderation_completion'));
 await identity(outsider);
 await check('BEFORE FIX: unrelated and missing message IDs both create reports',async()=>{
  await db.exec('begin');assert.equal((await report()).ok,true);assert.equal((await report('message',uid(999))).ok,true);await db.exec('rollback');
 });
 await identity(buyer);
 await check('BEFORE FIX: supported provider/user kinds fail the actual table constraint',async()=>{
  for(const type of ['seller_profile','user'])await assert.rejects(report(type,seller),/moderation_reports_target_type_check/);
 });
 await check('BEFORE FIX: direct insert can forge resolved status and urgent priority',async()=>{
  await db.exec('begin');const r=await db.query("insert into moderation_reports(reporter_id,target_type,target_id,reason_code,priority,status,assigned_admin_id) values($1,'message',$2,'qa','urgent','resolved',$3) returning status",[buyer,message,admin]);assert.equal(r.rows[0].status,'resolved');await db.exec('rollback');
 });
 await root();await db.exec(await read('20261006160000_guard_moderation_report_intake'));
 for(const type of ['profile','booking','document'])await db.query("insert into moderation_reports(reporter_id,target_type,target_id,reason_code) values($1,$2,$3,'legacy')",[admin,type,uid(999)]);
 await check('historical target kinds remain intact',async()=>assert.equal((await db.query("select count(*)::int n from moderation_reports where reason_code='legacy'")).rows[0].n,3));
 await identity('','anon');await check('anonymous cannot call public or private report entry points',async()=>{
  await assert.rejects(report(),/permission denied/);await assert.rejects(db.query("select app_private.report_content('message',$1,'qa',null)",[message]),/permission denied/);
 });
 await identity('');await check('missing authenticated user is rejected',async()=>await assert.rejects(report(),/authentication_required/));
 await identity(buyer);const first=await report();
 await check('visible message produces confirmed report, own receipt and redacted event',async()=>{
  assert.equal(first.ok,true);assert.equal(first.replayed,false);const rows=(await ownReports()).rows;assert.equal(rows.length,1);assert.equal(rows[0].status,'open');assert.equal(rows[0].priority,'normal');assert.equal(rows[0].assigned_admin_id,null);
  await root();const e=(await db.query('select * from domain_events')).rows;assert.equal(e.length,1);assert.doesNotMatch(JSON.stringify(e),/Private provider body|QA private report details/);
 });
 await identity(buyer);await check('identical retry returns same report without another event',async()=>{
  const replay=await report();assert.equal(replay.report_id,first.report_id);assert.equal(replay.replayed,true);assert.deepEqual(await stats(),{reports:4,events:1});
 });
 await root(`update moderation_reports set status='escalated' where id='${first.report_id}'`);await identity(buyer);
 await check('retry preserves escalated status and does not reopen the case',async()=>assert.equal((await report()).status,'escalated'));
 await check('changed narrative creates a separate report without overwriting evidence',async()=>{assert.notEqual((await report('message',message,'unsafe_content','Additional QA details')).report_id,first.report_id);assert.equal((await ownReports()).rows.find(r=>r.id===first.report_id).details,'QA private report details');});
 await root(`update moderation_reports set status='closed' where id='${first.report_id}'`);await identity(buyer);
 await check('fresh report is allowed after a final decision',async()=>assert.notEqual((await report()).report_id,first.report_id));
 for(const [type,target] of [['seller_profile',seller],['user',seller],['review',review],['review',peerReview]]) {
  await identity(buyer);await check('eligible '+type+' '+target.slice(-2)+' accepted',async()=>assert.equal((await report(type,target)).ok,true));
 }
 await identity(seller);await check('unpublished peer review is not reportable by its subject',async()=>await assert.rejects(report('review',peerReview),/report_target_unavailable/));
 await identity(outsider);await check('unrelated users cannot infer or report private or missing targets',async()=>{
  for(const [type,target] of [['message',message],['message',uid(999)],['user',buyer],['user',uid(999)],['review',peerReview],['seller_profile',hidden],['seller_profile',uid(999)]])await assert.rejects(report(type,target),/report_target_unavailable/);
  assert.equal((await ownReports()).rows.length,0);
 });
 await check('public review remains reportable by a signed-in outsider',async()=>assert.equal((await report('review',review)).ok,true));
 await root('truncate conversation_access_purchases');await identity(buyer);
 await check('paywall protects provider message targets but not own messages or known user reports',async()=>{
  await assert.rejects(report(),/report_target_unavailable/);assert.equal((await report('message',ownMessage)).ok,true);assert.equal((await report('user',seller)).ok,true);
 });
 await root(`insert into conversation_access_purchases values('${conversation}','${buyer}')`);
 for(const status of ['limited','removed']) {
  await root(`update messages set moderation_status='${status}' where id='${message}'`);await identity(buyer);
  await check(status+' message targets are unavailable',async()=>await assert.rejects(report(),/report_target_unavailable/));
 }
 await root(`update messages set moderation_status='allowed',deleted_at=now() where id='${message}'`);await identity(buyer);
 await check('deleted messages cannot create reports',async()=>await assert.rejects(report(),/report_target_unavailable/));
 await root(`update messages set deleted_at=null;update conversation_members set left_at=now() where user_id='${buyer}'`);await identity(buyer);
 await check('former members cannot report private messages',async()=>await assert.rejects(report(),/report_target_unavailable/));
 await root(`update conversation_members set left_at=null;insert into blocks values('${seller}','${buyer}')`);await identity(buyer);
 await check('blocked provider profile stays hidden but known counterpart can still be reported',async()=>{
  await assert.rejects(report('seller_profile',seller),/report_target_unavailable/);assert.equal((await report('user',seller)).ok,true);
 });
 await root(`insert into bookings values('${uid(20)}','${buyer}','${hidden}')`);await identity(buyer);
 await check('historical booking counterparty is reportable without public profile access',async()=>assert.equal((await report('user',hidden)).ok,true));
 await root(`update profiles set account_status='restricted' where id='${buyer}'`);await identity(buyer);
 await check('restricted users retain safety reporting',async()=>assert.equal((await report()).ok,true));
 for(const state of ['suspended','closed','pending']) {
  await root(`update profiles set account_status='${state}' where id='${buyer}'`);await identity(buyer);
  await check(state+' caller cannot use intake',async()=>await assert.rejects(report(),/reporting_account_unavailable/));
 }
 await root(`update profiles set account_status='active',deleted_at=now() where id='${buyer}'`);await identity(buyer);
 await check('deleted caller cannot use intake',async()=>await assert.rejects(report(),/reporting_account_unavailable/));
 await root(`update profiles set deleted_at=null where id='${buyer}'`);await identity(buyer);
 await check('null, invalid and oversized input never produces reports',async()=>{
  for(const [type,target,reason,details,error] of [[null,message,'qa',null,/invalid_target_type/],['booking',message,'qa',null,/invalid_target_type/],['message',null,'qa',null,/report_target_unavailable/],['message',message,null,null,/invalid_reason/],['message',message,' ',null,/invalid_reason/],['message',message,'x'.repeat(81),null,/invalid_reason/],['message',message,'qa','x'.repeat(3001),/details_too_long/]])await assert.rejects(report(type,target,reason,details),error);
 });
 await check('direct inserts and updates cannot spoof status, priority, ownership or assignment',async()=>{
  await assert.rejects(db.query("insert into moderation_reports(reporter_id,target_type,target_id,reason_code,status) values($1,'message',$2,'qa','resolved')",[buyer,message]),/permission denied/);
  await assert.rejects(db.query("update moderation_reports set status='resolved',priority='urgent',assigned_admin_id=$1",[admin]),/permission denied/);
 });
 await identity(outsider);await check('reporter cannot see another reporter private narrative',async()=>assert.ok((await ownReports()).rows.every(r=>r.reporter_id===outsider)));
 await identity(admin);await check('authorized moderation reader retains queue access',async()=>assert.ok((await ownReports()).rows.some(r=>r.reporter_id===buyer)));
 const before=await stats();
 await root(`create function app_private.qa_fail_event() returns trigger language plpgsql as $$begin raise exception 'qa_event_failure';end$$;create trigger qa_fail before insert on domain_events for each row execute function app_private.qa_fail_event()`);await identity(buyer);
 await check('event failure rolls back the report and never returns success',async()=>{await assert.rejects(report('message',message,'qa_atomicity','Unique rollback fixture'),/qa_event_failure/);assert.deepEqual(await stats(),before);});
 console.log(`${checks} report intake SQL checks passed; isolated fixture, not hosted or manual acceptance.`);
} catch(error){console.error(error);process.exitCode=1;} finally{await db.close();}
