import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import {bahamasDate} from '../supabase/functions/_shared/business-date.mjs';
import {validateBadgePage} from '../supabase/functions/_shared/badge-page.mjs';

// Run the actual worker handler with a mocked SDK boundary. No network, token,
// payment, or scheduler is involved. SQL settlement has its own execution suite.
const source=await readFile(new URL('../supabase/functions/maintenance-worker/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  .replace(/^import .*;\r?\n/gm,'').replace('export default','return');
function createWorker(clock=Date) {
 const factory=vm.runInNewContext(`(function(withSupabase,assertNoError,json,safeError,bahamasDate,validateBadgePage){${compiled}})`,{Request,Response,Date:clock,Set,Error});
 return factory((_options,handler)=>handler,(r)=>{if(r.error)throw new Error(r.error.message);return r.data;},(data,status=200)=>Response.json(data,{status}),(error)=>Response.json({ok:false,error:error.message},{status:400}),bahamasDate,validateBadgePage);
}
const worker=createWorker();

function client(result) {
  const writes=[], calls=[];
  return {writes,calls,sdk:{
    rpc: async(name,args)=>{calls.push({name,args});return typeof result==='function'?result(name,args,calls.length):result;},
    from(table) {
      const builder={
        insert(value){writes.push({table,operation:'insert',value});return builder;},
        update(value){writes.push({table,operation:'update',value});return builder;},
        select(){return builder;},
        eq(){return Promise.resolve({data:null,error:null});},
        single(){return Promise.resolve({data:{id:'qa-run'},error:null});},
      };
      return builder;
    },
  }};
}
const request=()=>new Request('http://localhost/maintenance-worker',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'auto_complete'})});

test('maintenance auto-completion delegates to atomic RPC and records actual count',async()=>{
  const mock=client({data:{ok:true,completed:2,skipped:1,failures:[]},error:null});
  const response=await worker.fetch(request(),{authMode:'secret',supabaseAdmin:mock.sdk});
  assert.equal(response.status,200);assert.equal((await response.json()).counts.completed,2);
  assert.equal(mock.calls.length,1);assert.equal(mock.calls[0].name,'auto_complete_bookings');
  assert.equal(mock.calls[0].args.p_limit,100);
  assert.equal(mock.writes.find(w=>w.table==='worker_runs'&&w.operation==='update').value.status,'succeeded');
  assert.ok(!mock.writes.some(w=>w.table==='bookings'||w.table==='booking_status_history'));
});
test('partial completion failure is recorded as failed while retaining committed count',async()=>{
  const mock=client({data:{ok:false,completed:1,skipped:0,failures:[{booking_id:'qa',error:'protected_funds_unavailable'}]},error:null});
  const response=await worker.fetch(request(),{authMode:'secret',supabaseAdmin:mock.sdk});
  assert.equal(response.status,400);
  const run=mock.writes.find(w=>w.table==='worker_runs'&&w.operation==='update').value;
  assert.equal(run.status,'failed');assert.equal(run.processed_count,1);assert.match(run.error_summary,/auto_completion_failed/);
  assert.equal(mock.writes.find(w=>w.table==='scheduled_workers').value.health_status,'failed');
});
test('RPC errors and malformed replies cannot report a successful worker run',async()=>{
  for(const result of [{data:null,error:{message:'database_unavailable'}},{data:null,error:null},{data:{ok:true,failures:[]},error:null}]) {
    const mock=client(result);const response=await worker.fetch(request(),{authMode:'secret',supabaseAdmin:mock.sdk});
    assert.equal(response.status,400);assert.equal(mock.writes.find(w=>w.table==='worker_runs'&&w.operation==='update').value.status,'failed');
  }
});
test('public auth cannot invoke the worker or create a worker run',async()=>{
  const mock=client({data:null,error:null});const response=await worker.fetch(request(),{authMode:'publishable',supabaseAdmin:mock.sdk});
  assert.equal(response.status,403);assert.equal(mock.calls.length,0);assert.equal(mock.writes.length,0);
});

