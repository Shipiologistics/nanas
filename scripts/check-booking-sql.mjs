// Real lifecycle migration and pgcrypto on a focused PostgreSQL fixture schema.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const { pgcrypto } = await import(new URL("./contrib/pgcrypto.js", pathToFileURL(process.env.PGLITE_MODULE_PATH)).href);
const db = new PGlite({ extensions: { pgcrypto } });
const buyer = "00000000-0000-0000-0000-000000000001";
const seller = "00000000-0000-0000-0000-000000000002";
const outsider = "00000000-0000-0000-0000-000000000003";
const booking = "00000000-0000-0000-0000-000000000010";
let checks = 0;
const check = async (name, fn) => { await fn(); console.log(`PASS ${name}`); checks++; };
const identity = async id => { await db.exec("reset role"); await db.query("select set_config('qa.uid',$1,false)", [id]); await db.exec("set role authenticated"); };
const generate = async () => (await db.query("select public.generate_session_code($1) result", [booking])).rows[0].result;
const verify = async code => (await db.query("select public.verify_session_code($1,$2) result", [booking, code])).rows[0].result;
const transition = async (target, key = `qa-${target}-key`) => (await db.query("select public.transition_booking($1,$2,'QA',$3) result", [booking, target, key])).rows[0].result;
let code;
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema app_private; create schema extensions;
    grant usage on schema auth,app_private to authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('qa.uid',true),'')::uuid $$;
    create extension pgcrypto with schema extensions;
    create type booking_status as enum('requested','offered','confirmed','in_progress','completion_pending','completed','cancelled','disputed');
    create type case_priority as enum('normal','high');
    create table bookings(id uuid primary key,buyer_id uuid,seller_id uuid,status booking_status,scheduled_start timestamptz,scheduled_end timestamptz,version integer default 1,blocks_calendar boolean default true,started_at timestamptz,ended_at timestamptz,completed_at timestamptz,total_minor bigint,seller_net_minor bigint,currency char(3));
    insert into bookings(id,buyer_id,seller_id,status,scheduled_start,scheduled_end,total_minor,seller_net_minor,currency) values('${booking}','${buyer}','${seller}','confirmed',now(),now()+interval '1 hour',8100,7500,'BSD');
    create table booking_session_codes(id uuid primary key default gen_random_uuid(),booking_id uuid,code_digest text,attempt_count integer default 0,valid_from timestamptz,valid_until timestamptz,buyer_verified_at timestamptz,seller_verified_at timestamptz,consumed_at timestamptz,created_at timestamptz default now());
    grant select on booking_session_codes to authenticated;
    create table risk_signals(user_id uuid,booking_id uuid,signal_type text,source text,score numeric,evidence_redacted jsonb);
    create table booking_status_history(booking_id uuid,from_status booking_status,to_status booking_status,actor_id uuid,reason_code text,idempotency_key text,created_at timestamptz default now());
    create table booking_checkins(booking_id uuid,user_id uuid,event_type text,method text,code_verified boolean);
    create table seller_profiles(user_id uuid primary key,completed_bookings integer default 0);
    insert into seller_profiles(user_id) values('${seller}');
    create table ledger_accounts(id uuid primary key default gen_random_uuid(),account_type text,owner_user_id uuid,currency char(3),unique nulls not distinct(account_type,owner_user_id,currency));
    insert into ledger_accounts(account_type,currency) values('protected_funds','BSD');
    create table ledger_transactions(id uuid primary key,reference_type text,reference_id uuid,event_type text,currency char(3),description text,idempotency_key text unique);
    create table ledger_entries(transaction_id uuid,account_id uuid not null,direction text,amount_minor bigint,booking_id uuid,buyer_id uuid,seller_id uuid);
    create table domain_events(aggregate_type text,aggregate_id uuid,event_type text,payload_redacted jsonb);
    create table notification_outbox(recipient_id uuid,template_key text,category text,priority case_priority,variables_redacted jsonb,dedupe_key text unique);
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/20261005150000_enforce_verified_booking_lifecycle.sql", import.meta.url), "utf8"));
  await db.exec(`
    create function public.generate_session_code(uuid) returns jsonb language sql security invoker as $$ select app_private.generate_session_code($1) $$;
    create function public.verify_session_code(uuid,text) returns jsonb language sql security invoker as $$ select app_private.verify_session_code($1,$2) $$;
    create function public.transition_booking(uuid,booking_status,text,text) returns jsonb language sql security invoker as $$ select app_private.transition_booking($1,$2,$3,$4) $$;
    revoke all on all functions in schema public,app_private from public,anon;
    grant execute on all functions in schema public,app_private to authenticated;
  `);
  await identity(seller);
  await check("provider cannot download code hashes or generate buyer code", async () => {
    await assert.rejects(db.query("select code_digest from booking_session_codes"), /permission denied/);
    await assert.rejects(generate(), /only_buyer_can_generate/);
  });
  await check("direct check-in without verified code is rejected", async () => { await assert.rejects(transition("in_progress"), /verified_session_code_required/); });
  await check("generic status API cannot bypass cancellation/refund or dispute RPC", async () => {
    await assert.rejects(transition("cancelled"), /transition_not_allowed/);
    await assert.rejects(transition("disputed"), /transition_not_allowed/);
  });
  await identity(outsider);
  await check("outsider cannot generate, verify or transition", async () => {
    await assert.rejects(generate(), /only_buyer_can_generate/);
    await assert.rejects(verify("123456"), /only_seller_can_verify/);
    await assert.rejects(transition("in_progress"), /booking_access_denied/);
  });
  await identity(buyer);
  await check("buyer receives a six-digit code but cannot verify it", async () => {
    code = (await generate()).code; assert.match(code, /^[0-9]{6}$/);
    await assert.rejects(verify(code), /only_seller_can_verify/);
  });
  await identity(seller);
  await check("missing and malformed codes fail closed", async () => {
    await assert.rejects(verify(null), /invalid_session_code/);
    await assert.rejects(verify("123"), /invalid_session_code/);
  });
  await check("five failed attempts commit a lock and exactly one risk signal", async () => {
    const wrong = code === "000000" ? "000001" : "000000";
    for (let i = 1; i <= 5; i++) {
      const result = await verify(wrong);
      assert.equal(result.ok, false); assert.equal(result.attempts_remaining, 5-i);
      assert.equal(result.error, i === 5 ? "session_code_locked" : "session_code_incorrect");
    }
    assert.equal((await verify(code)).error, "session_code_locked");
    await db.exec("reset role");
    assert.equal((await db.query("select attempt_count from booking_session_codes where consumed_at is null")).rows[0].attempt_count, 5);
    assert.equal((await db.query("select * from risk_signals")).rows.length, 1);
    await identity(seller);
    await assert.rejects(transition("in_progress"), /verified_session_code_required/);
  });
  await identity(buyer);
  await check("buyer replacement invalidates the locked code", async () => {
    code = (await generate()).code;
    await db.exec("reset role");
    assert.equal((await db.query("select * from booking_session_codes where consumed_at is null")).rows.length, 1);
  });
  await identity(seller);
  await check("correct code verifies but cannot bypass the appointment window", async () => {
    assert.equal((await verify(code)).verified, true);
    await db.exec("reset role; update bookings set scheduled_start=now()+interval '3 days',scheduled_end=now()+interval '3 days 1 hour'");
    await identity(seller);
    await assert.rejects(transition("in_progress"), /outside_session_code_window/);
    await assert.rejects(verify(code), /outside_session_code_window/);
    await identity(buyer); await assert.rejects(generate(), /outside_session_code_window/);
    await db.exec("reset role; update bookings set scheduled_start=now(),scheduled_end=now()+interval '1 hour'; update booking_session_codes set valid_until=now()-interval '1 second' where consumed_at is null");
    await identity(seller);
  });
  await check("expired verified code cannot check in", async () => {
    await assert.rejects(transition("in_progress"), /verified_session_code_required/);
    await assert.rejects(verify(code), /session_code_expired/);
  });
  await identity(buyer); code = (await generate()).code; await identity(seller); await verify(code);
  await check("verified check-in consumes code and creates one attendance record", async () => {
    assert.equal((await transition("in_progress")).status, "in_progress");
    assert.equal((await transition("in_progress")).replayed, true);
    await db.exec("reset role");
    assert.equal((await db.query("select * from booking_session_codes where consumed_at is null")).rows.length, 0);
    assert.equal((await db.query("select * from booking_checkins where event_type='check_in' and code_verified")).rows.length, 1);
    await identity(seller);
  });
  await check("replay key cannot be reused for another target", async () => { await assert.rejects(transition("completed", "qa-in_progress-key"), /idempotency_key_conflict/); });
  await identity(outsider);
  await check("idempotent replay still authorizes the caller", async () => { await assert.rejects(transition("in_progress"), /booking_access_denied/); });
  await identity(buyer);
  await check("buyer cannot check out, generate another code, or complete before checkout", async () => {
    await assert.rejects(transition("completion_pending"), /transition_not_allowed/);
    await assert.rejects(transition("completed"), /transition_not_allowed/);
    await assert.rejects(generate(), /session_code_not_allowed/);
  });
  await identity(seller);
  await check("provider checks out but cannot self-confirm completion", async () => {
    assert.equal((await transition("completion_pending")).status, "completion_pending");
    await assert.rejects(transition("completed"), /transition_not_allowed/);
  });
  await identity(buyer);
  await check("buyer completion releases one balanced ledger transaction", async () => {
    assert.equal((await transition("completed")).status, "completed");
    assert.equal((await transition("completed")).replayed, true);
    await db.exec("reset role");
    assert.equal((await db.query("select * from ledger_transactions")).rows.length, 1);
    assert.equal(Number((await db.query("select sum(case when direction='debit' then amount_minor else -amount_minor end) balance from ledger_entries")).rows[0].balance), 0);
    assert.equal((await db.query("select completed_bookings from seller_profiles")).rows[0].completed_bookings, 1);
    assert.equal((await db.query("select * from booking_checkins")).rows.length, 2);
    assert.equal((await db.query("select * from notification_outbox")).rows.length, 6);
  });
  await identity(seller);
  await check("old check-in replay returns current state and cannot reopen completion", async () => {
    assert.equal((await transition("in_progress")).status, "completed");
    await assert.rejects(transition("in_progress", "qa-new-checkin-key"), /transition_not_allowed/);
  });
  await db.exec("reset role; set role anon");
  await check("anonymous calls are denied", async () => { await assert.rejects(generate(), /permission denied/); });
  console.log(`${checks} booking SQL execution checks passed.`);
} finally { await db.close(); }
