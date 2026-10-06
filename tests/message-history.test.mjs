import test from "node:test";
import assert from "node:assert/strict";
import { compareMessages, latestMessagePage, mergeMessages, messageTime, olderMessageFilter, revalidateCachedMessages } from "../lib/message-history.mjs";
const row=(n,at="2026-10-01T12:00:00.000001+00:00")=>({id:`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`,created_at:at,body:`QA ${n}`});
test("keyset pagination reaches all 505 tied-timestamp messages without gaps or duplicates",()=>{
  const source=Array.from({length:505},(_,i)=>row(i+1)).sort(compareMessages).reverse();
  let visible=[],cursor=null,pages=0;
  while(true){
    const page=source.filter(item=>!cursor||compareMessages(item,cursor)<0).slice(0,51);
    visible=mergeMessages(visible,page.slice(0,50));pages++;
    if(page.length<=50)break;
    cursor=visible[0];assert.match(olderMessageFilter(cursor),/id.lt/);
  }
  assert.equal(visible.length,505);assert.equal(pages,11);assert.equal(visible[0].body,"QA 1");assert.equal(visible.at(-1).body,"QA 505");
});
test("timestamp ordering retains PostgreSQL microseconds and respects timezone offsets",()=>{
  assert.ok(compareMessages(row(2,"2026-10-01T12:00:00.000001Z"),row(1,"2026-10-01T12:00:00.000002Z"))<0);
  assert.equal(messageTime("2026-10-01T08:00:00.1-04:00"),messageTime("2026-10-01T12:00:00.100000+00:00"));
});
test("cursor filters reject malformed IDs, timestamps and filter injection",()=>{
  assert.throws(()=>olderMessageFilter({...row(1),id:"x),body.neq.secret"}));
  assert.throws(()=>olderMessageFilter(row(1,"2026-10-01T12:00:00Z),id.gt.x")));
});
test("message merge deduplicates overlap, applies edits and preserves history",()=>{
  const merged=mergeMessages([row(1),row(2)],[{...row(2),body:"edited"},row(3)]);
  assert.deepEqual(merged.map(r=>r.body),["QA 1","edited","QA 3"]);
});
test("latest refresh preserves contiguous loaded history and detects a burst gap",()=>{
  const prior=[row(1),row(2)];
  const normal=latestMessagePage(prior,[row(3),row(2)],true,false);
  assert.equal(normal.gap,false);assert.equal(normal.rows.length,3);assert.equal(normal.hasMore,false);
  const burst=latestMessagePage(prior,[row(100),row(99)],true,false);
  assert.equal(burst.gap,true);assert.deepEqual(burst.rows.map(r=>r.body),["QA 99","QA 100"]);assert.equal(burst.hasMore,true);
});
test("empty or reduced RLS results remove stale cached message bodies",()=>{
  assert.deepEqual(latestMessagePage([row(1),row(2)],[],false,true).rows,[]);
  assert.deepEqual(latestMessagePage([row(1),row(2)],[row(2)],false,true).rows,[row(2)]);
});
test("a newly discovered older page restores pagination after backfilled history",()=>{
  const next=latestMessagePage([row(100),row(101)],[row(99),row(100),row(101)],true,false);
  assert.equal(next.hasMore,true);
  assert.deepEqual(next.rows.map(r=>r.body),["QA 99","QA 100","QA 101"]);
});
test('revalidation removes moderated older bodies while retaining contiguous loaded pages',async()=>{
 const conversationId='qa-conversation';
 const make=n=>({...row(n),conversation_id:conversationId,sender_id:'qa-sender'});
 const prior=Array.from({length:505},(_,i)=>make(i+1)),incoming=prior.slice(-50);
 const checked=await revalidateCachedMessages(prior,incoming,conversationId,async ids=>prior.filter(r=>ids.includes(r.id)&&r.id!==make(2).id));
 const next=latestMessagePage(checked,incoming,true,false);
 assert.equal(next.rows.length,504);assert.equal(next.gap,false);assert.equal(next.hasMore,false);assert.ok(!next.rows.some(r=>r.id===make(2).id));
});
test('history revalidation bounds RPC batches and applies edits',async()=>{
 const prior=Array.from({length:2001},(_,i)=>({...row(i+1),conversation_id:'c',sender_id:'s'})),batches=[];
 const checked=await revalidateCachedMessages(prior,[],'c',async ids=>{batches.push(ids.length);return prior.filter(r=>ids.includes(r.id)).map(r=>({...r,body:'updated'}));});
 assert.deepEqual(batches,[1000,1000,1]);assert.equal(checked.length,2001);assert.ok(checked.every(r=>r.body==='updated'));
});
test('history revalidation rejects foreign rows and partial batch failures',async()=>{
 const prior=[{...row(1),conversation_id:'c',sender_id:'s'}];
 for(const result of [null,[{...prior[0],conversation_id:'foreign'}],[{...prior[0],id:row(2).id}],[{...prior[0],body:null}]])
  await assert.rejects(revalidateCachedMessages(prior,[],'c',async()=>result),/invalid_history_response/);
 await assert.rejects(revalidateCachedMessages(prior,[],'c',async()=>{throw new Error('offline');}),/offline/);
});