function expiryClient(failingTable=null) {
 const writes=[];
 return {writes,sdk:{from(table){
   const entry={table,filters:[]};
   const builder={
     insert(value){entry.value=value;entry.operation='insert';writes.push(entry);return builder;},
     update(value){entry.value=value;entry.operation='update';writes.push(entry);return builder;},
     eq(column,value){entry.filters.push(['eq',column,value]);return builder;},
     in(column,value){entry.filters.push(['in',column,value]);return builder;},
     lt(column,value){entry.filters.push(['lt',column,value]);return builder;},
     select(){return builder;},
     single(){return Promise.resolve({data:{id:'expiry-run'},error:null});},
     then(resolve,reject){return Promise.resolve({data:table==='seller_documents'?[{id:'doc'}]:table==='seller_credentials'?[{id:'credential'}]:null,error:table===failingTable?{message:'expiry_write_failed'}:null}).then(resolve,reject);},
   };return builder;
 }}};
}
const expiryRequest=()=>new Request('http://localhost/maintenance-worker',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'expire_credentials'})});
test('actual expiry worker uses Bahamas midnight in both daylight and standard time',async()=>{
 for(const [instant,expected] of [
   ['2026-10-06T03:59:59Z','2026-10-05'],['2026-10-06T04:00:00Z','2026-10-06'],
   ['2026-01-06T04:59:59Z','2026-01-05'],['2026-01-06T05:00:00Z','2026-01-06'],
 ]) {
   class FixedDate extends Date {constructor(...args){super(...(args.length?args:[instant]));}}
   const mock=expiryClient();const response=await createWorker(FixedDate).fetch(expiryRequest(),{authMode:'secret',supabaseAdmin:mock.sdk});
   assert.equal(response.status,200);assert.equal((await response.json()).counts.credentials_expired,2);
   for(const table of ['seller_documents','seller_credentials']) {
     const write=mock.writes.find(item=>item.table===table);
     assert.deepEqual(write.filters.find(item=>item[0]==='lt'),['lt','expiry_date',expected]);
     assert.deepEqual(write.filters.find(item=>item[0]==='eq'),['eq','status','approved']);
     assert.ok(!write.filters.some(item=>item[0]==='in'));
   }
 }
});
test('expiry write failures never report a healthy maintenance run',async()=>{
 for(const table of ['seller_documents','seller_credentials']) {
   const mock=expiryClient(table);const response=await worker.fetch(expiryRequest(),{authMode:'secret',supabaseAdmin:mock.sdk});
   assert.equal(response.status,400);
   assert.equal(mock.writes.find(item=>item.table==='worker_runs'&&item.operation==='update').value.status,'failed');
   assert.equal(mock.writes.find(item=>item.table==='worker_runs'&&item.operation==='update').value.processed_count,1);
   assert.equal(mock.writes.find(item=>item.table==='scheduled_workers').value.health_status,'failed');
 }
});
test('business-date helper rejects invalid clocks',()=>assert.throws(()=>bahamasDate(new Date('invalid')),/invalid_business_date/));

const badgeRequest=()=>new Request('http://localhost/maintenance-worker',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'evaluate_badges'})});
const badgeCursor='00000000-0000-4000-8000-000000000001';
test('badge worker follows every atomic page and counts real awards and revocations',async()=>{
 const mock=client((_name,_args,n)=>({data:{ok:true,providers:1,evaluated:4,awarded:n===1?2:0,revoked:n===1?0:1,next_cursor:n===1?badgeCursor:null},error:null}));
 const response=await worker.fetch(badgeRequest(),{authMode:'secret',supabaseAdmin:mock.sdk});
 assert.equal(response.status,200);assert.deepEqual((await response.json()).counts,{badges_evaluated:8,badges_awarded:2,badges_revoked:1});
 assert.equal(mock.calls.length,2);assert.equal(mock.calls[0].name,'evaluate_provider_badges');assert.equal(mock.calls[0].args.p_limit,100);assert.equal(mock.calls[1].args.p_after,badgeCursor);
 assert.ok(!mock.writes.some(w=>['user_badges','badge_evaluation_runs'].includes(w.table)));
});
test('badge worker preserves completed pages but fails health on a later RPC failure',async()=>{
 const mock=client((_name,_args,n)=>n===1?{data:{ok:true,providers:1,evaluated:4,awarded:1,revoked:0,next_cursor:badgeCursor},error:null}:{data:null,error:{message:'page_failed'}});
 const response=await worker.fetch(badgeRequest(),{authMode:'secret',supabaseAdmin:mock.sdk});
 assert.equal(response.status,400);const run=mock.writes.find(w=>w.table==='worker_runs'&&w.operation==='update').value;
 assert.equal(run.status,'failed');assert.equal(run.processed_count,5);
});
test('badge worker rejects repeated cursors and malformed counters instead of looping or succeeding',async()=>{
 const valid={ok:true,providers:1,evaluated:4,awarded:1,revoked:0,next_cursor:null};
 for(const data of [{...valid,awarded:-1},{...valid,next_cursor:'bad-id'},{...valid,providers:0,next_cursor:badgeCursor},{...valid,ok:false},{...valid,next_cursor:undefined}])
   assert.throws(()=>validateBadgePage(data,null),/invalid_badge/);
 assert.throws(()=>validateBadgePage({...valid,next_cursor:badgeCursor},badgeCursor),/invalid_badge/);
});
