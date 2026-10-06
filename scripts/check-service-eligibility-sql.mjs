import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite();
const buyer='00000000-0000-0000-0000-000000000001',seller='00000000-0000-0000-0000-000000000002';
const nursing='21000000-0000-0000-0000-000000000002',pet='23000000-0000-0000-0000-000000000012';
const area='11000000-0000-0000-0000-000000000001',request='00000000-0000-0000-0000-000000000010';
const quote='00000000-0000-0000-0000-000000000011';
const read=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
let checks=0;const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const eligible=async(service=nursing)=>(await db.query('select app_private.provider_service_eligible($1,$2,$3) ok',[seller,service,area])).rows[0].ok;
const feed=async()=>(await db.query('select public.provider_request_feed() value')).rows[0].value;
const quoteInsert=()=>db.query('insert into booking_quotes(id,request_id,buyer_id,seller_id,service_id) values($1,$2,$3,$4,$5)',[quote,request,buyer,seller,nursing]);
const book=()=>db.query('select qa_checkout($1,$2,$3,$4,$5)',[request,quote,buyer,seller,nursing]);
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;
 create function auth.uid() returns uuid language sql stable as $$select '${seller}'::uuid$$;
 create function app_private.has_role(text) returns boolean language sql stable as $$select $1='seller'$$;
 create function app_private.has_admin_permission(text) returns boolean language sql stable as $$select false$$;
 create table profiles(id uuid primary key,account_status text default 'active',deleted_at timestamptz);
 insert into profiles(id) values('${buyer}'),('${seller}');
 create table user_roles(user_id uuid,role text,revoked_at timestamptz);insert into user_roles values('${seller}','seller',null);
 create table seller_profiles(user_id uuid primary key,status text,profile_published_at timestamptz);insert into seller_profiles values('${seller}','approved',now());
 create table services(id uuid primary key,name text,active boolean,required_credential_types text[] not null default '{}');
 insert into services values('${nursing}','Home nursing',true,array['identity','rn_license','professional_indemnity']),('${pet}','Dog walker',true,'{}');
 create table seller_services(seller_id uuid,service_id uuid,active boolean);insert into seller_services values('${seller}','${nursing}',true),('${seller}','${pet}',true);
 create table service_areas(id uuid primary key,name text,active boolean);insert into service_areas values('${area}','Nassau',true);
 create table seller_service_areas(seller_id uuid,service_area_id uuid,active boolean);insert into seller_service_areas values('${seller}','${area}',true);
 create table seller_credentials(id uuid primary key default gen_random_uuid(),seller_id uuid,service_id uuid,credential_type text,status text,issue_date date,expiry_date date);
 create table verification_cases(seller_id uuid,verification_type text,status text,expires_at timestamptz);
 create table blocks(blocker_user_id uuid,blocked_user_id uuid);
 create table booking_requests(id uuid primary key,buyer_id uuid,service_id uuid,service_area_id uuid,mode text,desired_start timestamptz,desired_end timestamptz,care_summary text,budget_minor bigint,status text,created_at timestamptz,published_until timestamptz);
 insert into booking_requests values('${request}','${buyer}','${nursing}','${area}','scheduled',now()+interval '1 day',now()+interval '1 day 2 hours','Fictional QA request',10402,'requested',now(),now()+interval '30 days');
 create table booking_quotes(id uuid primary key,request_id uuid,buyer_id uuid,seller_id uuid,service_id uuid);
 create table bookings(id uuid primary key default gen_random_uuid(),request_id uuid,quote_id uuid,buyer_id uuid,seller_id uuid,service_id uuid,status text default 'confirmed');
 create table job_posting_plans(id uuid primary key,code text,featured boolean,fee_minor bigint,duration_days int);
 create table booking_request_publications(request_id uuid primary key,plan_id uuid,plan_code text,fee_minor_snapshot bigint,duration_days_snapshot int,payment_status text,expires_at timestamptz);
 create table qa_payments(id uuid primary key default gen_random_uuid());
 create function qa_checkout(r uuid,q uuid,b uuid,s uuid,svc uuid) returns void language plpgsql as $$begin
 insert into bookings(request_id,quote_id,buyer_id,seller_id,service_id) values(r,q,b,s,svc);
 insert into qa_payments default values;end$$;
 `);
 await db.exec(await read('20260824102710_quote_market_eligibility.sql'));
 await db.exec(await read('20261005101000_restore_eligible_request_visibility.sql'));
 await db.exec(await read('20261006020000_provider_request_discovery.sql'));
 await check('reproduces nursing discovery and quote acceptance with no required credentials',async()=>{
   assert.equal((await feed()).total,1);await db.exec('begin');await quoteInsert();await book();assert.equal((await db.query('select count(*)::int n from qa_payments')).rows[0].n,1);await db.exec('rollback');
 });
 await db.exec(await read('20261006060000_enforce_provider_service_credentials.sql'));
 await check('uncredentialed clinical provider cannot discover or directly read an unquoted request',async()=>{
   assert.equal(await eligible(),false);assert.equal((await feed()).total,0);assert.equal((await db.query('select app_private.can_view_seller_request($1) ok',[request])).rows[0].ok,false);
 });
 await check('uncredentialed provider cannot submit quote',async()=>await assert.rejects(quoteInsert(),/provider_service_requirements_not_met/));
 await check('household service with no requirements remains eligible',async()=>assert.equal(await eligible(pet),true));
 await db.exec(`insert into verification_cases values('${seller}','Government identity','approved',null),('${seller}','seller_onboarding','approved',null),('${seller}','Healthcare credential','approved',null),('${seller}','Background check consent','approved',null)`);
 await check('generic onboarding and generic healthcare review are not a nursing licence',async()=>assert.equal(await eligible(),false));
 await db.exec(`insert into seller_credentials(seller_id,service_id,credential_type,status) values('${seller}','${nursing}','rn_license','approved')`);
 await check('all catalogue requirements are mandatory, not just licence or identity',async()=>assert.equal(await eligible(),false));
 await db.exec(`insert into seller_credentials(seller_id,credential_type,status) values('${seller}','professional_indemnity','approved')`);
 await check('complete approved evidence permits exact-service discovery and quotes',async()=>{assert.equal(await eligible(),true);assert.equal((await feed()).total,1);await quoteInsert();});
 for(const status of ['pending','rejected','needs_information','expired']){
   await db.query("update seller_credentials set status=$1 where credential_type='rn_license'",[status]);
   await check(status+' licence cannot authorize new booking or payment',async()=>{assert.equal(await eligible(),false);await assert.rejects(book(),/provider_service_requirements_not_met/);assert.equal((await db.query('select count(*)::int n from qa_payments')).rows[0].n,0);});
 }
 await db.exec("update seller_credentials set status='approved',expiry_date=(now() at time zone 'America/Nassau')::date-1 where credential_type='rn_license'");
 await check('expiry blocks checkout of an already-issued quote and removes discovery',async()=>{assert.equal((await feed()).total,0);await assert.rejects(book(),/provider_service_requirements_not_met/);});
 await check('provider can still read own historical quoted request',async()=>assert.equal((await db.query('select app_private.can_view_seller_request($1) ok',[request])).rows[0].ok,true));
 await db.exec("update seller_credentials set expiry_date=(now() at time zone 'America/Nassau')::date where credential_type='rn_license'");
 await check('licence remains valid through Bahamas expiry date',async()=>assert.equal(await eligible(),true));
 await db.exec("update seller_credentials set issue_date=(now() at time zone 'America/Nassau')::date+1 where credential_type='rn_license'");
 await check('future-issued licence is not active yet',async()=>assert.equal(await eligible(),false));
 await db.exec("update seller_credentials set issue_date=null,service_id='23000000-0000-0000-0000-000000000012' where credential_type='rn_license'");
 await check('credential limited to another service does not authorize nursing',async()=>assert.equal(await eligible(),false));
 await db.exec("update seller_credentials set service_id=null where credential_type='rn_license'");
 await check('service-independent credential applies to requested service',async()=>assert.equal(await eligible(),true));
 await db.exec("update verification_cases set expires_at=now()-interval '1 second' where verification_type='Government identity'");
 await check('expired identity case is rejected',async()=>assert.equal(await eligible(),false));
 await db.exec("update verification_cases set expires_at=null where verification_type='Government identity'");
 for(const mutation of ["update profiles set account_status='suspended'","update profiles set account_status='restricted'","update profiles set deleted_at=now()","update user_roles set revoked_at=now()","update seller_profiles set profile_published_at=null","update seller_profiles set status='pending'","update seller_services set active=false","update services set active=false","update seller_service_areas set active=false","update service_areas set active=false"]){
   await db.exec('begin');await db.exec(mutation);
   await check(mutation+' blocks new work',async()=>{assert.equal(await eligible(),false);assert.equal((await feed()).total,0);await assert.rejects(book(),/provider_service_requirements_not_met/);});
   await db.exec('rollback');
 }
 for(const [from,to] of [[buyer,seller],[seller,buyer]]){
   await db.query('insert into blocks values($1,$2)',[from,to]);
   await check('block direction '+from+' prevents checkout and new discovery',async()=>{assert.equal((await feed()).total,0);await assert.rejects(book(),/interaction_blocked/);});
   await db.exec('delete from blocks');
 }
 await check('valid booking succeeds, and later revocation does not prevent resolving history',async()=>{
   await book();await db.exec("update seller_credentials set status='expired'");await db.exec("update bookings set status='resolved'");
   assert.equal((await db.query('select status from bookings')).rows[0].status,'resolved');assert.equal((await db.query('select count(*)::int n from qa_payments')).rows[0].n,1);
 });
 await check('forged reassignment of quote or booking is rejected',async()=>{
   await assert.rejects(db.query('update booking_quotes set service_id=$1 where id=$2',[pet,quote]),/request_quote_mismatch/);
   await assert.rejects(db.query('update bookings set service_id=$1',[pet]),/request_quote_mismatch/);
 });
 await check('anonymous/authenticated users cannot call the private eligibility helper',async()=>{
   for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(eligible(),/permission denied/);await db.exec('reset role');}
 });
 console.log(`${checks} service eligibility SQL checks passed; isolated schema with a checkout stub, not a real payment adapter.`);
}catch(error){console.error(error);process.exitCode=1;}finally{await db.close();}
