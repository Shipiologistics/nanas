import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite();
const seller='00000000-0000-0000-0000-000000000001',buyer='00000000-0000-0000-0000-000000000002',admin='00000000-0000-0000-0000-000000000003';
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
const identity=async(id='',role='anon')=>{await db.exec('reset role');await db.query("select set_config('qa.uid',$1,false)",[id]);await db.exec('set role '+role);};
const directory=async()=>(await db.query('select * from seller_directory')).rows;
const root=async(sql)=>db.exec('reset role;'+sql);
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;
 grant usage on schema auth,app_private to anon,authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
 create function app_private.has_admin_permission(text) returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
 create table profiles(id uuid primary key,account_status text,deleted_at timestamptz);
 insert into profiles values('${seller}','active',null);
 create table seller_profiles(user_id uuid primary key,status text,profile_published_at timestamptz,public_slug text,display_name text,headline text,languages text[],vaccinations text[],additional_details text[],avatar_path text,locality text,island_id uuid,rating_average numeric,rating_count int,completed_bookings int,response_rate int);
 insert into seller_profiles(user_id,status,profile_published_at,display_name) values('${seller}','approved',now(),'QA provider');
 create table islands(id uuid,name text);
 create table services(id uuid,name text,slug text,active boolean);
 create table seller_services(seller_id uuid,service_id uuid,active boolean,rate_minor int,rate_max_minor int,currency text,service_bio text,years_experience int,capabilities text[],additional_help text[]);
 insert into services values('${buyer}','Dog walker','pet-care-walker',true);
 insert into seller_services(seller_id,service_id,active,rate_minor) values('${seller}','${buyer}',true,2500);
 create table seller_service_areas(seller_id uuid,active boolean);
 insert into seller_service_areas values('${seller}',true);
 create table availability_rules(seller_id uuid,active boolean,weekday int,local_start time,local_end time,timezone text,updated_at timestamptz,service_id uuid,service_area_id uuid);
 insert into availability_rules(seller_id,active,weekday) values('${seller}',true,1);
 create table badges(id uuid,code text,name text,icon_key text,active boolean,public boolean);
 create table user_badges(user_id uuid,badge_id uuid,revoked_at timestamptz,expires_at timestamptz);
 create table seller_credentials(seller_id uuid,credential_type text,issuing_body text,verified_at timestamptz,expiry_date date,status text);
 insert into seller_credentials values('${seller}','expired_license',null,now(),(now() at time zone 'America/Nassau')::date-1,'approved'),('${seller}','current_license',null,now(),(now() at time zone 'America/Nassau')::date,'approved');
 create table seller_public_safety_checks(seller_id uuid,check_type text,status text,completed_at timestamptz,expires_at timestamptz,public_summary text,public boolean);
 insert into seller_public_safety_checks values('${seller}','background_check','completed',now()-interval '2 days',now()-interval '1 day','Historical test record',true),('${seller}','social_media_check','completed',now(),now()+interval '1 day',null,true),('${seller}','private_check','completed',now(),null,'Private',false);
 create table blocks(blocker_user_id uuid,blocked_user_id uuid);
 alter table seller_profiles enable row level security;
 create policy seller_profiles_public_owner_admin on seller_profiles for select to anon,authenticated using((status='approved' and profile_published_at is not null) or user_id=auth.uid() or app_private.has_admin_permission('sellers.read'));
 alter table seller_services enable row level security;
 create policy seller_services_public_owner_admin on seller_services for select to anon,authenticated using(active or seller_id=auth.uid() or app_private.has_admin_permission('sellers.read'));
 alter table seller_service_areas enable row level security;
 create policy seller_areas_public_owner on seller_service_areas for select to anon,authenticated using(active or seller_id=auth.uid() or app_private.has_admin_permission('sellers.read'));
 alter table availability_rules enable row level security;
 create policy availability_public_owner on availability_rules for select to anon,authenticated using(active or seller_id=auth.uid() or app_private.has_admin_permission('sellers.read'));
 alter table seller_credentials enable row level security;
 create policy credentials_public_owner_admin on seller_credentials for select to anon,authenticated using(status='approved' or seller_id=auth.uid() or app_private.has_admin_permission('kyc.review'));
 alter table seller_public_safety_checks enable row level security;
 create policy seller_public_safety_checks_read on seller_public_safety_checks for select to anon,authenticated using(public or seller_id=auth.uid() or app_private.has_admin_permission('kyc.review'));
 grant select on seller_profiles,seller_services,seller_service_areas,availability_rules,seller_credentials,seller_public_safety_checks,islands,services,badges,user_badges to anon,authenticated;
 `);
 const old=await readFile(new URL('../supabase/migrations/20260824141337_add_service_specific_seller_profiles.sql',import.meta.url),'utf8');
 await db.exec(old.slice(old.indexOf('create or replace view public.seller_directory'),old.indexOf("\ncommit;")));
 await root("update profiles set account_status='suspended'");await identity();
 await check('reproduces suspended account remaining in published directory',async()=>assert.equal((await directory()).length,1));
 await check('reproduces expired credential and screening appearing current',async()=>{const row=(await directory())[0];assert.equal(row.credentials.length,2);assert.equal(row.safety_checks.find(c=>c.type==='background_check').status,'completed');});
 await root("update seller_profiles set profile_published_at=null");await identity();
 await check('reproduces public access to unpublished provider availability',async()=>assert.equal((await db.query('select * from availability_rules')).rows.length,1));
 await root("update profiles set account_status='active';update seller_profiles set profile_published_at=now()");
 await db.exec(await readFile(new URL('../supabase/migrations/20261006040000_provider_directory_visibility.sql',import.meta.url),'utf8'));
 await identity();
 await check('anonymous sees only published safe directory data without private profile grants',async()=>{assert.equal((await directory()).length,1);await assert.rejects(db.query('select * from profiles'),/permission denied/);});
 await check('expired credentials omitted but Bahamas expiry day remains valid',async()=>assert.deepEqual((await directory())[0].credentials.map(c=>c.type),['current_license']));
 await check('expired screening is projected expired without rewriting history',async()=>{const row=(await directory())[0];assert.equal(row.safety_checks.find(c=>c.type==='background_check').status,'expired');assert.equal(row.safety_checks.find(c=>c.type==='social_media_check').status,'completed');assert.equal(row.safety_checks.length,2);});
 const assertHidden=async()=>{assert.equal((await directory()).length,0);for(const table of ['seller_profiles','seller_services','seller_service_areas','availability_rules','seller_credentials','seller_public_safety_checks']) assert.equal((await db.query('select * from '+table)).rows.length,0,table);};
 for(const state of ['suspended','restricted','closed']) {await root(`update profiles set account_status='${state}'`);await identity();await check(state+' provider and related public rows are hidden',assertHidden);}
 await root("update profiles set account_status='active',deleted_at=now()");await identity();await check('soft-deleted provider is hidden',assertHidden);
 await root("update profiles set deleted_at=null;update seller_profiles set profile_published_at=null");await identity();await check('unpublished provider schedules and credentials are no longer public',assertHidden);
 await identity(seller,'authenticated');await check('owner retains unpublished management records without reappearing in directory',async()=>{assert.equal((await directory()).length,0);assert.equal((await db.query('select * from seller_profiles')).rows.length,1);assert.equal((await db.query('select * from seller_credentials')).rows.length,2);});
 await identity(admin,'authenticated');await check('authorized admin retains private and historical verification records',async()=>{assert.equal((await db.query('select * from seller_public_safety_checks')).rows.length,3);assert.equal((await db.query('select * from seller_credentials')).rows.length,2);});
 await root("update seller_profiles set profile_published_at=now(),status='paused'");await identity();await check('paused provider hidden even with publication timestamp',assertHidden);
 await root("update seller_profiles set status='approved'");
 for(const direction of [0,1]) {await root('truncate blocks');await db.query('insert into blocks values($1,$2)',direction?[seller,buyer]:[buyer,seller]);await identity(buyer,'authenticated');await check('block direction '+direction+' hides directory and related public reads',assertHidden);}
 await identity();await check('anonymous directory remains public rather than pretending to identify blocked visitors',async()=>assert.equal((await directory()).length,1));
 await identity(admin,'authenticated');await check('admin directory also omits expired credentials despite management read permissions',async()=>assert.equal((await directory())[0].credentials.length,1));
 await root('truncate blocks');await identity(buyer,'authenticated');await check('unblock restores eligible provider without republishing',async()=>assert.equal((await directory()).length,1));
 await root(`alter table services add column required_credential_types text[] not null default '{}';
 alter table seller_service_areas add column service_area_id uuid;
 update seller_service_areas set service_area_id='${buyer}';
 create table service_areas(id uuid,active boolean);insert into service_areas values('${buyer}',true);
 create table user_roles(user_id uuid,role text,revoked_at timestamptz);insert into user_roles values('${seller}','seller',null);
 alter table seller_credentials add column service_id uuid,add column issue_date date;
 create table verification_cases(seller_id uuid,verification_type text,status text,expires_at timestamptz);
 update services set required_credential_types=array['identity','current_license'];`);
 await identity();
 await check('reproduces public clinical service advertised with incomplete requirements',async()=>assert.equal((await directory())[0].services.length,1));
 await root('');
 const eligibility=await readFile(new URL('../supabase/migrations/20261006060000_enforce_provider_service_credentials.sql',import.meta.url),'utf8');
 await db.exec(eligibility.slice(eligibility.indexOf('create function app_private.provider_service_eligible'),eligibility.indexOf('create or replace function app_private.validate_booking_quote_eligibility')));
 await db.exec(await readFile(new URL('../supabase/migrations/20261006070000_align_public_service_eligibility.sql',import.meta.url),'utf8'));
 await identity();
 await check('incomplete service and otherwise empty provider omitted publicly',async()=>{assert.equal((await directory()).length,0);assert.equal((await db.query('select * from seller_services')).rows.length,0);});
 await identity(seller,'authenticated');
 await check('owner retains incomplete service management but not misleading directory listing',async()=>{assert.equal((await db.query('select * from seller_services')).rows.length,1);assert.equal((await directory()).length,0);});
 await root(`insert into verification_cases values('${seller}','Government identity','approved',null)`);await identity();
 await check('private identity evidence qualifies public service without public evidence access',async()=>{assert.equal((await directory())[0].services.length,1);await assert.rejects(db.query('select * from verification_cases'),/permission denied/);});
 await check('public wrapper cannot expose eligibility of arbitrary or private identities',async()=>{assert.equal((await db.query('select app_private.provider_directory_service_visible($1,$2) as visible',[admin,buyer])).rows[0].visible,false);await assert.rejects(db.query('select app_private.provider_service_eligible($1,$2,$3)',[seller,buyer,buyer]),/permission denied/);});
 await root("update seller_credentials set issue_date=(now() at time zone 'America/Nassau')::date+1 where credential_type='current_license'");await identity();
 await check('future-issued credential neither displayed nor accepted for discovery',async()=>{assert.equal((await directory()).length,0);assert.equal((await db.query('select * from seller_credentials')).rows.length,0);});
 await root("update seller_credentials set issue_date=null;update services set required_credential_types='{}'");await identity();
 await check('household service without credential requirements remains discoverable',async()=>assert.equal((await directory())[0].services.length,1));
 await root("update user_roles set revoked_at=now()");await identity();await check('revoked provider role removes service and profile from directory',async()=>assert.equal((await directory()).length,0));
 await root('update user_roles set revoked_at=null;update service_areas set active=false');await identity();await check('inactive coverage region removes otherwise eligible listing',async()=>assert.equal((await directory()).length,0));
 await root('update service_areas set active=true');
 for(const direction of [0,1]) {await root('truncate blocks');await db.query('insert into blocks values($1,$2)',direction?[seller,buyer]:[buyer,seller]);await identity(buyer,'authenticated');await check('service helper respects block direction '+direction,async()=>assert.equal((await db.query('select app_private.provider_directory_service_visible($1,$2) as visible',[seller,buyer])).rows[0].visible,false));}
 await root('truncate blocks');
 await db.query('insert into services values($1,$2,$3,true,$4)',[admin,'Nursing','home-nursing',['rn_license']]);
 await db.query('insert into seller_services(seller_id,service_id,active) values($1,$2,true)',[seller,admin]);await identity();
 await check('mixed provider lists eligible household service but not unqualified nursing',async()=>assert.deepEqual((await directory())[0].services.map(s=>s.name),['Dog walker']));
 await identity(admin,'authenticated');await check('admin management bypass does not reintroduce incomplete public services',async()=>{assert.equal((await db.query('select * from seller_services')).rows.length,2);assert.deepEqual((await directory())[0].services.map(s=>s.name),['Dog walker']);});
 await root(`create role service_role;
 alter table badges add column rule_version integer not null default 1,add column validity_days integer;
 alter table user_badges add column id uuid default gen_random_uuid(),add column source_type text not null default 'rule',add column source_id uuid,
   add column rule_version integer not null default 1,add column metric_snapshot jsonb not null default '{}',add column revoked_reason text;
 create unique index user_badges_active_source on user_badges(user_id,badge_id,source_type,source_id) where revoked_at is null;
 alter table user_badges enable row level security;
 create policy user_badges_public on user_badges for select to anon,authenticated using(revoked_at is null or user_id=auth.uid() or app_private.has_admin_permission('badges.manage'));
 alter table verification_cases add column id uuid default gen_random_uuid(),add column decided_at timestamptz default now();
 create table seller_documents(seller_id uuid,document_type text,status text,uploaded_at timestamptz,issue_date date,expiry_date date);
 insert into seller_documents values('${seller}','Government identity','approved',now()-interval '1 day',null,(now() at time zone 'America/Nassau')::date);
 alter table seller_documents add column id uuid default gen_random_uuid();
 alter table seller_credentials add column source_document_id uuid,add column verified_by uuid;
 create table background_checks(seller_id uuid,verification_case_id uuid,status text,completed_at timestamptz,expires_at timestamptz);
 create table badge_evaluation_runs(badge_id uuid,rule_version integer,user_id uuid,metrics_snapshot jsonb,result boolean,result_reason text);
 update seller_profiles set rating_average=4.8,rating_count=10,response_rate=90,completed_bookings=25;
 `);
 const autoBadgeCodes=['identity_verified','highly_rated','reliable_responder','experienced_seller'];
 const badgeIds=Object.fromEntries([...autoBadgeCodes,'custom_community','credential_verified','background_checked'].map((code,i)=>[code,`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
 for(const [code,id] of Object.entries(badgeIds))await db.query('insert into badges(id,code,name,icon_key,active,public) values($1,$2,$2,$2,true,true)',[id,code]);
 await check('reproduces REST upsert conflict inference against partial active-award index',async()=>await assert.rejects(db.query("insert into user_badges(user_id,badge_id,source_type,source_id) values($1,$2,'rule',$1) on conflict(user_id,badge_id,source_type,source_id) do nothing",[seller,badgeIds.identity_verified]),/no unique or exclusion constraint/));
 await db.exec(await readFile(new URL('../supabase/migrations/20261006100000_current_provider_badges.sql',import.meta.url),'utf8'));
 const evaluate=async(after=null,limit=100)=>(await db.query('select public.evaluate_provider_badges($1,$2) as result',[after,limit])).rows[0].result;
 const publicBadgeCodes=async()=>((await directory())[0]?.badges ?? []).map(item=>item.code).sort();
 for(const [id,role] of [['','anon'],[seller,'authenticated'],[admin,'authenticated']]) {
  await identity(id,role);await check(`${role} ${id||'visitor'} cannot invoke award mutations`,async()=>await assert.rejects(evaluate(),/permission denied/));
 }
 await identity('','service_role');
 await check('service-only batch awards four supported rules and no custom rule',async()=>{const result=await evaluate();assert.equal(result.awarded,4);assert.equal(result.evaluated,4);assert.equal(result.revoked,0);assert.equal(result.next_cursor,null);});
 await check('repeat badge evaluation awards zero duplicates',async()=>assert.equal((await evaluate()).awarded,0));
 await check('invalid badge batch limits are rejected',async()=>{for(const size of [null,0,201])await assert.rejects(evaluate(null,size),/invalid_page_size/);});
 await identity();await check('anonymous directory shows only current supported awards',async()=>assert.deepEqual(await publicBadgeCodes(),[...autoBadgeCodes].sort()));
 await check('public badge predicate exposes no private evidence or private qualification RPC',async()=>{await assert.rejects(db.query('select * from seller_documents'),/permission denied/);await assert.rejects(db.query('select app_private.provider_rule_badge_eligible($1,$2)',[seller,'identity_verified']),/permission denied/);assert.equal((await db.query('select app_private.provider_badge_visible($1,$2) as visible',[admin,badgeIds.identity_verified])).rows[0].visible,false);});
 await root("update seller_documents set expiry_date=(now() at time zone 'America/Nassau')::date-1");await identity();
 await check('expired identity evidence immediately hides badge before worker runs',async()=>assert.ok(!(await publicBadgeCodes()).includes('identity_verified')));
 await identity('','service_role');await check('expiry revokes automated identity award exactly once',async()=>{assert.equal((await evaluate()).revoked,1);assert.equal((await evaluate()).revoked,0);});
 await root("update seller_documents set expiry_date=(now() at time zone 'America/Nassau')::date");await identity('','service_role');
 await check('renewed evidence earns a fresh award without deleting revoked history',async()=>{assert.equal((await evaluate()).awarded,1);await root('');const rows=(await db.query('select revoked_at from user_badges where badge_id=$1',[badgeIds.identity_verified])).rows;assert.equal(rows.length,2);assert.equal(rows.filter(row=>row.revoked_at===null).length,1);});
 const evidenceMutations=[
  ["update verification_cases set status='pending'", "update verification_cases set status='approved'"],
  ["update verification_cases set expires_at=now()-interval '1 second'", "update verification_cases set expires_at=null"],
  ["update verification_cases set decided_at=null", "update verification_cases set decided_at=now()"],
  ["update verification_cases set decided_at=now()+interval '1 day'", "update verification_cases set decided_at=now()"],
  ["update seller_documents set status='revoked'", "update seller_documents set status='approved'"],
  ["update seller_documents set issue_date=(now() at time zone 'America/Nassau')::date+1", "update seller_documents set issue_date=null"],
  ["update seller_documents set uploaded_at=now()+interval '1 day'", "update seller_documents set uploaded_at=now()-interval '1 day'"],
 ];
 for(const [change,restore] of evidenceMutations){await root(change);await identity();await check(change+' cannot retain a public identity badge',async()=>assert.ok(!(await publicBadgeCodes()).includes('identity_verified')));await root(restore);}
 await root(`insert into user_badges(user_id,badge_id,source_type,source_id,rule_version) values('${seller}','${badgeIds.custom_community}','admin','${admin}',1),('${seller}','${badgeIds.identity_verified}','admin','${admin}',1);update seller_documents set status='revoked'`);
 await identity('','service_role');await evaluate();await root('');
 await check('automatic revocation preserves manual and custom award records',async()=>assert.equal((await db.query("select count(*)::int as n from user_badges where source_type='admin' and revoked_at is null")).rows[0].n,2));
 await identity();await check('custom public award remains but manual identity label still requires current facts',async()=>{const codes=await publicBadgeCodes();assert.ok(codes.includes('custom_community'));assert.ok(!codes.includes('identity_verified'));});
 await root('update seller_profiles set rating_average=4.7');await identity();await check('rating threshold change hides stale earned badge without waiting for worker',async()=>assert.ok(!(await publicBadgeCodes()).includes('highly_rated')));
 await identity('','service_role');await check('failed earned rule revokes its old automated award',async()=>assert.equal((await evaluate()).revoked,1));
 await root(`update badges set rule_version=2,validity_days=1 where code='experienced_seller'`);await identity();
 await check('old rule-version awards are hidden until reevaluation',async()=>assert.ok(!(await publicBadgeCodes()).includes('experienced_seller')));
 await identity('','service_role');await check('version change replaces award and applies validity duration',async()=>{const result=await evaluate();assert.equal(result.revoked,1);assert.equal(result.awarded,1);await root('');const row=(await db.query('select rule_version,expires_at>now() as current from user_badges where badge_id=$1 and revoked_at is null',[badgeIds.experienced_seller])).rows[0];assert.equal(row.rule_version,2);assert.equal(row.current,true);});
 await root(`update user_badges set expires_at=now()-interval '1 second' where badge_id='${badgeIds.experienced_seller}' and revoked_at is null`);await identity();
 await check('award-level expiry is hidden before reevaluation',async()=>assert.ok(!(await publicBadgeCodes()).includes('experienced_seller')));
 await identity('','service_role');await check('still-eligible expired award is renewed with preserved history',async()=>{const result=await evaluate();assert.equal(result.awarded,1);assert.equal(result.revoked,1);});
 await root("update badges set active=false where code='reliable_responder'");await identity('','service_role');await check('inactive badge catalog entry revokes its automated award',async()=>assert.equal((await evaluate()).revoked,1));
 await root("update profiles set account_status='suspended'");await identity();await check('suspended provider exposes no raw public badge rows',async()=>assert.equal((await db.query('select * from user_badges')).rows.length,0));
 await identity(seller,'authenticated');await check('owner retains historical award management records',async()=>assert.ok((await db.query('select * from user_badges')).rows.length>4));
 await root("update profiles set account_status='active';update seller_documents set status='approved'");await identity('','service_role');await evaluate();
 await root('');await db.query('insert into blocks values($1,$2)',[buyer,seller]);await identity(buyer,'authenticated');await check('blocked caller cannot query public badge predicate or raw badge rows',async()=>{assert.equal((await db.query('select * from user_badges')).rows.length,0);assert.equal((await db.query('select app_private.provider_badge_visible($1,$2) as visible',[seller,badgeIds.identity_verified])).rows[0].visible,false);});await root('truncate blocks');
 await identity(admin,'authenticated');await check('admin directory applies badge qualification even with broad management read access',async()=>assert.ok(!(await publicBadgeCodes()).includes('highly_rated')));
 await root(`insert into user_badges(user_id,badge_id,source_type,source_id) values
 ('${seller}','${badgeIds.credential_verified}','admin','${admin}'),('${seller}','${badgeIds.background_checked}','admin','${admin}')`);
 await identity();await check('manual credential and background labels cannot rely on legacy rows or copied safety summaries',async()=>{const codes=await publicBadgeCodes();assert.ok(!codes.includes('credential_verified'));assert.ok(!codes.includes('background_checked'));});
 const credentialDocument='30000000-0000-4000-8000-000000000001',backgroundCase='30000000-0000-4000-8000-000000000002';
 await root(`insert into seller_documents(id,seller_id,document_type,status,uploaded_at,issue_date,expiry_date)
 values('${credentialDocument}','${seller}','current_license','approved',now()-interval '1 day',(now() at time zone 'America/Nassau')::date-1,(now() at time zone 'America/Nassau')::date);
 update seller_credentials set source_document_id='${credentialDocument}',verified_by='${admin}',verified_at=now() where credential_type='current_license';
 insert into verification_cases(id,seller_id,verification_type,status,decided_at) values('${backgroundCase}','${seller}','background_check','approved',now());
 insert into background_checks values('${seller}','${backgroundCase}','approved',now()-interval '1 day',now()+interval '1 day');`);
 await identity();await check('reviewed current credential evidence and authoritative screening qualify manual labels',async()=>{const codes=await publicBadgeCodes();assert.ok(codes.includes('credential_verified'));assert.ok(codes.includes('background_checked'));await assert.rejects(db.query('select * from background_checks'),/permission denied/);});
 const credentialMutations=[
  ["status='revoked'","status='approved'"],
  ["verified_by=null",`verified_by='${admin}'`],
  ["verified_at=null","verified_at=now()"],
  ["verified_at=now()+interval '1 day'","verified_at=now()"],
  ["issue_date=(now() at time zone 'America/Nassau')::date+1","issue_date=null"],
  ["expiry_date=(now() at time zone 'America/Nassau')::date-1","expiry_date=(now() at time zone 'America/Nassau')::date"],
  ["source_document_id=null",`source_document_id='${credentialDocument}'`],
 ];
 for(const [change,restore] of credentialMutations){await root(`update seller_credentials set ${change} where credential_type='current_license'`);await identity();await check('credential badge hides on '+change,async()=>assert.ok(!(await publicBadgeCodes()).includes('credential_verified')));await root(`update seller_credentials set ${restore} where credential_type='current_license'`);}
 const credentialEvidenceMutations=[
  ["status='revoked'","status='approved'"],
  [`seller_id='${buyer}'`,`seller_id='${seller}'`],
  ["document_type='unrelated'","document_type='current_license'"],
  ["uploaded_at=now()+interval '1 day'","uploaded_at=now()-interval '1 day'"],
  ["issue_date=(now() at time zone 'America/Nassau')::date+1","issue_date=null"],
  ["expiry_date=(now() at time zone 'America/Nassau')::date-1","expiry_date=(now() at time zone 'America/Nassau')::date"],
 ];
 for(const [change,restore] of credentialEvidenceMutations){await root(`update seller_documents set ${change} where id='${credentialDocument}'`);await identity();await check('credential source evidence hides badge on '+change,async()=>assert.ok(!(await publicBadgeCodes()).includes('credential_verified')));await root(`update seller_documents set ${restore} where id='${credentialDocument}'`);}
 const screeningMutations=[
  ['background_checks',"status='pending'","status='approved'"],
  ['background_checks',"completed_at=null","completed_at=now()"],
  ['background_checks',"completed_at=now()+interval '1 day'","completed_at=now()"],
  ['background_checks',"expires_at=now()-interval '1 second'","expires_at=now()+interval '1 day'"],
  ['verification_cases',"status='revoked'","status='approved'"],
  ['verification_cases',"decided_at=null","decided_at=now()"],
  ['verification_cases',"decided_at=now()+interval '1 day'","decided_at=now()"],
  ['verification_cases',"expires_at=now()-interval '1 second'","expires_at=null"],
  ['verification_cases',"verification_type='identity'","verification_type='background_check'"],
  ['verification_cases',`seller_id='${buyer}'`,`seller_id='${seller}'`],
 ];
 for(const [table,change,restore] of screeningMutations){const where=table==='verification_cases'?` where id='${backgroundCase}'`:'';await root(`update ${table} set ${change}${where}`);await identity();await check('screening badge hides on '+table+' '+change,async()=>assert.ok(!(await publicBadgeCodes()).includes('background_checked')));await root(`update ${table} set ${restore}${where}`);}
 await identity('','service_role');await check('evaluation does not auto-issue or revoke credential and background manual awards',async()=>{const result=await evaluate();assert.equal(result.evaluated,4);assert.equal(result.awarded,0);assert.equal(result.revoked,0);await root('');assert.equal((await db.query("select count(*)::int as n from user_badges where source_type='admin' and badge_id=any($1::uuid[]) and revoked_at is null",[[badgeIds.credential_verified,badgeIds.background_checked]])).rows[0].n,2);});
 await root(`insert into profiles(id,account_status) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'active' from generate_series(1,103) n;
 insert into seller_profiles(user_id,status) select id,'draft' from profiles where id::text like '20000000-%';`);await identity('','service_role');
 await check('worker pagination traverses more than 100 providers without gaps or endless cursor',async()=>{const first=await evaluate();assert.equal(first.providers,100);assert.ok(first.next_cursor);const second=await evaluate(first.next_cursor);assert.equal(second.providers,4);assert.equal(second.next_cursor,null);assert.equal(first.providers+second.providers,104);});
 await root(`create function app_private.qa_fail_badge_page() returns trigger language plpgsql as $$begin
 if new.user_id='20000000-0000-4000-8000-000000000001'::uuid then raise exception 'qa_injected_badge_failure';end if;return new;end$$;
 create trigger qa_badge_page_failure before insert on badge_evaluation_runs for each row execute function app_private.qa_fail_badge_page();
 update seller_profiles set rating_average=4.9 where user_id='${seller}';`);
 const beforeFailure=(await db.query('select (select count(*)::int from user_badges) as awards,(select count(*)::int from badge_evaluation_runs) as evaluations')).rows[0];
 await identity('','service_role');await check('later provider failure rolls back the entire badge page',async()=>{await assert.rejects(evaluate(),/qa_injected_badge_failure/);await root('');const after=(await db.query('select (select count(*)::int from user_badges) as awards,(select count(*)::int from badge_evaluation_runs) as evaluations')).rows[0];assert.deepEqual(after,beforeFailure);assert.equal((await db.query('select count(*)::int as n from user_badges where badge_id=$1 and revoked_at is null',[badgeIds.highly_rated])).rows[0].n,0);});
 await root('drop trigger qa_badge_page_failure on badge_evaluation_runs;drop function app_private.qa_fail_badge_page()');await identity('','service_role');
 await check('retry after rolled-back page awards once and repeat remains idempotent',async()=>{assert.equal((await evaluate()).awarded,1);assert.equal((await evaluate()).awarded,0);});
 console.log(`${checks} provider-directory and badge SQL checks passed; isolated PostgreSQL fixture.`);
} catch(error) {console.error(error);process.exitCode=1;} finally {await db.close();}
