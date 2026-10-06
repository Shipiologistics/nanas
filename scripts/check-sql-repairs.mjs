// Targeted SQL execution tests, not a replacement for a full Supabase stack.
// Usage: PGLITE_MODULE_PATH=/absolute/path/to/pglite/dist/index.js node scripts/check-sql-repairs.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PGLITE_MODULE_PATH;
if (!modulePath) throw new Error("Set PGLITE_MODULE_PATH to an installed @electric-sql/pglite entry point");
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const buyer = "00000000-0000-0000-0000-000000000001";
const seller = "00000000-0000-0000-0000-000000000002";
const admin = "00000000-0000-0000-0000-000000000003";
const outsider = "00000000-0000-0000-0000-000000000004";
const request = "00000000-0000-0000-0000-000000000010";
const pastRequest = "00000000-0000-0000-0000-000000000011";
const caseId = "00000000-0000-0000-0000-000000000020";
let checks = 0;
async function check(name, callback) {
  await callback();
  checks++;
  console.log(`PASS ${name}`);
}
async function identity(id) {
  await db.exec("reset role");
  await db.query("select set_config('qa.uid', $1, false)", [id]);
  await db.exec("set role authenticated");
}
async function migration(name) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"));
}
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema app_private;
    grant usage on schema auth,app_private to authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('qa.uid',true),'')::uuid $$;
    create function app_private.has_admin_permission(text) returns boolean language sql stable security definer as
      $$ select auth.uid()='${admin}'::uuid $$;
    create function app_private.has_role(text) returns boolean language sql stable security definer as
      $$ select ($1='seller' and auth.uid()='${seller}'::uuid) or ($1='admin' and auth.uid()='${admin}'::uuid) $$;
    create table notifications(id uuid primary key,recipient_id uuid,read_at timestamptz,archived_at timestamptz,title text);
    create table notification_preferences(user_id uuid,event_category text,in_app boolean default true,email boolean default true,unique(user_id,event_category));
    alter table notifications enable row level security;
    alter table notification_preferences enable row level security;
    create policy own_notifications on notifications for all to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
    create policy own_preferences on notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    grant select on notifications,notification_preferences to authenticated;
    insert into notifications values('${request}','${buyer}',null,null,'original');
    insert into notification_preferences values('${buyer}','messages',true,true),('${outsider}','messages',true,true);
    create type verification_status as enum('pending','needs_information','approved','rejected','expired');
    create type seller_status as enum('draft','approved','rejected','needs_information');
    create table seller_profiles(user_id uuid primary key,status seller_status,approved_at timestamptz,profile_published_at timestamptz,updated_at timestamptz);
    create table verification_cases(id uuid primary key,seller_id uuid,verification_type text,status verification_status,decision_reason text,admin_reviewer_id uuid,decided_at timestamptz,updated_at timestamptz);
    create table seller_documents(id uuid primary key,seller_id uuid,document_type text,status verification_status,updated_at timestamptz);
    create table admin_audit_logs(actor_id uuid,action text,target_type text,target_id uuid,after_redacted jsonb,reason text);
    create table notification_outbox(recipient_id uuid,template_key text,category text,priority text,variables_redacted jsonb,dedupe_key text unique);
    create table booking_requests(id uuid primary key,buyer_id uuid,service_id uuid,service_area_id uuid,status text,desired_start timestamptz,published_until timestamptz);
    create table booking_quotes(request_id uuid,seller_id uuid);
    create table bookings(request_id uuid,seller_id uuid);
    create table seller_services(seller_id uuid,service_id uuid,active boolean);
    create table seller_service_areas(seller_id uuid,service_area_id uuid,active boolean);
    create table blocks(blocker_user_id uuid,blocked_user_id uuid);
    alter table booking_requests enable row level security;
    grant select on booking_requests to authenticated;
    insert into seller_profiles values('${seller}','draft',null,null,now());
    insert into booking_requests values
      ('${request}','${buyer}','${request}','${request}','requested',now()+interval '2 days',now()+interval '3 days'),
      ('${pastRequest}','${buyer}','${request}','${request}','requested',now()-interval '2 days',null);
    insert into verification_cases values('${caseId}','${seller}','identity','pending',null,null,null,now());
    insert into seller_documents values
      ('${request}','${seller}','identity','pending',now()),
      ('${pastRequest}','${seller}','insurance','pending',now());
  `);
  const signatures = [
    ["upsert_household_member", "uuid,text,text,date,text,boolean"],
    ["seller_replace_weekly_availability", "smallint[],time,time"],
    ["seller_upsert_service_area", "uuid,numeric,bigint,boolean"],
    ["seller_upsert_service", "uuid,bigint,bigint,text,integer,text[],text[],boolean"],
    ["seller_update_public_profile", "text,text,text,text[],uuid,text,text[],text[]"],
  ];
  for (const [name, types] of signatures) {
    await db.exec(`create function app_private.${name}(${types}) returns jsonb language sql as $$ select '{}'::jsonb $$;
      create function public.${name}(${types}) returns jsonb language sql as $$ select app_private.${name}(${types.split(",").map((_,i)=>`$${i+1}`).join(",")}) $$;`);
  }
  await migration("20261005093000_restore_notification_client_permissions");
  await migration("20261005094000_name_self_service_rpc_arguments");
  await migration("20261005100000_scope_verification_decisions");
  await migration("20261005101000_restore_eligible_request_visibility");
  await check("all five unnamed wrappers can be replaced with named arguments", async () => {
    const { rows } = await db.query("select proname,proargnames from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname=any($1::text[])", [signatures.map(([n])=>n)]);
    assert.equal(rows.length, 5);
    for (const row of rows) assert.ok(row.proargnames?.every(name=>name.startsWith("p_")));
  });
  await check("anonymous predicate permission exists without anonymous table write grants", async () => {
    const { rows } = await db.query("select has_function_privilege('anon','app_private.has_admin_permission(text)','execute') as fn, has_table_privilege('anon','notifications','update') as write");
    assert.equal(rows[0].fn, true); assert.equal(rows[0].write, false);
  });
  await identity(buyer);
  await check("own preference upsert succeeds", async () => {
    await db.query("insert into notification_preferences(user_id,event_category,in_app,email) values($1,'messages',false,false) on conflict(user_id,event_category) do update set user_id=excluded.user_id,event_category=excluded.event_category,in_app=excluded.in_app,email=excluded.email", [buyer]);
    assert.equal((await db.query("select in_app from notification_preferences")).rows[0].in_app,false);
  });
  await check("foreign preference update is denied by RLS", async () => {
    assert.equal((await db.query("update notification_preferences set in_app=false where user_id=$1 returning user_id",[outsider])).rows.length,0);
  });
  await check("notification read update succeeds but content overwrite is denied", async () => {
    assert.equal((await db.query("update notifications set read_at=now() where id=$1 returning id",[request])).rows.length,1);
    await assert.rejects(db.query("update notifications set title='tampered' where id=$1",[request]),/permission denied/);
  });
  await check("buyer cannot invoke privileged verification review", async () => {
    await assert.rejects(db.query("select app_private.admin_review_verification($1,'approved','test review')",[caseId]),/permission_denied/);
  });
  await identity(seller);
  await check("draft provider cannot see the market", async () => assert.equal((await db.query("select id from booking_requests")).rows.length,0));
  await db.exec(`reset role; update seller_profiles set status='approved',profile_published_at=now(); insert into seller_services values('${seller}','${request}',true); insert into seller_service_areas values('${seller}','${request}',true);`);
  await identity(seller);
  await check("approved matching provider sees only the future request", async () => assert.deepEqual((await db.query("select id from booking_requests")).rows.map(r=>r.id),[request]));
  await db.exec(`reset role; insert into blocks values('${buyer}','${seller}');`);
  await identity(seller);
  await check("buyer block removes market visibility", async () => assert.equal((await db.query("select id from booking_requests")).rows.length,0));
  await db.exec(`reset role; insert into booking_quotes values('${request}','${seller}');`);
  await identity(seller);
  await check("existing quote history remains visible", async () => assert.deepEqual((await db.query("select id from booking_requests")).rows.map(r=>r.id),[request]));
  await identity(outsider);
  await check("unrelated buyer sees no requests", async () => assert.equal((await db.query("select id from booking_requests")).rows.length,0));
  await identity(buyer);
  await check("owner can still see current and historical requests", async () => assert.equal((await db.query("select id from booking_requests")).rows.length,2));
  await identity(admin);
  await check("admin review changes only the selected document type", async () => {
    await db.query("select app_private.admin_review_verification($1,'approved','Inspected fictional test evidence')",[caseId]);
    await db.exec("reset role");
    const { rows } = await db.query("select document_type,status from seller_documents order by document_type");
    assert.deepEqual(rows,[{document_type:"identity",status:"approved"},{document_type:"insurance",status:"pending"}]);
  });
  await identity(admin);
  await check("repeated approval is idempotent and reversal is rejected", async () => {
    const { rows } = await db.query("select app_private.admin_review_verification($1,'approved','Retry the same test decision') as result",[caseId]);
    assert.equal(rows[0].result.already_processed,true);
    await assert.rejects(db.query("select app_private.admin_review_verification($1,'rejected','Attempt to overwrite final decision')",[caseId]),/case_already_decided/);
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int as count from admin_audit_logs")).rows[0].count,1);
  });
  await db.exec(`reset role;
    alter table seller_documents add storage_path text, add metadata_redacted jsonb default '{}'::jsonb, add uploaded_at timestamptz default now();
    update seller_documents set storage_path=seller_id::text||'/private-fixture.png';
    create table admin_access_logs(admin_user_id uuid,resource_type text,resource_id uuid,purpose_code text,case_id uuid,fields_accessed text[]);
  `);
  await migration("20261005110000_verification_evidence_access");
  await identity(seller);
  await check("provider can retrieve only their case's document type", async () => {
    const { rows } = await db.query("select public.verification_evidence($1) as result", [caseId]);
    assert.deepEqual(rows[0].result.map(item => item.id), [request]);
  });
  await identity(outsider);
  await check("unrelated user cannot retrieve private evidence", async () => {
    await assert.rejects(db.query("select public.verification_evidence($1)", [caseId]), /evidence_not_found/);
  });
  await identity(admin);
  await check("admin evidence reads create a scoped audit entry", async () => {
    assert.equal((await db.query("select public.verification_evidence($1) as result", [caseId])).rows[0].result.length, 1);
    await db.exec("reset role");
    const { rows } = await db.query("select admin_user_id,case_id,purpose_code from admin_access_logs");
    assert.deepEqual(rows, [{admin_user_id:admin,case_id:caseId,purpose_code:"verification_evidence_review"}]);
    assert.equal((await db.query("select has_function_privilege('anon','public.verification_evidence(uuid)','execute') as allowed")).rows[0].allowed,false);
  });
  await db.exec(`reset role;
    alter table seller_profiles add display_name text, add headline text, add locality text, add languages text[], add island_id uuid;
    alter table seller_services add rate_minor bigint, add service_bio text, add capabilities text[];
    create table islands(id uuid primary key,active boolean);
    create table services(id uuid primary key,active boolean);
    create table service_areas(id uuid primary key,active boolean);
    create table availability_rules(seller_id uuid,active boolean);
    create table domain_events(aggregate_type text,aggregate_id uuid,event_type text,payload_redacted jsonb);
    update seller_profiles set status='draft',profile_published_at=null;
    insert into islands values('${request}',true);
    insert into services values('${request}',true);
    insert into service_areas values('${request}',true);
  `);
  await migration("20261005120000_provider_publication");
  await identity(buyer);
  await check("buyer cannot publish a provider profile", async () => {
    await assert.rejects(db.query("select public.seller_set_publication(true)"),/seller_required/);
  });
  await identity(seller);
  await check("draft provider cannot publish", async () => {
    await assert.rejects(db.query("select public.seller_set_publication(true)"),/provider_approval_required/);
  });
  await db.exec("reset role; update seller_profiles set status='approved'");
  await identity(seller);
  await check("approved but incomplete profile cannot publish", async () => {
    await assert.rejects(db.query("select public.seller_set_publication(true)"),/complete_public_profile_first/);
  });
  await db.exec(`reset role; update seller_profiles set display_name='QA Provider',headline='Fictional provider headline',locality='Nassau',languages=array['English'],island_id='${request}';`);
  await identity(seller);
  await check("publication requires a complete active service", async () => {
    await assert.rejects(db.query("select public.seller_set_publication(true)"),/complete_service_profile_first/);
  });
  await db.exec(`reset role; update seller_services set rate_minor=2500,service_bio=repeat('QA ',65),capabilities=array['Fictional'];`);
  await identity(seller);
  await check("publication requires availability", async () => {
    await assert.rejects(db.query("select public.seller_set_publication(true)"),/availability_required/);
  });
  await db.exec(`reset role; insert into availability_rules values('${seller}',true);`);
  await identity(seller);
  await check("complete provider can publish idempotently and unpublish", async () => {
    const first = (await db.query("select public.seller_set_publication(true) as result")).rows[0].result;
    const again = (await db.query("select public.seller_set_publication(true) as result")).rows[0].result;
    assert.ok(first.published_at); assert.equal(first.published_at,again.published_at);
    const hidden = (await db.query("select public.seller_set_publication(false) as result")).rows[0].result;
    assert.equal(hidden.published_at,null);
    await db.exec("reset role");
    assert.deepEqual((await db.query("select event_type from domain_events order by event_type")).rows.map(row=>row.event_type),['provider.published','provider.unpublished']);
  });
  await db.exec(`reset role;
    create table feature_flags(key text primary key,description text,enabled boolean,targeting_rules jsonb,rollout_percent smallint);
    alter table booking_quotes add id uuid, add buyer_id uuid, add expires_at timestamptz, add starts_at timestamptz;
    alter table bookings add id uuid default gen_random_uuid(), add quote_id uuid, add reference text default 'QA-SIM';
    create table payment_intents(payer_id uuid,booking_id uuid,processor text,idempotency_key text);
    update booking_quotes set id='${request}',buyer_id='${buyer}',expires_at=now()+interval '1 day',starts_at=now()+interval '2 days';
    create or replace function app_private.has_role(text) returns boolean language sql stable security definer as
      $$ select ($1='seller' and auth.uid()='${seller}'::uuid) or ($1='admin' and auth.uid()='${admin}'::uuid) or ($1='buyer' and auth.uid() in ('${buyer}'::uuid,'${outsider}'::uuid)) $$;
    create function app_private.accept_quote_with_simulated_payment(uuid,text) returns jsonb language plpgsql security definer as $$
    declare v_booking uuid; begin
      insert into public.bookings(quote_id) values($1) returning id into v_booking;
      insert into public.payment_intents values(auth.uid(),v_booking,'simulation',$2);
      return jsonb_build_object('booking_id',v_booking); end; $$;
  `);
  await migration("20261005121000_gate_connected_payment_simulation");
  await identity(buyer);
  await check("connected payment simulation is disabled by default", async () => {
    await assert.rejects(db.query("select public.accept_quote_with_simulated_payment($1,'qa-payment-key')",[request]),/test_payment_not_enabled/);
  });
  await db.exec(`reset role; update feature_flags set enabled=true,targeting_rules='{"user_ids":["${buyer}"]}'::jsonb;`);
  await identity(buyer);
  await check("both booking participants must be enrolled for simulation", async () => {
    await assert.rejects(db.query("select public.accept_quote_with_simulated_payment($1,'qa-payment-key')",[request]),/test_provider_not_enabled/);
  });
  await db.exec(`reset role; update feature_flags set targeting_rules='{"user_ids":["${buyer}","${seller}"]}'::jsonb;`);
  await identity(buyer);
  await check("simulated acceptance replays idempotently and rejects key reuse for another quote", async () => {
    const first=(await db.query("select public.accept_quote_with_simulated_payment($1,'qa-payment-key') as result",[request])).rows[0].result;
    const second=(await db.query("select public.accept_quote_with_simulated_payment($1,'qa-payment-key') as result",[request])).rows[0].result;
    assert.equal(first.booking_id,second.booking_id); assert.equal(second.replayed,true);
    await assert.rejects(db.query("select public.accept_quote_with_simulated_payment($1,'qa-payment-key')",[pastRequest]),/idempotency_key_conflict/);
  });
  await identity(outsider);
  await check("unenrolled accounts and direct core calls cannot bypass simulation gate", async () => {
    await assert.rejects(db.query("select public.accept_quote_with_simulated_payment($1,'outsider-payment-key')",[request]),/test_payment_not_enabled/);
    await assert.rejects(db.query("select app_private.accept_quote_simulation_core($1,'outsider-payment-key')",[request]),/permission denied/);
  });
  console.log(`${checks} targeted PostgreSQL execution checks passed; hosted migration status must be verified separately.`);
} finally {
  await db.close();
}
