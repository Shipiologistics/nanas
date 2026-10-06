// Runs the real review migration on a focused PostgreSQL fixture schema.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const buyer="00000000-0000-0000-0000-000000000001", seller="00000000-0000-0000-0000-000000000002", outsider="00000000-0000-0000-0000-000000000003";
const booking="00000000-0000-0000-0000-000000000010", oldBooking="00000000-0000-0000-0000-000000000011", future="00000000-0000-0000-0000-000000000012";
let checks=0;
const check=async(name,fn)=>{await fn();console.log(`PASS ${name}`);checks++;};
const identity=async(id)=>{await db.exec("reset role");await db.query("select set_config('qa.uid',$1,false)",[id]);await db.exec("set role authenticated");};
const submit=async(id=booking,rating=4,body="QA review")=>(await db.query("select public.submit_verified_review($1,$2::smallint,$3) result",[id,rating,body])).rows[0].result;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema app_private;
    grant usage on schema auth,app_private to authenticated,anon;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('qa.uid',true),'')::uuid $$;
    create function app_private.has_admin_permission(text) returns boolean language sql stable as $$ select false $$;
    create type app_role as enum('buyer','seller');
    create type review_status as enum('pending_peer','published','hidden','removed');
    create table bookings(id uuid primary key,buyer_id uuid,seller_id uuid,status text,completed_at timestamptz);
    insert into bookings values('${booking}','${buyer}','${seller}','completed',now()),('${oldBooking}','${buyer}','${seller}','completed',now()-interval '8 days'),('${future}','${buyer}','${seller}','confirmed',null);
    create table seller_profiles(user_id uuid primary key,rating_average numeric default 0,rating_count integer default 0);
    insert into seller_profiles(user_id) values('${seller}');
    create table reviews(id uuid primary key default gen_random_uuid(),booking_id uuid,author_id uuid,subject_id uuid,subject_role app_role,overall_rating smallint,body text,status review_status,published_at timestamptz,submitted_at timestamptz default now(),unique(booking_id,author_id,subject_id));
    alter table reviews enable row level security;
    grant select on reviews to anon,authenticated;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261005160000_double_blind_reviews.sql',import.meta.url),'utf8'));
  await db.exec(`
    create function public.submit_verified_review(uuid,smallint,text) returns jsonb language sql security invoker as $$ select app_private.submit_verified_review($1,$2,$3) $$;
    revoke all on function public.submit_verified_review(uuid,smallint,text),app_private.submit_verified_review(uuid,smallint,text) from public,anon;
    grant execute on function public.submit_verified_review(uuid,smallint,text),app_private.submit_verified_review(uuid,smallint,text) to authenticated;
  `);
  await identity(outsider);
  await check('outsider cannot review someone else’s booking',async()=>{await assert.rejects(submit(),/review_not_eligible/);});
  await identity(buyer);
  await check('uncompleted bookings and invalid ratings are rejected',async()=>{
    await assert.rejects(submit(future),/review_not_eligible/);
    await assert.rejects(submit(booking,null),/invalid_review/);
    await assert.rejects(submit(booking,6),/invalid_review/);
    await assert.rejects(submit(booking,4,'x'.repeat(2001)),/invalid_review/);
  });
  let first;
  await check('first author sees own review but it remains pending',async()=>{
    first=await submit();assert.equal(first.published,false);
    assert.equal((await db.query('select body,status from reviews')).rows[0].status,'pending_peer');
  });
  await check('identical retry returns the existing review and changed retry is rejected',async()=>{
    const retry=await submit();assert.equal(retry.review_id,first.review_id);assert.equal(retry.replayed,true);
    await assert.rejects(submit(booking,1,'changed'),/review_already_submitted/);
  });
  await identity(seller);
  await check('subject cannot read the pending review before replying',async()=>{assert.equal((await db.query('select * from reviews')).rows.length,0);});
  await identity(outsider);
  await check('outsider cannot read pending reviews or force publication',async()=>{
    assert.equal((await db.query('select * from reviews')).rows.length,0);
    await assert.rejects(db.query('select public.publish_due_reviews(100)'),/permission denied/);
    await assert.rejects(db.query("update reviews set status='published'"),/permission denied/);
  });
  await identity(seller);
  await check('second party review atomically publishes both',async()=>{
    assert.equal((await submit(booking,5,'QA provider')).published,true);
    const rows=(await db.query('select status from reviews')).rows;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==='published'));
  });
  await db.exec('reset role');
  await check('published provider rating includes only reviews about that provider',async()=>{
    const row=(await db.query('select rating_average,rating_count from seller_profiles')).rows[0];assert.equal(Number(row.rating_average),4);assert.equal(row.rating_count,1);
  });
  await check('moderating the only rating resets aggregates to zero',async()=>{
    await db.query("update reviews set status='hidden' where id=$1",[first.review_id]);
    assert.equal((await db.query('select rating_count from seller_profiles')).rows[0].rating_count,0);
    assert.equal(Number((await db.query('select rating_average from seller_profiles')).rows[0].rating_average),0);
    await identity(seller);assert.equal((await db.query('select * from reviews where id=$1',[first.review_id])).rows.length,0);
  });
  await identity(buyer);
  await check('author can still see their moderated record',async()=>{assert.equal((await db.query('select status from reviews where id=$1',[first.review_id])).rows[0].status,'hidden');});
  await db.exec('reset role');
  await check('restoring published review recalculates aggregate',async()=>{
    await db.query("update reviews set status='published' where id=$1",[first.review_id]);assert.equal((await db.query('select rating_count from seller_profiles')).rows[0].rating_count,1);
  });
  await identity(buyer);
  await check('submission after seven days publishes without a peer',async()=>{assert.equal((await submit(oldBooking,2,'QA old visit')).published,true);});
  await db.exec(`reset role; update reviews set status='pending_peer',published_at=null where booking_id='${oldBooking}'; set role service_role;`);
  await check('service-only sweep uses completion age even for newly submitted review',async()=>{
    assert.equal((await db.query('select public.publish_due_reviews(100) count')).rows[0].count,1);
    assert.equal((await db.query('select public.publish_due_reviews(100) count')).rows[0].count,0);
    await assert.rejects(db.query('select public.publish_due_reviews(0)'),/invalid_limit/);
  });
  await db.exec('reset role');
  await check('sweep updates aggregate and deletion cannot leave stale rating',async()=>{
    let row=(await db.query('select rating_average,rating_count from seller_profiles')).rows[0];assert.equal(Number(row.rating_average),3);assert.equal(row.rating_count,2);
    await db.query('delete from reviews where booking_id=$1',[oldBooking]);
    row=(await db.query('select rating_average,rating_count from seller_profiles')).rows[0];assert.equal(Number(row.rating_average),4);assert.equal(row.rating_count,1);
  });
  await db.exec("select set_config('qa.uid','',false); set role anon");
  await check('anonymous reads only published rows and cannot submit',async()=>{
    assert.equal((await db.query('select * from reviews')).rows.length,2);
    await assert.rejects(submit(),/permission denied/);
  });
  await db.exec(`reset role; update bookings set status='resolved' where id='${oldBooking}'`);
  await identity(buyer);
  await check('reproduces completed resolved visit being incorrectly rejected',async()=>{
    await assert.rejects(submit(oldBooking,4,'Resolved visit'),/review_not_eligible/);
  });
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../supabase/migrations/20261005210000_review_completed_resolved_visits.sql',import.meta.url),'utf8'));
  await db.query('update bookings set completed_at=now() where id=$1',[oldBooking]);
  await identity(buyer);
  await check('completed resolved visit accepts a private first review',async()=>{
    assert.equal((await submit(oldBooking,4,'Resolved visit')).published,false);
    assert.equal((await submit(oldBooking,4,'Resolved visit')).replayed,true);
  });
  await identity(seller);
  await check('resolved review retains double-blind protection and peer publication',async()=>{
    assert.equal((await db.query('select * from reviews where booking_id=$1',[oldBooking])).rows.length,0);
    assert.equal((await submit(oldBooking,5,'Resolved provider review')).published,true);
    assert.equal((await db.query('select * from reviews where booking_id=$1',[oldBooking])).rows.length,2);
  });
  await identity(outsider);
  await check('resolved completion does not allow an unrelated reviewer',async()=>{
    await assert.rejects(submit(oldBooking),/review_not_eligible/);
  });
  await check('refund-only resolution and invalid completion states remain ineligible',async()=>{
    for (const [status,completed] of [['resolved',false],['completed',false],['disputed',true],['cancelled',true],['confirmed',true]]) {
      await db.exec('reset role');
      await db.query('update bookings set status=$2,completed_at=case when $3 then now() end where id=$1',[future,status,completed]);
      await identity(buyer);
      await assert.rejects(submit(future),/review_not_eligible/);
    }
  });
  console.log(`${checks} review SQL execution checks passed.`);
} finally {await db.close();}
