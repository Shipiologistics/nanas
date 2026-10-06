import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const seller='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',admin='00000000-0000-0000-0000-000000000003',service='00000000-0000-0000-0000-000000000004';
const id='00000000-0000-0000-0000-000000000010';
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const identity=async(user='',role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('qa.uid',$1,false)",[user]);await db.exec('set role '+role);};
const root=async(sql)=>db.exec('reset role;'+sql);
const submit=async(overrides={})=>{
 const p={id,type:'rn_license',service,issuer:'Fictional QA licensing body',issued:'2020-01-01',expires:'2090-01-01',path:seller+'/test/evidence.png',name:'FICTIONAL-QA.png',...overrides};
 return (await db.query('select public.submit_service_credential($1,$2,$3,$4,$5,$6,$7,$8) as result',Object.values(p))).rows[0].result;
};
const review=async(decision,credential=id,note='Explicitly fictional QA review')=>(await db.query('select public.admin_review_service_credential($1,$2,$3) as result',[credential,decision,note])).rows[0].result;
const records=async(after=null,limit=20)=>(await db.query('select public.service_credential_records($1,$2) as result',[after,limit])).rows[0].result.items;
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;
 grant usage on schema auth,app_private to anon,authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
 create function app_private.has_admin_permission(text) returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
 create type verification_status as enum ('not_started','pending','needs_information','approved','rejected','expired','revoked');
 create type seller_status as enum ('draft','under_review','approved','paused','rejected','needs_information');
 create table profiles(id uuid primary key,account_status text,deleted_at timestamptz);
 create table user_roles(user_id uuid,role text,revoked_at timestamptz);
 create function app_private.has_role(text) returns boolean language sql stable as $$select exists(select 1 from public.user_roles where user_id=auth.uid() and role=$1 and revoked_at is null)$$;
 insert into profiles values('${seller}','active',null),('${other}','active',null),('${admin}','active',null);
 insert into user_roles values('${seller}','seller',null),('${other}','buyer',null),('${admin}','admin',null);
 create table seller_profiles(user_id uuid primary key,display_name text,status seller_status,approved_at timestamptz,updated_at timestamptz);
 insert into seller_profiles values('${seller}','QA provider','approved',now(),now());
 create table services(id uuid primary key,name text,active boolean,required_credential_types text[]);
 insert into services values('${service}','Home nursing',true,array['rn_license','identity','professional_indemnity']);
 create table seller_documents(id uuid primary key default gen_random_uuid(),seller_id uuid,document_type text,storage_path text unique,issue_date date,expiry_date date,status verification_status,metadata_redacted jsonb,uploaded_at timestamptz default now(),updated_at timestamptz);
 create table seller_credentials(id uuid primary key default gen_random_uuid(),seller_id uuid,service_id uuid,credential_type text,issuing_body text,issue_date date,expiry_date date,status verification_status,source_document_id uuid,verified_by uuid,verified_at timestamptz,created_at timestamptz default now(),updated_at timestamptz);
 create table verification_cases(id uuid primary key default gen_random_uuid(),seller_id uuid,verification_type text,status verification_status,vendor text default 'manual',result_summary text,created_at timestamptz default now(),decision_reason text,admin_reviewer_id uuid,decided_at timestamptz,updated_at timestamptz);
 create table notification_outbox(recipient_id uuid,template_key text,category text,priority text,variables_redacted jsonb,dedupe_key text unique);
 create table admin_audit_logs(actor_id uuid,action text,target_type text,target_id uuid,before_redacted jsonb,after_redacted jsonb,reason text);
 create table admin_access_logs(admin_user_id uuid,resource_type text,resource_id uuid,purpose_code text,case_id uuid,fields_accessed text[],created_at timestamptz default now());
 create table domain_events(aggregate_type text,aggregate_id uuid,event_type text,payload_redacted jsonb);
 `);
 await db.exec(await readFile(new URL('../supabase/migrations/20261006080000_service_credential_workflow.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261005110000_verification_evidence_access.sql',import.meta.url),'utf8'));
 await identity('','anon');await check('anonymous cannot submit, list or review credentials',async()=>{await assert.rejects(submit(),/permission denied/);await assert.rejects(records(),/permission denied/);await assert.rejects(review('approved'),/permission denied/);});
 await identity(other);await check('buyer cannot submit, list or review credential records',async()=>{await assert.rejects(submit(),/seller_role_required/);await assert.rejects(records(),/permission_denied/);await assert.rejects(review('approved'),/permission_denied/);});
 await identity(seller);
 await check('unknown or mismatched credential type is rejected',async()=>{await assert.rejects(submit({type:'made_up'}),/credential_type_not_required/);await assert.rejects(submit({service:other}),/credential_type_not_required/);});
 await check('identity stays in the identity verification workflow',async()=>await assert.rejects(submit({type:'identity'}),/use_identity_verification/));
 await check('issuer and issue date are required; future and reversed dates rejected',async()=>{for(const change of [{issuer:''},{issued:null},{issued:'2091-01-01'},{expires:'2019-01-01'}]) await assert.rejects(submit(change),/issuing_body_required|invalid_credential_dates/);});
 await check('foreign evidence paths cannot be claimed',async()=>await assert.rejects(submit({path:other+'/evidence.png'}),/invalid_storage_path/));
 await check('valid submission creates one scoped pending credential and evidence case',async()=>{assert.equal((await submit()).replayed,false);const row=(await records())[0];assert.equal(row.status,'pending');assert.equal(row.service_id,service);assert.equal(row.case_id,id);});
 await check('same submission safely replays but changed content conflicts',async()=>{assert.equal((await submit()).replayed,true);await assert.rejects(submit({issuer:'Changed issuer'}),/submission_id_conflict/);});
 await check('provider cannot self approve',async()=>await assert.rejects(review('approved'),/permission_denied/));
 await check('provider can read only its linked evidence',async()=>assert.equal((await db.query('select public.verification_evidence($1) as result',[id])).rows[0].result.length,1));
 await identity(other);await check('outsider cannot read private credential evidence',async()=>await assert.rejects(db.query('select public.verification_evidence($1)',[id]),/evidence_not_found/));
 await identity(admin);
 await check('approval requires recent evidence access',async()=>await assert.rejects(review('approved'),/inspect_credential_evidence_first/));
 await check('generic review cannot bypass service credential safeguards',async()=>await assert.rejects(db.query("select app_private.admin_review_verification($1,'approved','Attempt legacy bypass')",[id]),/use_service_credential_review/));
 await check('request-more-information retains provider account approval',async()=>{assert.equal((await review('needs_information')).status,'needs_information');await root('');assert.equal((await db.query('select status from seller_profiles')).rows[0].status,'approved');});
 await identity(admin);await db.query('select public.verification_evidence($1)',[id]);
 await check('inspected evidence can be approved once with scope and expiry retained',async()=>{assert.equal((await review('approved')).status,'approved');assert.equal((await review('approved')).replayed,true);const row=(await records())[0];assert.equal(row.effective_status,'approved');assert.equal(row.expiry_date,'2090-01-01');});
 await check('final approval cannot be silently changed to rejection',async()=>await assert.rejects(review('rejected'),/credential_already_decided/));
 await root("update seller_credentials set expiry_date='2020-01-02'");await identity(admin);
 await check('expiry is projected without rewriting the historical approval',async()=>{const row=(await records())[0];assert.equal(row.effective_status,'expired');assert.equal(row.status,'approved');});
 await check('revocation is explicit, audited and safely replayed',async()=>{assert.equal((await review('revoked')).status,'revoked');assert.equal((await review('revoked')).replayed,true);await root('');assert.equal((await db.query("select count(*)::int as n from admin_audit_logs where action='credential.revoked'")).rows[0].n,1);assert.equal((await db.query('select status from seller_profiles')).rows[0].status,'approved');assert.equal((await db.query('select count(*)::int as n from seller_documents')).rows[0].n,1);});
 await identity(seller);
 await check('reserved case types cannot be fabricated through generic submission',async()=>await assert.rejects(db.query("select app_private.submit_verification_document($1,$2,'test.png')",['service_credential:'+id,seller+'/other.png']),/use_service_credential_submission/));
 await check('new replacement creates fresh evidence without altering revoked history',async()=>{await submit({id:other,path:seller+'/test/replacement.png'});assert.equal((await records()).length,2);});
 await identity(admin);await check('invalid notes and decisions fail closed',async()=>{await assert.rejects(review('approved',other,''),/decision_note_required/);await assert.rejects(review('unknown',other),/invalid_decision/);});
 await root(`update seller_credentials set expiry_date='2020-01-02' where id='${other}'`);await identity(admin);await db.query('select public.verification_evidence($1)',[other]);
 await check('expired submitted credential cannot be approved even after evidence access',async()=>await assert.rejects(review('approved',other),/credential_not_current/));
 await root(`update seller_credentials set expiry_date='2090-01-01' where id='${other}';update admin_access_logs set created_at=now()-interval '2 hours' where resource_id='${other}'`);await identity(admin);
 await check('stale evidence access cannot authorize a new approval',async()=>await assert.rejects(review('approved',other),/inspect_credential_evidence_first/));
 await db.query('select public.verification_evidence($1)',[other]);await review('rejected',other);
 await check('rejected credential requires fresh submission rather than reversal',async()=>await assert.rejects(review('approved',other),/credential_already_decided/));
 await root(`update user_roles set revoked_at=now() where user_id='${seller}' and role='seller'`);await identity(seller);
 await check('revoked seller role cannot submit additional evidence',async()=>await assert.rejects(submit({id:admin,path:seller+'/test/new.png'}),/seller_role_required/));
 await root(`update user_roles set revoked_at=null where user_id='${seller}';update seller_credentials set expiry_date='2090-01-01' where id='${id}'`);await identity(seller);
 await check('retrying an old submission never reactivates a revoked credential',async()=>{assert.equal((await submit()).replayed,true);assert.equal((await records()).find(r=>r.id===id).status,'revoked');});
 await root(`insert into seller_profiles values('${other}','Other provider','approved',now(),now());insert into user_roles values('${other}','seller',null)`);await identity(other);
 await check('another provider cannot claim a submission id or list foreign records',async()=>{await assert.rejects(submit(),/submission_id_conflict/);assert.equal((await records()).length,0);});
 await identity(seller);await check('record pagination uses stable unique ids and a lookahead row',async()=>{const rows=await records(null,1);assert.equal(rows.length,2);assert.equal((await records(rows[0].id,1)).length,1);await assert.rejects(records(null,101),/invalid_page_size/);});
 await root(`insert into verification_cases(id,seller_id,verification_type,status) values('${service}','${seller}','Healthcare credential','pending');insert into seller_documents(seller_id,document_type,storage_path,status) values('${seller}','Healthcare credential','${seller}/legacy.png','pending')`);await identity(admin);
 await check('rejecting a generic non-identity document no longer rejects the whole provider',async()=>{await db.query("select app_private.admin_review_verification($1,'rejected','Generic evidence is not a licence')",[service]);await root('');assert.equal((await db.query('select status from seller_profiles where user_id=$1',[seller])).rows[0].status,'approved');});
 await root(`update verification_cases set verification_type='Government identity',status='pending' where id='${service}';update seller_documents set document_type='Government identity',status='pending' where storage_path='${seller}/legacy.png';update seller_profiles set status='paused' where user_id='${seller}'`);await identity(admin);
 await check('identity approval does not unpause an explicitly paused provider',async()=>{await db.query("select app_private.admin_review_verification($1,'approved','Fictional identity recheck')",[service]);await root('');assert.equal((await db.query('select status from seller_profiles where user_id=$1',[seller])).rows[0].status,'paused');});
 const identityCase='40000000-0000-4000-8000-000000000001',identityDocument='40000000-0000-4000-8000-000000000002';
 await root(`alter table verification_cases add column expires_at timestamptz;
 insert into verification_cases(id,seller_id,verification_type,status) values('${identityCase}','${seller}','Government identity','pending');
 insert into seller_documents(id,seller_id,document_type,storage_path,status,issue_date,expiry_date)
 values('${identityDocument}','${seller}','Government identity','${seller}/identity-current.pdf','pending',(now() at time zone 'America/Nassau')::date-1,(now() at time zone 'America/Nassau')::date);`);
 const reviewIdentity=async(decision='approved',caseId=identityCase,note='Fictional identity review only')=>(await db.query('select app_private.admin_review_verification($1,$2::verification_status,$3) as result',[caseId,decision,note])).rows[0].result;
 await root(`begin;update seller_documents set expiry_date=(now() at time zone 'America/Nassau')::date-1 where id='${identityDocument}'`);await identity(admin);
 await check('reproduces approval of expired generic evidence without recorded access',async()=>assert.equal((await reviewIdentity()).status,'approved'));
 await root('rollback');
 await db.exec(await readFile(new URL('../supabase/migrations/20261006110000_guard_identity_review.sql',import.meta.url),'utf8'));
 await identity('','anon');await check('generic approval stays inaccessible to anonymous callers',async()=>await assert.rejects(reviewIdentity(),/permission denied/));
 await identity(other);await check('ordinary account cannot review another provider',async()=>await assert.rejects(reviewIdentity(),/permission_denied/));
 await identity(seller);await db.query('select public.verification_evidence($1)',[identityCase]);await identity(admin);
 await check('owner evidence access does not substitute for administrator review',async()=>await assert.rejects(reviewIdentity(),/inspect_current_verification_evidence_first/));
 for(const [label,user,resource,caseRef,purpose,age] of [
  ['other administrator',other,identityCase,identityCase,'verification_evidence_review','0 hours'],
  ['wrong resource',admin,service,identityCase,'verification_evidence_review','0 hours'],
  ['wrong linked case',admin,identityCase,service,'verification_evidence_review','0 hours'],
  ['wrong purpose',admin,identityCase,identityCase,'unrelated','0 hours'],
  ['stale access',admin,identityCase,identityCase,'verification_evidence_review','2 hours'],
  ['future access',admin,identityCase,identityCase,'verification_evidence_review','-2 hours'],
 ]) {
  await root('');await db.query("insert into admin_access_logs(admin_user_id,resource_type,resource_id,purpose_code,case_id,created_at) values($1,'verification_case',$2,$3,$4,now()-$5::interval)",[user,resource,purpose,caseRef,age]);await identity(admin);
  await check(label+' cannot authorize generic approval',async()=>await assert.rejects(reviewIdentity(),/inspect_current_verification_evidence_first/));
  await root(`delete from admin_access_logs where resource_id='${identityCase}' or case_id='${identityCase}'`);
 }
 await identity(admin);await db.query('select public.verification_evidence($1)',[identityCase]);
 const invalidDates=[
  ["expiry_date=(now() at time zone 'America/Nassau')::date-1","expiry_date=(now() at time zone 'America/Nassau')::date"],
  ["issue_date=(now() at time zone 'America/Nassau')::date+1","issue_date=(now() at time zone 'America/Nassau')::date-1"],
  ["uploaded_at=now()+interval '1 day'","uploaded_at=now()-interval '1 day'"],
 ];
 for(const [change,restore] of invalidDates){await root(`update seller_documents set ${change} where id='${identityDocument}'`);await identity(admin);await check('generic approval rejects '+change,async()=>await assert.rejects(reviewIdentity(),/verification_evidence_not_current/));await root(`update seller_documents set ${restore} where id='${identityDocument}'`);}
 await root(`update verification_cases set expires_at=now()-interval '1 second' where id='${identityCase}'`);await identity(admin);
 await check('expired verification case cannot approve otherwise current documents',async()=>await assert.rejects(reviewIdentity(),/verification_evidence_not_current/));
 await root(`update verification_cases set expires_at=null where id='${identityCase}'`);await identity(admin);
 await check('failed approvals leave case, document and notifications untouched',async()=>{await root('');assert.equal((await db.query('select status from verification_cases where id=$1',[identityCase])).rows[0].status,'pending');assert.equal((await db.query('select status from seller_documents where id=$1',[identityDocument])).rows[0].status,'pending');assert.equal((await db.query("select count(*)::int as n from notification_outbox where variables_redacted->>'case_id'=$1",[identityCase])).rows[0].n,0);});
 await identity(admin);await db.query('select public.verification_evidence($1)',[identityCase]);await identity(seller);
 let addedDocument;
 await check('new evidence joins the pending case while keeping paused provider paused',async()=>{const r=(await db.query("select app_private.submit_verification_document('Government identity',$1,'QA newer identity.pdf') as result",[seller+'/identity-newer.pdf'])).rows[0].result;assert.equal(r.case_id,identityCase);addedDocument=r.document_id;await root('');assert.equal((await db.query('select status from seller_profiles where user_id=$1',[seller])).rows[0].status,'paused');});
 await identity(admin);await check('new document invalidates prior evidence access for the same case',async()=>await assert.rejects(reviewIdentity(),/inspect_current_verification_evidence_first/));
 await check('evidence retrieval includes recorded dates and explicitly null unknown dates',async()=>{const docs=(await db.query('select public.verification_evidence($1) as result',[identityCase])).rows[0].result;assert.match(docs.find(d=>d.id===identityDocument).expiry_date,/^\d{4}-\d{2}-\d{2}$/);assert.equal(docs.find(d=>d.id===addedDocument).expiry_date,null);});
 await check('fresh access approves current scoped evidence on its inclusive expiry day',async()=>{assert.equal((await reviewIdentity()).status,'approved');await root('');assert.equal((await db.query('select status from seller_documents where id=$1',[addedDocument])).rows[0].status,'approved');assert.equal((await db.query('select status from seller_profiles where user_id=$1',[seller])).rows[0].status,'paused');assert.equal((await db.query('select status from seller_credentials where id=$1',[id])).rows[0].status,'revoked');});
 await identity(admin);await check('final identity approval replays without a new audit or notification',async()=>{assert.equal((await reviewIdentity()).already_processed,true);await assert.rejects(reviewIdentity('rejected'),/case_already_decided/);await root('');assert.equal((await db.query('select count(*)::int as n from admin_audit_logs where target_id=$1',[identityCase])).rows[0].n,1);assert.equal((await db.query("select count(*)::int as n from notification_outbox where variables_redacted->>'case_id'=$1 and template_key='verification_decision'",[identityCase])).rows[0].n,1);});
 await identity(seller);const nextCase=(await db.query("select app_private.submit_verification_document('Government identity',$1,'QA expired replacement.pdf') as result",[seller+'/identity-expired-replacement.pdf'])).rows[0].result;
 await check('replacement after final decision creates a fresh case',async()=>assert.notEqual(nextCase.case_id,identityCase));
 await root(`update seller_documents set expiry_date=(now() at time zone 'America/Nassau')::date-1 where id='${nextCase.document_id}'`);await identity(admin);
 await check('expired evidence can receive needs-information and rejection without a fake approval',async()=>{assert.equal((await reviewIdentity('needs_information',nextCase.case_id)).status,'needs_information');assert.equal((await reviewIdentity('rejected',nextCase.case_id)).status,'rejected');await root('');assert.equal((await db.query('select status from verification_cases where id=$1',[identityCase])).rows[0].status,'approved');});
 console.log(`${checks} credential workflow SQL checks passed; isolated PostgreSQL fixture.`);
} catch(error) {console.error(error);process.exitCode=1;} finally {await db.close();}
