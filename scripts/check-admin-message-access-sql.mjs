import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite();
const uid=n=>`44000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=uid(1),buyer=uid(2),seller=uid(3),other=uid(4),conversation=uid(10),foreign=uid(11),booking=uid(12),otherBooking=uid(13);
const dispute=uid(20),support=uid(21),safety=uid(22),moderation=uid(23),reviewCase=uid(24),profileCase=uid(25),unboundSupport=uid(26);
const message=n=>uid(1000+n);
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const read=name=>readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8');
const root=async(sql='')=>db.exec('reset role;'+sql);
const identity=async(user=admin,claims={amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]},role='authenticated')=>{
 await root();await db.query("select set_config('qa.uid',$1,false),set_config('qa.jwt',$2,false)",[user,JSON.stringify(claims)]);await db.exec('set role '+role);
};
const args={conversation,purpose:'dispute-review',caseId:dispute,reason:'Review QA dispute evidence',time:null,id:null,limit:50};
const page=async(overrides={})=>{const a={...args,...overrides};return (await db.query('select public.admin_conversation_message_page($1,$2,$3,$4,$5,$6,$7) as result',[a.conversation,a.purpose,a.caseId,a.reason,a.time,a.id,a.limit])).rows[0].result;};
const sqlFunction=(source,name)=>{const start=source.indexOf('create or replace function '+name+'(');assert.ok(start>=0);const end=source.indexOf('$$;',start);return source.slice(start,end+3);};
const sqlTable=(source,name)=>{const start=source.indexOf('create table public.'+name+' (');assert.ok(start>=0);return source.slice(start,source.indexOf('\n);',start)+4);};
try {
 const core=await read('20260824051429_nanas_core_schema'),security=await read('20260824051835_nanas_security_rpc_storage');
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;grant usage on schema auth,app_private to anon,authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('qa.jwt',true),''),'{}')::jsonb$$;
 create table profiles(id uuid primary key,account_status text,deleted_at timestamptz);
 insert into profiles values('${admin}','active',null),('${buyer}','active',null),('${seller}','active',null),('${other}','active',null);
 create table admin_permissions(admin_user_id uuid,permission_key text,revoked_at timestamptz);
 insert into admin_permissions values('${admin}','*',null);
 create table user_roles(user_id uuid,role text,revoked_at timestamptz);
 insert into user_roles values('${admin}','admin',null),('${buyer}','buyer',null),('${seller}','seller',null);
 create table bookings(id uuid primary key,buyer_id uuid,seller_id uuid);insert into bookings values('${booking}','${buyer}','${seller}'),('${otherBooking}','${other}','${seller}');
 create table booking_requests(id uuid primary key);
 create table payment_intents(id uuid primary key);
 `);
 for(const type of ['app_role','moderation_status','case_status','case_priority'])await db.exec(core.match(new RegExp('create type public\\.'+type+'[^;]+;'))[0]);
 // has_role's enum comparison requires the actual role type.
 await root('alter table user_roles alter column role type app_role using role::app_role;');
 for(const name of ['app_private.has_role','app_private.has_admin_permission','app_private.admin_conversation_messages','public.admin_conversation_messages'])await db.exec(sqlFunction(security,name));
 for(const name of ['conversations','conversation_members','messages','admin_access_logs','service_disputes','moderation_reports'])await db.exec(sqlTable(core,name));
 await db.exec(sqlFunction(security,'app_private.is_conversation_member'));
 await db.exec('create table conversation_access_purchases(conversation_id uuid,buyer_id uuid);alter table messages enable row level security;grant select on messages to authenticated;');
 await db.exec(security.match(/create policy messages_members_only[^;]+;/)[0]);
 const visibility=await read('20261006120000_enforce_moderation_decisions');
 await db.exec(sqlFunction(visibility,'app_private.conversation_is_locked'));
 const policyStart=visibility.indexOf('alter policy messages_members_only');
 await db.exec(visibility.slice(policyStart,visibility.indexOf('\n);',policyStart)+3));
 await db.exec(sqlTable(await read('20260824070453_nanas_support_and_safety_commands'),'support_cases'));
 await db.exec(sqlTable(await read('20260824052709_nanas_prd_extended_entities'),'safety_incidents'));
 await db.exec(`create table reviews(id uuid primary key,booking_id uuid);insert into reviews values('${uid(30)}','${booking}');
 insert into conversations(id,conversation_type,booking_id) values('${conversation}','booking','${booking}'),('${foreign}','booking','${otherBooking}');
 insert into conversation_members(conversation_id,user_id,role) values('${conversation}','${buyer}','buyer'),('${conversation}','${seller}','seller'),('${foreign}','${other}','buyer'),('${foreign}','${seller}','seller');
 insert into conversation_access_purchases values('${conversation}','${buyer}');
 insert into service_disputes(id,booking_id,opened_by,reason_code,summary) values('${dispute}','${booking}','${buyer}','qa','QA case summary only');
 insert into support_cases(id,requester_id,case_type,subject,details_private,booking_id) values('${support}','${buyer}','booking','QA support','QA private support detail','${booking}'),('${unboundSupport}','${buyer}','account','QA unbound support','QA private support detail',null);
 insert into safety_incidents(id,booking_id,reporter_id,category) values('${safety}','${booking}','${buyer}','qa');
 insert into moderation_reports(id,reporter_id,target_type,target_id,reason_code) values('${moderation}','${buyer}','message','${message(1)}','qa'),('${reviewCase}','${buyer}','review','${uid(30)}','qa'),('${profileCase}','${buyer}','profile','${seller}','qa');
 grant execute on function public.admin_conversation_messages(uuid,text),app_private.admin_conversation_messages(uuid,text) to authenticated;
 `);
 for(let i=1;i<=205;i++)await db.query("insert into messages(id,conversation_id,sender_id,body,sender_nonce,created_at) values($1,$2,$3,$4,$5,$6)",[message(i),conversation,i%2?buyer:seller,'QA private message '+i,'qa-'+i,'2026-01-01T01:02:03.'+String(Math.floor(i/3)).padStart(6,'0')+'Z']);
 await db.query("insert into messages(id,conversation_id,sender_id,body,sender_nonce) values($1,$2,$3,'FOREIGN PRIVATE BODY','foreign')",[message(999),foreign,seller]);
 await identity(admin,{});
 await check('BEFORE FIX: stale/no-auth context and arbitrary purpose read all 205 messages without a case',async()=>{
  await db.exec('begin');const rows=(await db.query("select public.admin_conversation_messages($1,'anything') as result",[conversation])).rows[0].result;assert.equal(rows.length,205);
  await root();assert.equal((await db.query('select case_id from admin_access_logs')).rows[0].case_id,null);await db.exec('rollback');
 });
 await root();await db.exec(await read('20261006170000_case_scoped_admin_messages'));
 await db.exec(await read('20261006180000_require_active_administrators'));
 await root(`update messages set moderation_status='removed' where id='${message(1)}';update messages set moderation_status='limited' where id='${message(2)}';update messages set deleted_at=now() where id='${message(205)}';`);
 await identity();
 await check('old public/private endpoints cannot bypass case binding',async()=>{
  await assert.rejects(db.query("select public.admin_conversation_messages($1,'qa')",[conversation]),/permission denied/);
  await assert.rejects(db.query("select app_private.admin_conversation_messages($1,'qa')",[conversation]),/permission denied/);
  await root();await assert.rejects(db.query("select app_private.admin_conversation_messages($1,'qa')",[conversation]),/case_context_required/);
 });
 await identity('',{},'anon');await check('anonymous invocation is denied',async()=>await assert.rejects(page(),/permission denied/));
 await identity(buyer);await check('ordinary participant retains only their legitimate RLS history, not admin evidence',async()=>{await assert.rejects(page(),/permission_denied/);const rows=(await db.query('select * from messages')).rows;assert.equal(rows.length,202);assert.ok(rows.every(m=>m.conversation_id===conversation&&m.moderation_status==='allowed'));});
 await identity();await check('administrator table reads cannot bypass case/audit RPC through message RLS',async()=>assert.equal((await db.query('select * from messages')).rows.length,0));
 for(const status of ['restricted','suspended','closed']){
  await root(`update profiles set account_status='${status}' where id='${admin}'`);await identity();await check(status+' admin is denied',async()=>await assert.rejects(page(),/permission_denied/));
 }
 await root(`update profiles set account_status='active',deleted_at=now() where id='${admin}'`);await identity();await check('deleted admin is denied',async()=>await assert.rejects(page(),/permission_denied/));await root(`update profiles set deleted_at=null where id='${admin}'`);
 const now=Math.floor(Date.now()/1000);
 for(const [label,claims] of [['missing',{}],['iat only',{iat:now}],['refresh only',{amr:[{method:'token_refresh',timestamp:now}]}],['anonymous',{amr:[{method:'anonymous',timestamp:now}]}],['expired',{amr:[{method:'password',timestamp:now-700}]}],['future',{amr:[{method:'password',timestamp:now+60}]}],['malformed',{amr:{method:'password',timestamp:now},auth_time:'NaN'}],['huge',{auth_time:'9'.repeat(200)}]]){
  await identity(admin,claims);await check(label+' authentication evidence is rejected',async()=>await assert.rejects(page(),/recent_authentication_required/));
 }
 await identity(admin,{auth_time:now});await check('verified auth_time supports a recent sign-in',async()=>assert.equal((await page()).ok,true));
 await identity(admin,{amr:[{method:'password',timestamp:now-800},{method:'totp',timestamp:now}]});await check('recent MFA event supports step-up without token-issuance fallback',async()=>assert.equal((await page()).ok,true));
 await root(`delete from admin_permissions;insert into admin_permissions values('${admin}','messages.read',null)`);await identity();await check('message permission alone cannot authorize a case domain',async()=>await assert.rejects(page(),/permission_denied/));
 await root(`delete from admin_permissions;insert into admin_permissions values('${admin}','disputes.manage',null)`);await identity();await check('case permission alone cannot authorize message reads',async()=>await assert.rejects(page(),/permission_denied/));
 await root(`delete from admin_permissions;insert into admin_permissions values('${admin}','*',now())`);await identity();await check('revoked permissions cannot authorize evidence',async()=>await assert.rejects(page(),/permission_denied/));await root('update admin_permissions set revoked_at=null');await identity();
 for(const [label,changes,error] of [['missing case',{caseId:null},/case_context_required/],['unrelated case',{conversation:foreign},/case_conversation_unavailable/],['missing case ID',{caseId:uid(99)},/case_conversation_unavailable/],['missing conversation',{conversation:uid(99)},/case_conversation_unavailable/],['unknown purpose',{purpose:'free_text'},/invalid_access_purpose/],['short reason',{reason:' '},/access_reason_required/],['long reason',{reason:'x'.repeat(1001)},/access_reason_required/],['unbound support',{caseId:unboundSupport,purpose:'support-case'},/case_conversation_unavailable/],['profile case',{caseId:profileCase,purpose:'moderation-review'},/case_conversation_unavailable/]]){
  await check(label+' is denied',async()=>await assert.rejects(page(changes),error));
 }
 for(const [purpose,caseId,table] of [['dispute-review',dispute,'service_disputes'],['support-case',support,'support_cases'],['safety-incident',safety,'safety_incidents'],['moderation-review',moderation,'moderation_reports'],['moderation-review',reviewCase,'moderation_reports']]){
  await identity();await check(purpose+' '+caseId.slice(-2)+' is linked and audited',async()=>{const p=await page({purpose,caseId});assert.equal(p.case_id,caseId);assert.equal(p.messages.length,50);await root();const log=(await db.query('select * from admin_access_logs where id=$1',[p.audit_id])).rows[0];assert.equal(log.case_id,caseId);assert.equal(log.access_reason,args.reason);assert.equal(log.message_count,50);assert.doesNotMatch(JSON.stringify(log),/QA private message|FOREIGN PRIVATE BODY/);});
  await root(`update ${table} set status='resolved' where id='${caseId}'`);await identity();await check(purpose+' '+caseId.slice(-2)+' closed case is denied',async()=>await assert.rejects(page({purpose,caseId}),/case_conversation_unavailable/));await root(`update ${table} set status='open' where id='${caseId}'`);
 }
 for(const [table,field,id,purpose] of [['support_cases','requester_id',support,'support-case'],['safety_incidents','reporter_id',safety,'safety-incident'],['service_disputes','opened_by',dispute,'dispute-review']]){
  await root(`update ${table} set ${field}='${other}' where id='${id}'`);await identity();await check(table+' forged booking relationship is denied',async()=>await assert.rejects(page({purpose,caseId:id}),/case_conversation_unavailable/));await root(`update ${table} set ${field}='${buyer}' where id='${id}'`);
 }
 await identity();await check('204 messages paginate without gaps across timestamp ties and preserve microseconds',async()=>{
  let cursor=null,all=[],sizes=[];do{const p=await page({id:cursor?.id??null,time:cursor?.created_at??null});sizes.push(p.messages.length);all.push(...p.messages);cursor=p.next_cursor;assert.equal(p.has_more,Boolean(cursor));}while(cursor);
  assert.deepEqual(sizes,[50,50,50,50,4]);assert.equal(new Set(all.map(m=>m.id)).size,204);assert.ok(all.every(m=>m.conversation_id===conversation));assert.ok(all.some(m=>m.moderation_status==='removed'));assert.ok(all.some(m=>m.moderation_status==='limited'));assert.ok(!all.some(m=>m.id===message(205)));assert.match(all[0].created_at,/\.000068/);
 });
 await check('cursor pairs, foreign cursors and page bounds cannot bypass the reader',async()=>{
  for(const changes of [{id:message(1)},{time:'2026-01-01'},{id:message(999),time:'2026-01-01'},{id:message(1),time:'2026-01-02'}])await assert.rejects(page(changes),/invalid_message_cursor/);
  for(const limit of [null,0,-1,101])await assert.rejects(page({limit}),/invalid_page_size/);
 });
 await root('delete from admin_access_logs');await identity();await check('denied case requests create no fake successful access logs',async()=>{await assert.rejects(page({caseId:uid(99)}),/case_conversation_unavailable/);await root();assert.equal((await db.query('select count(*)::int n from admin_access_logs')).rows[0].n,0);});
 await root(`create function app_private.qa_fail_access_log() returns trigger language plpgsql as $$begin raise exception 'qa_audit_failure';end$$;create trigger qa_fail before insert on admin_access_logs for each row execute function app_private.qa_fail_access_log()`);await identity();
 await check('audit failure prevents a successful message response',async()=>await assert.rejects(page(),/qa_audit_failure/));
 console.log(`${checks} admin message SQL checks passed; isolated fixture, not hosted or manual acceptance.`);
}catch(error){console.error(error);process.exitCode=1;}finally{await db.close();}
