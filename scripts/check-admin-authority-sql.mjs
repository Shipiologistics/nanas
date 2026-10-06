import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite(),uid=n=>`45000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=uid(1),buyer=uid(2),seller=uid(3),otherAdmin=uid(4);
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const root=async(sql='')=>db.exec('reset role;'+sql);
const identity=async(id=admin,role='authenticated')=>{await root();await db.query("select set_config('qa.uid',$1,false)",[id]);await db.exec('set role '+role);};
const read=name=>readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8');
const fun=(s,name)=>{const i=s.indexOf('create or replace function '+name+'(');assert.ok(i>=0);return s.slice(i,s.indexOf('$$;',i)+3);};
const table=(s,name)=>{const i=s.indexOf('create table public.'+name+' (');assert.ok(i>=0);return s.slice(i,s.indexOf('\n);',i)+4);};
const permission=async(key='users.enforce')=>(await db.query('select public.admin_permission_allowed($1) as allowed',[key])).rows[0].allowed;
const setting=async(key='qa_setting',value={enabled:true},reason='QA configuration reason')=>(await db.query('select public.admin_set_system_setting($1,$2::jsonb,$3) as result',[key,JSON.stringify(value),reason])).rows[0].result;
const enforce=()=>db.query("select public.admin_user_action($1,'restrict','QA account restriction',null)",[buyer]);
try {
 const core=await read('20260824051429_nanas_core_schema'),security=await read('20260824051835_nanas_security_rpc_storage'),extended=await read('20260824052709_nanas_prd_extended_entities');
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;grant usage on schema auth,app_private to anon,authenticated;
 create table auth.users(id uuid primary key);insert into auth.users values('${admin}'),('${buyer}'),('${seller}'),('${otherAdmin}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;`);
 for(const name of ['account_status','app_role','seller_status'])await db.exec(core.match(new RegExp('create type public\\.'+name+'[^;]+;'))[0]);
 for(const name of ['profiles','user_roles','admin_permissions','admin_audit_logs','system_settings'])await db.exec(table(core,name));
 await db.exec(await read('20260824075034_nanas_admin_wildcard_permission'));
 await db.exec(`insert into profiles(id,display_name) values('${admin}','QA Admin'),('${buyer}','QA Buyer'),('${seller}','QA Provider'),('${otherAdmin}','QA Other Admin');
 insert into user_roles(user_id,role) values('${admin}','admin'),('${otherAdmin}','admin'),('${buyer}','buyer'),('${seller}','seller');
 insert into admin_permissions(admin_user_id,permission_key) values('${admin}','*'),('${otherAdmin}','users.enforce');
 create table seller_profiles(user_id uuid primary key,status seller_status);insert into seller_profiles values('${seller}','approved');
 alter table profiles enable row level security;alter table user_roles enable row level security;alter table admin_permissions enable row level security;alter table admin_audit_logs enable row level security;`);
 for(const name of ['app_private.has_role','app_private.has_admin_permission','app_private.admin_user_action','public.admin_user_action'])await db.exec(fun(security,name));
 for(const name of ['profiles_self_admin_select','profiles_self_update','roles_self_admin_select','roles_self_insert','admin_permissions_admin_select','audit_admin']){
  const match=security.match(new RegExp('create policy '+name+'[^;]+;'));if(match)await db.exec(match[0]);else assert.equal(name,'audit_admin');
 }
 // Reproduce the initial grants, then the actual later grant reset. Reading
 // only the original schema would incorrectly claim profile self-escalation.
 await db.exec('grant select,insert,update on profiles to authenticated;grant insert on user_roles to authenticated;');
 await db.exec(extended.match(/revoke all on all tables in schema public from anon,authenticated;/)[0]);
 await db.exec(extended.match(/grant select on all tables in schema public to authenticated;/)[0]);
 await identity(buyer);
 await check('current grants already deny direct account status/identity changes',async()=>{
  for(const sql of ["update profiles set account_status='active'","update profiles set deleted_at=null,suspended_reason=null","update profiles set display_name='Changed'","insert into profiles(id,display_name) values(gen_random_uuid(),'Forged')"])
   await assert.rejects(db.exec(sql),/permission denied/);
 });
 await check('current grants deny forged roles and permission assignments',async()=>{
  await assert.rejects(db.query("insert into user_roles(user_id,role) values($1,'admin')",[buyer]),/permission denied/);
  await assert.rejects(db.query("insert into admin_permissions(admin_user_id,permission_key) values($1,'*')",[buyer]),/permission denied/);
 });
 await root(`update profiles set account_status='restricted' where id='${admin}'`);await identity();
 await check('BEFORE FIX: restricted admin retains permission and can restrict another account',async()=>{
  await db.exec('begin');assert.equal((await db.query("select app_private.has_admin_permission('users.enforce') as allowed")).rows[0].allowed,true);await enforce();await root();assert.equal((await db.query('select account_status from profiles where id=$1',[buyer])).rows[0].account_status,'restricted');await db.exec('rollback');
 });
 await root();await db.exec(await read('20261006180000_require_active_administrators'));
 await identity();await check('restricted admin loses authority but retains own account visibility',async()=>{
  assert.equal(await permission(),false);await assert.rejects(enforce(),/permission_denied/);const rows=(await db.query('select id from profiles')).rows;assert.deepEqual(rows.map(x=>x.id),[admin]);
  assert.equal((await db.query('select permission_key from admin_permissions')).rows.length,1);
 });
 for(const status of ['pending','suspended','closed']){
  await root(`update profiles set account_status='${status}' where id='${admin}'`);await identity();await check(status+' admin denied across permission/RPC paths',async()=>{assert.equal(await permission(),false);await assert.rejects(setting(),/permission_denied/);});
 }
 await root(`update profiles set account_status='active',deleted_at=now() where id='${admin}'`);await identity();await check('deleted admin has no authority',async()=>assert.equal(await permission(),false));
 await root(`update profiles set deleted_at=null where id='${admin}';update user_roles set revoked_at=now() where user_id='${admin}'`);await identity();
 await check('revoked admin role cannot reuse retained permission rows',async()=>{assert.equal(await permission(),false);assert.equal((await db.query('select permission_key from admin_permissions')).rows.length,1);await assert.rejects(setting(),/permission_denied/);});
 await root(`update user_roles set revoked_at=null where user_id='${admin}';update admin_permissions set revoked_at=now() where admin_user_id='${admin}'`);await identity();await check('revoked permission denied',async()=>assert.equal(await permission(),false));
 await root(`update admin_permissions set revoked_at=null where admin_user_id='${admin}'`);await identity();
 await check('active role and grant restore exact and wildcard permission checks',async()=>{assert.equal(await permission(),true);assert.equal(await permission('config.manage'),true);for(const key of [null,'','*'])assert.equal(await permission(key),false);});
 await identity(otherAdmin);await check('exact grants do not authorize unrelated administrative domains',async()=>{assert.equal(await permission('users.enforce'),true);assert.equal(await permission('finance.read'),false);await assert.rejects(setting(),/permission_denied/);});
 await root(`insert into admin_permissions(admin_user_id,permission_key) values('${buyer}','*')`);await identity(buyer);
 await check('an ordinary account with a permission row still lacks the admin role',async()=>assert.equal(await permission(),false));
 await root(`update profiles set account_status='restricted' where id in ('${buyer}','${seller}')`);
 for(const [id,role] of [[buyer,'buyer'],[seller,'seller']]){
  await identity(id);await check('restricted '+role+' retains existing role semantics for ordinary obligations',async()=>assert.equal((await db.query('select app_private.has_role($1::app_role) as allowed',[role])).rows[0].allowed,true));
 }
 await identity('','anon');await check('anonymous cannot call the public authority or setting RPC',async()=>{await assert.rejects(permission(),/permission denied/);await assert.rejects(setting(),/permission denied/);});
 await identity('', 'authenticated');await check('missing user context never authorizes',async()=>assert.equal(await permission(),false));
 await identity();await check('active admin setting save is confirmed and audited without storing values in the audit',async()=>{
  assert.deepEqual(await setting(),{ok:true,key:'qa_setting'});await root();const audit=(await db.query('select * from admin_audit_logs')).rows;assert.equal(audit.length,1);assert.equal(audit[0].reason,'QA configuration reason');assert.deepEqual(audit[0].after_redacted,{key:'qa_setting'});
 });
 await identity();await check('setting validation rejects malformed keys, values and reasons',async()=>{
  for(const [key,value,reason,error] of [['',{},'QA reason',/invalid_setting_key/],['UPPER',{},'QA reason',/invalid_setting_key/],['qa_setting',null,'QA reason',/invalid_setting_value/],['qa_setting',{text:'x'.repeat(66000)},'QA reason',/invalid_setting_value/],['qa_setting',{},null,/setting_reason_required/],['qa_setting',{},'x',/setting_reason_required/],['qa_setting',{},'x'.repeat(1001),/setting_reason_required/]])await assert.rejects(setting(key,value,reason),error);
 });
 await root(`create function app_private.qa_fail_audit() returns trigger language plpgsql as $$begin raise exception 'qa_audit_failure';end$$;create trigger qa_fail before insert on admin_audit_logs for each row execute function app_private.qa_fail_audit()`);await identity();
 await check('failed audit rolls back both new settings and existing-setting updates',async()=>{
  await assert.rejects(setting('qa_new',{changed:true}),/qa_audit_failure/);await assert.rejects(setting('qa_setting',{changed:true}),/qa_audit_failure/);await root();const rows=(await db.query('select key,value from system_settings')).rows;assert.deepEqual(rows,[{key:'qa_setting',value:{enabled:true}}]);assert.equal((await db.query('select count(*)::int n from admin_audit_logs')).rows[0].n,1);
 });
 console.log(`${checks} admin authority SQL checks passed; isolated fixture, not hosted/manual acceptance.`);
}catch(error){console.error(error);process.exitCode=1;}finally{await db.close();}
