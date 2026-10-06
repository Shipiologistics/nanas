import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite(),uid=n=>`46000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const buyer=uid(1),seller=uid(2),restricted=uid(3),revoked=uid(4),fresh=uid(5),admin=uid(6);
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const read=name=>readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8');
const fun=(s,name)=>{const i=s.indexOf('create or replace function '+name+'(');assert.ok(i>=0);return s.slice(i,s.indexOf('$$;',i)+3);};
const table=(s,name)=>{const i=s.indexOf('create table public.'+name+' (');assert.ok(i>=0);return s.slice(i,s.indexOf('\n);',i)+4);};
const root=sql=>db.exec('reset role;'+(sql??''));
const identity=async(id=buyer,role='authenticated')=>{await root();await db.query("select set_config('qa.uid',$1,false)",[id]);await db.exec('set role '+role);};
const activate=async(name='QA Provider')=>(await db.query('select public.activate_seller_profile($1) result',[name])).rows[0].result;
const submit=async(name='QA Provider',headline='Fictional care provider',bio='Fictional local QA application.',years=4)=>(await db.query('select public.submit_seller_application($1,$2,$3,$4) result',[name,headline,bio,years])).rows[0].result;
const snapshot=async id=>{await root();return (await db.query(`select
 (select count(*)::int from user_roles where user_id=$1 and role='seller' and revoked_at is null) roles,
 (select count(*)::int from seller_profiles where user_id=$1) profiles,
 (select count(*)::int from ledger_accounts where owner_user_id=$1 and account_type='seller_wallet') wallets`,[id])).rows[0];};
try {
 const core=await read('20260824051429_nanas_core_schema'),security=await read('20260824051835_nanas_security_rpc_storage'),extended=await read('20260824052709_nanas_prd_extended_entities');
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;grant usage on schema auth,app_private to authenticated;
 create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;`);
 for(const name of ['app_role','account_status','seller_status','verification_status'])await db.exec(core.match(new RegExp('create type public\\.'+name+'[^;]+;'))[0]);
 await db.exec('create table islands(id uuid primary key)');
 for(const name of ['profiles','user_roles','seller_profiles','ledger_accounts','seller_documents','verification_cases'])await db.exec(table(core,name));
 await db.exec(core.match(/create unique index user_roles_active_unique[^;]+;/)[0]);
 for(const name of ['app_private.has_role','app_private.activate_seller_profile','public.activate_seller_profile'])await db.exec(fun(security,name));
 await db.exec('grant execute on all functions in schema app_private to authenticated');
 await db.exec(extended.match(/revoke all on all tables in schema public from anon,authenticated;/)[0]);
 await db.exec(extended.match(/grant select on all tables in schema public to authenticated;/)[0]);
 for(const [id,role] of [[buyer,'buyer'],[seller,'seller'],[restricted,'buyer'],[revoked,'buyer'],[fresh,'buyer'],[admin,'admin']]){
  await db.query('insert into auth.users values($1)',[id]);await db.query("insert into profiles(id,display_name) values($1,'QA Account')",[id]);await db.query('insert into user_roles(user_id,role) values($1,$2)',[id,role]);
 }
 await db.exec(`insert into seller_profiles(user_id,display_name) values('${seller}','Existing provider');update profiles set account_status='restricted' where id='${restricted}';insert into user_roles(user_id,role,revoked_at) values('${revoked}','seller',now())`);
 await identity(seller);
 await check('BEFORE FIX: provider-only signup cannot activate its existing provider profile',()=>assert.rejects(activate(),/account_not_active/));
 await check('BEFORE FIX: restricted buyer can add provider role',async()=>{await identity(restricted);await db.exec('begin');await activate();assert.deepEqual(await snapshot(restricted),{roles:1,profiles:1,wallets:1});await db.exec('rollback');});
 await check('BEFORE FIX: later application permission failure leaves activation committed',async()=>{
  await identity(buyer);await activate();await assert.rejects(db.exec("update seller_profiles set headline='QA application'"),/permission denied/);assert.deepEqual(await snapshot(buyer),{roles:1,profiles:1,wallets:1});
 });
 await check('BEFORE FIX: retry reports draft and overwrites an approved provider name',async()=>{
  await root(`update seller_profiles set status='approved' where user_id='${buyer}'`);await identity(buyer);await db.exec('begin');assert.equal((await activate('Unexpected new name')).status,'draft');await root();assert.equal((await db.query('select display_name from seller_profiles where user_id=$1',[buyer])).rows[0].display_name,'Unexpected new name');await db.exec('rollback');
 });
 if(!process.argv.includes('--baseline-only')){
  await root();await db.exec(await read('20261006190000_atomic_provider_onboarding'));
  await identity(seller);await check('existing provider-only signup activation succeeds without changing its name',async()=>{assert.equal((await activate()).status,'draft');await root();assert.equal((await db.query('select display_name from seller_profiles where user_id=$1',[seller])).rows[0].display_name,'Existing provider');});
  for(const status of ['draft','submitted','needs_information','under_review','approved','rejected','paused','suspended']){
   await root(`update seller_profiles set status='${status}' where user_id='${buyer}'`);await identity();await check('activation retry preserves actual '+status+' state and original name',async()=>{const r=await activate('Do not overwrite');assert.equal(r.status,status);assert.equal(r.seller_id,buyer);await root();assert.equal((await db.query('select display_name from seller_profiles where user_id=$1',[buyer])).rows[0].display_name,'QA Provider');});
  }
  for(const status of ['pending','restricted','suspended','closed']){
   await root(`update profiles set account_status='${status}' where id='${restricted}'`);await identity(restricted);await check(status+' account cannot activate or submit',async()=>{await assert.rejects(activate(),/account_not_active/);await assert.rejects(submit(),/account_not_active/);assert.deepEqual(await snapshot(restricted),{roles:0,profiles:0,wallets:0});});
  }
  await root(`update profiles set account_status='active',deleted_at=now() where id='${restricted}'`);await identity(restricted);await check('deleted account cannot activate',()=>assert.rejects(activate(),/account_not_active/));
  await identity(revoked);await check('buyer cannot self-restore a revoked provider role',()=>assert.rejects(activate(),/seller_role_revoked/));
  await identity(admin);await check('admin-only account cannot self-enroll via consumer activation',()=>assert.rejects(activate(),/marketplace_role_required/));
  await identity('', 'authenticated');await check('missing identity denied',()=>assert.rejects(activate(),/authentication_required/));
  await identity('', 'anon');await check('anonymous cannot execute either onboarding RPC',async()=>{await assert.rejects(activate(),/permission denied/);await assert.rejects(submit(),/permission denied/);});
  await identity(fresh);await check('invalid names rejected before any enrollment writes',async()=>{for(const name of [null,'',' ','x','x'.repeat(81)])await assert.rejects(activate(name),/invalid_display_name/);assert.deepEqual(await snapshot(fresh),{roles:0,profiles:0,wallets:0});});
  await identity(fresh);await check('application without identity evidence rolls back activation completely',async()=>{await assert.rejects(submit(),/identity_verification_required/);assert.deepEqual(await snapshot(fresh),{roles:0,profiles:0,wallets:0});});
  await identity(fresh);await check('first activation and retry produce one role, profile and wallet',async()=>{const a=await activate(),b=await activate();assert.deepEqual(a,b);assert.deepEqual(await snapshot(fresh),{roles:1,profiles:1,wallets:1});});
  await identity(fresh);await check('application input validation precedes mutation',async()=>{for(const args of [['QA','','QA',1],['QA','QA','',1],['QA','x'.repeat(121),'QA',1],['QA','QA','x'.repeat(2001),1],['QA','QA','QA',-1],['QA','QA','QA',81],['QA','QA','QA',null]])await assert.rejects(submit(...args),/invalid_/);});
  await root(`insert into seller_documents(seller_id,document_type,storage_path) values('${fresh}','identity','${fresh}/fictional.pdf');insert into verification_cases(id,seller_id,verification_type) values('${uid(10)}','${fresh}','identity')`);
  await identity(fresh);await check('application uses existing identity review case and repeat does not create duplicates',async()=>{const a=await submit(),b=await submit();assert.deepEqual(a,b);assert.equal(a.verification_case_id,uid(10));assert.equal(a.status,'under_review');await root();assert.equal((await db.query('select count(*)::int n from verification_cases')).rows[0].n,1);const p=(await db.query('select * from seller_profiles where user_id=$1',[fresh])).rows[0];assert.equal(p.bio,'Fictional local QA application.');assert.equal(p.years_experience,4);});
  for(const status of ['approved','paused','suspended','rejected']){
   await root(`update seller_profiles set status='${status}' where user_id='${fresh}'`);await identity(fresh);await check('application cannot downgrade '+status+' provider',()=>assert.rejects(submit(),/application_not_editable/));
  }
  await root(`update seller_profiles set status='draft' where user_id='${fresh}';update verification_cases set status='rejected' where seller_id='${fresh}'`);await identity(fresh);await check('closed identity case cannot be reused',()=>assert.rejects(submit(),/identity_verification_required/));
  await root(`update verification_cases set status='pending' where seller_id='${fresh}';update seller_documents set status='revoked' where seller_id='${fresh}'`);await identity(fresh);await check('revoked document cannot back application submission',()=>assert.rejects(submit(),/identity_verification_required/));
  await root(`update seller_documents set status='pending' where seller_id='${fresh}';create function app_private.qa_fail_profile() returns trigger language plpgsql as $$begin if new.status='under_review' then raise exception 'qa_save_failure';end if;return new;end$$;create trigger qa_fail before update on seller_profiles for each row execute function app_private.qa_fail_profile()`);await identity(fresh);
  await check('failed application save preserves previous profile and case',async()=>{await assert.rejects(submit('Changed name','Changed headline','Changed biography',7),/qa_save_failure/);await root();const p=(await db.query('select display_name,bio,status from seller_profiles where user_id=$1',[fresh])).rows[0];assert.deepEqual(p,{display_name:'QA Provider',bio:'Fictional local QA application.',status:'draft'});assert.equal((await db.query('select count(*)::int n from verification_cases')).rows[0].n,1);});
 }
 console.log(`${checks} provider onboarding SQL checks passed; isolated fixture, not hosted/manual acceptance.`);
}catch(error){console.error(error);process.exitCode=1;}finally{await db.close();}
