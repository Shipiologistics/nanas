import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite();
const buyer='00000000-0000-0000-0000-000000000001',seller='00000000-0000-0000-0000-000000000002',outsider='00000000-0000-0000-0000-000000000003';
const service='00000000-0000-0000-0000-000000000010',area='00000000-0000-0000-0000-000000000020',plan='00000000-0000-0000-0000-000000000030';
let checks=0;const check=async(name,fn)=>{await fn();console.log('PASS '+name);checks++;};
const identity=async(uid,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('qa.uid',$1,false)",[uid]);await db.exec('set role '+role);};
const feed=async(sort='recommended',page=0,size=20,query='',id=null)=>(await db.query('select public.provider_request_feed($1,$2,\'all\',\'all\',$3,$4,$5) value',[sort,query,page,size,id])).rows[0].value;
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;
 grant usage on schema auth,app_private to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
 create function app_private.has_role(text) returns boolean language sql stable as $$select $1='seller' and auth.uid() in('${seller}'::uuid,'${outsider}'::uuid)$$;
 create table job_posting_plans(id uuid primary key,code text,featured boolean,fee_minor bigint,duration_days int);
 insert into job_posting_plans values('${plan}','premium',true,1900,30);
 create table services(id uuid primary key,name text,active boolean);insert into services values('${service}','Pet care',true);
 create table service_areas(id uuid primary key,name text,active boolean);insert into service_areas values('${area}','Nassau',true);
 create table seller_profiles(user_id uuid primary key,status text,profile_published_at timestamptz);insert into seller_profiles values('${seller}','approved',now()),('${outsider}','draft',null);
 create table seller_services(seller_id uuid,service_id uuid,active boolean);insert into seller_services values('${seller}','${service}',true),('${outsider}','${service}',true);
 create table seller_service_areas(seller_id uuid,service_area_id uuid,active boolean);insert into seller_service_areas values('${seller}','${area}',true),('${outsider}','${area}',true);
 create table blocks(blocker_user_id uuid,blocked_user_id uuid);
 create table booking_requests(id uuid primary key default gen_random_uuid(),buyer_id uuid default '${buyer}',service_id uuid default '${service}',service_area_id uuid default '${area}',mode text default 'scheduled',desired_start timestamptz,desired_end timestamptz,care_summary text,budget_minor bigint,status text default 'requested',created_at timestamptz,published_until timestamptz);
 create table booking_quotes(id uuid primary key default gen_random_uuid(),request_id uuid,seller_id uuid);
 create table booking_request_publications(request_id uuid primary key,plan_id uuid,plan_code text,fee_minor_snapshot bigint,duration_days_snapshot int,payment_status text,expires_at timestamptz);
 insert into booking_requests(desired_start,desired_end,care_summary,budget_minor,created_at) select now()+interval '10 days'+i*interval '1 day',now()+interval '10 days 1 hour'+i*interval '1 day','QA request '||i,i*100,now()-i*interval '1 hour' from generate_series(1,205) i;
 insert into booking_request_publications select id,'${plan}','premium',1900,30,'simulated_paid',now()+interval '30 days' from booking_requests where care_summary='QA request 205';
 `);
 await db.exec(await readFile(new URL('../supabase/migrations/20261006020000_provider_request_discovery.sql',import.meta.url),'utf8'));
 // Run all pagination/search checks against the latest credential-aware feed.
 await db.exec(`
 create table profiles(id uuid primary key,account_status text,deleted_at timestamptz);
 insert into profiles values('${seller}','active',null),('${outsider}','active',null),('${buyer}','active',null);
 create table user_roles(user_id uuid,role text,revoked_at timestamptz);
 insert into user_roles values('${seller}','seller',null),('${outsider}','seller',null);
 alter table services add column required_credential_types text[] not null default '{}';
 create table seller_credentials(seller_id uuid,service_id uuid,credential_type text,status text,issue_date date,expiry_date date);
 create table verification_cases(seller_id uuid,verification_type text,status text,expires_at timestamptz);
 alter table booking_quotes add column buyer_id uuid default '${buyer}';
 alter table booking_quotes add column service_id uuid default '${service}';
 create table bookings(id uuid,request_id uuid,quote_id uuid,buyer_id uuid,seller_id uuid,service_id uuid);
 insert into bookings(id,request_id,buyer_id,seller_id,service_id)
   select gen_random_uuid(),id,buyer_id,'${seller}',service_id from booking_requests where care_summary='QA request 203';
 create function app_private.validate_booking_quote_eligibility() returns trigger language plpgsql as $$begin return new;end$$;
 create trigger booking_quotes_validate_eligibility before insert on booking_quotes for each row execute function app_private.validate_booking_quote_eligibility();
 `);
 await db.exec(await readFile(new URL('../supabase/migrations/20261006060000_enforce_provider_service_credentials.sql',import.meta.url),'utf8'));
 await db.exec(`update profiles set account_status='restricted' where id='${buyer}'`);await identity(seller);
 await check('before repair: restricted buyers requests remain discoverable and readable through the RLS predicate',async()=>{
   const f=await feed();assert.equal(f.total,205);
   assert.equal((await db.query('select app_private.can_view_seller_request($1) value',[f.items[0].id])).rows[0].value,true);
 });
 await db.exec(`reset role;update profiles set account_status='active' where id='${buyer}'`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261006150000_hide_unavailable_buyer_requests.sql',import.meta.url),'utf8'));
 await identity('', 'anon');await check('anonymous cannot invoke provider feed',async()=>await assert.rejects(feed(),/permission denied/));
 await identity(buyer);await check('buyer cannot invoke provider-only feed',async()=>await assert.rejects(feed(),/provider_required/));
 await identity(outsider);await check('unapproved unpublished provider receives no requests',async()=>assert.equal((await feed()).total,0));
 await identity(seller);
 await check('recommended prioritizes featured before pagination beyond the old 200 limit',async()=>{const f=await feed();assert.equal(f.total,205);assert.equal(f.items.length,20);assert.equal(f.items[0].care_summary,'QA request 205');assert.equal(f.items[0].featured,true);});
 await check('newest uses creation not future appointment date',async()=>assert.equal((await feed('newest')).items[0].care_summary,'QA request 1'));
 await check('explicit budget and soonest ignore featured priority',async()=>{assert.equal((await feed('budget')).items[0].care_summary,'QA request 205');assert.equal((await feed('soonest')).items[0].care_summary,'QA request 1');});
 await check('global search runs before pagination and literal wildcards are not expanded',async()=>{assert.equal((await feed('newest',0,20,'QA request 205')).total,1);assert.equal((await feed('newest',0,20,'%')).total,0);});
 await check('pagination is complete and deterministic with no duplicate requests',async()=>{const ids=[];for(let page=0;page<11;page++)ids.push(...(await feed('recommended',page)).items.map(r=>r.id));assert.equal(ids.length,205);assert.equal(new Set(ids).size,205);});
 const featured=(await feed()).items[0];
 await check('detail projection returns an eligible request outside the first page',async()=>assert.equal((await feed('newest',0,20,'',featured.id)).items[0].id,featured.id));
 await check('projection excludes private and payment data',async()=>{assert.deepEqual(Object.keys(featured).sort(),['id','buyer_id','service_id','service_area_id','service','area','mode','desired_start','desired_end','care_summary','budget_minor','status','created_at','published_until','featured','quote_count','has_quoted'].sort());});
 await db.exec('reset role');await db.query('insert into booking_quotes(request_id,seller_id) values($1,$2)',[featured.id,seller]);await identity(seller);
 await check('own quote flag and total are not limited to client quote hydration',async()=>{const row=(await feed()).items[0];assert.equal(row.has_quoted,true);assert.equal(row.quote_count,1);assert.equal((await feed('quotes')).items[0].has_quoted,false);});
 await check('invalid sorts, pagination and query length are rejected',async()=>{await assert.rejects(feed('invalid'),/invalid_discovery_filter/);await assert.rejects(feed('newest',-1),/invalid_discovery_filter/);await assert.rejects(feed('newest',0,51),/invalid_discovery_filter/);await assert.rejects(feed('newest',0,20,'a'.repeat(201)),/invalid_discovery_filter/);});
 await db.exec('reset role');await db.exec("update job_posting_plans set featured=false");await identity(seller);
 await check('later plan edits do not revoke purchased historical featured benefit',async()=>assert.equal((await feed()).items[0].featured,true));
 await db.exec('reset role');
 const next=(await db.query("select id from booking_requests where care_summary='QA request 204'")).rows[0].id;
 await db.query("insert into booking_request_publications(request_id,plan_id,plan_code,fee_minor_snapshot,duration_days_snapshot,payment_status,expires_at,featured_snapshot) values($1,$2,'premium',1900,30,'simulated_paid',now()+interval '30 days',true)",[next,plan]);
 await check('new publication snapshots actual plan rather than submitted flag',async()=>assert.equal((await db.query('select featured_snapshot from booking_request_publications where request_id=$1',[next])).rows[0].featured_snapshot,false));
 await db.query('update booking_request_publications set expires_at=now()-interval \'1 second\' where request_id=$1',[featured.id]);await identity(seller);
 await check('expired publication disappears even with an existing provider quote',async()=>{await db.exec('reset role');await db.query('insert into booking_quotes(request_id,seller_id) values($1,$2)',[featured.id,seller]);await identity(seller);assert.equal((await feed('newest',0,20,'',featured.id)).total,0);});
 await db.exec('reset role');await db.query("update booking_request_publications set payment_status='refunded' where request_id=$1",[next]);await identity(seller);
 await check('refunded publication is not advertised',async()=>assert.equal((await feed('newest',0,20,'',next)).total,0));
 for(const direction of [0,1]){await db.exec('reset role');await db.exec('truncate blocks');await db.query('insert into blocks values($1,$2)',direction?[buyer,seller]:[seller,buyer]);await identity(seller);await check('block direction '+direction+' hides discovery and counts',async()=>assert.equal((await feed()).total,0));}
 await db.exec('reset role;truncate blocks;update seller_services set active=false');await identity(seller);
 await check('inactive service removes requests',async()=>assert.equal((await feed()).total,0));
 await db.exec('reset role;update seller_services set active=true;update seller_service_areas set active=false');await identity(seller);
 await check('inactive coverage removes requests',async()=>assert.equal((await feed()).total,0));
 const nursing='21000000-0000-0000-0000-000000000002';
 await db.exec('reset role;update seller_service_areas set active=true');
 await db.query("insert into services(id,name,active) values($1,'Home nursing',true)",[nursing]);
 const nursingRequest=(await db.query("insert into booking_requests(service_id,desired_start,desired_end,care_summary,budget_minor,created_at) values($1,now()+interval '1 day',now()+interval '1 day 2 hours','QA nursing exact-service request',10402,now()) returning id",[nursing])).rows[0].id;
 await identity(seller);
 await check('unrelated service provider cannot discover nursing request',async()=>assert.equal((await feed('newest',0,20,'',nursingRequest)).total,0));
 await db.exec('reset role');await db.query('insert into seller_services values($1,$2,true)',[seller,nursing]);await identity(seller);
 await check('exact nursing service matches without changing the requested service or budget',async()=>{const f=await feed('newest',0,20,'',nursingRequest);assert.equal(f.total,1);assert.equal(f.items[0].service_id,nursing);assert.equal(f.items[0].service,'Home nursing');assert.equal(f.items[0].budget_minor,10402);});
 await db.exec('reset role');
 const activeBuyer='00000000-0000-0000-0000-000000000004',admin='00000000-0000-0000-0000-000000000005';
 await db.exec(`update profiles set account_status='restricted' where id='${buyer}';
   insert into profiles values('${activeBuyer}','active',null);
   create function app_private.has_admin_permission(text) returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid and $1='bookings.read'$$;
   grant usage on schema auth,app_private to authenticated;
   alter table profiles enable row level security;grant select on profiles to authenticated;
   create policy profiles_own on profiles for select to authenticated using(id=auth.uid());
   alter table booking_requests enable row level security;grant select on booking_requests to authenticated;`);
 const requestPolicy=await readFile(new URL('../supabase/migrations/20261005101000_restore_eligible_request_visibility.sql',import.meta.url),'utf8');
 await db.exec(requestPolicy.slice(requestPolicy.indexOf('drop policy')));
 await identity(seller);
 await check('restricted buyer is excluded from every feed sort, direct detail and global totals',async()=>{
   for(const sort of ['recommended','newest','soonest','budget','quotes']){const f=await feed(sort);assert.equal(f.total,0);assert.deepEqual(f.items,[]);}
   assert.equal((await feed('newest',0,20,'',nursingRequest)).total,0);
   assert.equal((await db.query('select id from booking_requests where id=$1',[nursingRequest])).rows.length,0);
 });
 await check('prior quoted request remains readable but is not advertised as new work',async()=>{
   assert.equal((await db.query('select id from booking_requests where id=$1',[featured.id])).rows.length,1);
   assert.equal((await feed('newest',0,20,'',featured.id)).total,0);
 });
 await db.exec('reset role');
 const historicalBookedRequest=(await db.query('select request_id from bookings')).rows[0].request_id;
 await identity(seller);
 await check('booked request history remains readable without reopening discovery',async()=>{
   assert.equal((await db.query('select id from booking_requests where id=$1',[historicalBookedRequest])).rows.length,1);
   assert.equal((await feed('newest',0,20,'',historicalBookedRequest)).total,0);
 });
 await identity(buyer);
 await check('restricted buyer retains own request history',async()=>assert.equal((await db.query('select id from booking_requests')).rows.length,206));
 await identity(admin);
 await check('authorized admin retains request review access',async()=>assert.equal((await db.query('select id from booking_requests')).rows.length,206));
 await identity(outsider);
 await check('unrelated unapproved provider cannot read restricted-buyer history',async()=>{
   assert.equal((await db.query('select id from booking_requests')).rows.length,0);assert.equal((await feed()).total,0);
 });
 await db.exec('reset role');
 await db.query("insert into booking_requests(buyer_id,desired_start,desired_end,care_summary,budget_minor,created_at) select $1,now()+interval '2 days',now()+interval '2 days 1 hour','Active buyer QA '||i,5000,now()-i*interval '1 minute' from generate_series(1,25) i",[activeBuyer]);
 await identity(seller);
 await check('filtering precedes pagination and counts while private buyer profiles stay hidden',async()=>{
   assert.equal((await db.query('select id from profiles where id=$1',[activeBuyer])).rows.length,0);
   const a=await feed('newest'),b=await feed('newest',1),c=await feed('newest',2);
   assert.equal(a.total,25);assert.equal(a.items.length,20);assert.equal(b.items.length,5);assert.equal(c.items.length,0);
   assert.equal(new Set([...a.items,...b.items].map(r=>r.id)).size,25);
   assert.ok([...a.items,...b.items].every(r=>r.buyer_id===activeBuyer));
 });
 for(const status of ['pending','suspended','closed','restricted']) {
   await db.exec('reset role');await db.query('update profiles set account_status=$1 where id=$2',[status,activeBuyer]);await identity(seller);
   await check(status+' buyer is excluded from discovery and unquoted RLS reads',async()=>{
     assert.equal((await feed()).total,0);assert.equal((await db.query('select id from booking_requests where buyer_id=$1',[activeBuyer])).rows.length,0);
   });
 }
 await db.exec('reset role');await db.query("update profiles set account_status='active',deleted_at=now() where id=$1",[activeBuyer]);await identity(seller);
 await check('soft-deleted active buyer remains excluded',async()=>assert.equal((await feed()).total,0));
 await db.exec('reset role');await db.query('update profiles set deleted_at=null where id=$1',[activeBuyer]);await identity(seller);
 await check('restored buyer reappears without exposing account-state fields',async()=>{
   const f=await feed();assert.equal(f.total,25);
   assert.ok(f.items.every(r=>!('account_status' in r)&&!('deleted_at' in r)&&!('suspended_reason' in r)));
 });
 await db.exec(`reset role;update profiles set account_status='restricted' where id='${seller}';`);await identity(seller);
 await check('restricted provider keeps own quoted history but receives no new work',async()=>{
   assert.equal((await feed()).total,0);assert.equal((await db.query('select id from booking_requests where id=$1',[featured.id])).rows.length,1);
 });
 await db.exec('reset role;set role anon');
 await check('anonymous users cannot call provider feed or history predicate after replacement',async()=>{
   await assert.rejects(feed(),/permission denied/);
   await assert.rejects(db.query('select app_private.can_view_seller_request($1)',[featured.id]),/permission denied/);
 });
 console.log(`${checks} provider discovery SQL checks passed; isolated fixture, not full Supabase runtime.`);
} catch(error){console.error(error);process.exitCode=1;} finally{await db.close();}
