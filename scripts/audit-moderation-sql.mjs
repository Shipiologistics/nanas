// BEFORE-FIX baseline reproduction using the original August migration only.
// Does not apply the October repair; use check-moderation-sql.mjs to test it.
// Diagnostic reproduction only, not a passing moderation acceptance suite.
// Run with PGLITE_MODULE_PATH pointing to the isolated PGlite runtime.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite();
const admin='41000000-0000-4000-8000-000000000001',reporter='41000000-0000-4000-8000-000000000002';
const message='41000000-0000-4000-8000-000000000003',review='41000000-0000-4000-8000-000000000004';
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
 create function app_private.has_admin_permission(text) returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
 grant usage on schema auth,app_private to authenticated;
 create type case_status as enum('open','escalated','resolved','closed');
 create table profiles(id uuid primary key,account_status text);insert into profiles values('${admin}','active'),('${reporter}','active');
 create table badges(id uuid primary key);
 create table moderation_reports(id uuid primary key default gen_random_uuid(),reporter_id uuid,target_type text,target_id uuid,reason_code text,details text,priority text,status case_status,assigned_admin_id uuid,updated_at timestamptz);
 create table admin_audit_logs(actor_id uuid,action text,target_type text,target_id uuid,before_redacted jsonb,after_redacted jsonb,reason text);
 create table domain_events(aggregate_type text,aggregate_id uuid,event_type text,payload_redacted jsonb);
 create table messages(id uuid primary key,moderation_status text);insert into messages values('${message}','allowed');
 create table reviews(id uuid primary key,status text);insert into reviews values('${review}','published');
 `);
 await db.exec(await readFile(new URL('../supabase/migrations/20260824094630_badge_and_moderation_completion.sql',import.meta.url),'utf8'));
 for(const [targetType,targetId,action,table,key,expected] of [
  ['message',message,'remove','messages','moderation_status','allowed'],
  ['review',review,'remove','reviews','status','published'],
  ['user',reporter,'restrict','profiles','account_status','active'],
 ]) {
  await db.exec('reset role');await db.query("select set_config('qa.uid',$1,false)",[reporter]);await db.exec('set role authenticated');
  const opened=(await db.query("select public.report_content($1,$2,'local_qa','Isolated diagnostic only') as result",[targetType,targetId])).rows[0].result;
  await db.exec('reset role');await db.query("select set_config('qa.uid',$1,false)",[admin]);await db.exec('set role authenticated');
  const result=(await db.query("select public.admin_resolve_moderation_report($1,$2,'local_qa') as result",[opened.report_id,action])).rows[0].result;
  assert.equal(result.ok,true);await db.exec('reset role');
  const state=(await db.query(`select ${key} as state from ${table} where id=$1`,[targetId])).rows[0].state;
  const reportState=(await db.query('select status from moderation_reports where id=$1',[opened.report_id])).rows[0].status;
  assert.equal(reportState,'resolved');assert.equal(state,expected);
  console.log(`CONFIRMED DEFECT: ${targetType} ${action} resolves its report but target remains ${state}.`);
 }
 console.log('Three pre-repair moderation defects reproduced in an isolated baseline schema; this is NOT the repaired schema or production acceptance.');
} catch(error) {console.error(error);process.exitCode=1;} finally {await db.close();}
