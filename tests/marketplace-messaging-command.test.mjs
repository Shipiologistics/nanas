import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';

const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const shared=transpile(await readFile(new URL('../supabase/functions/_shared/http.ts',import.meta.url),'utf8')).replace(/export /g,'');
const source=transpile(await readFile(new URL('../supabase/functions/marketplace-command/index.ts',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace('export default','return');
const handler=vm.runInNewContext(`(function(withSupabase){${shared}\n${source}})`,{Request,Response,Date,Error,Number})( (_options,fetch)=>fetch );
const user='41000000-0000-4000-8000-000000000001',conversation='41000000-0000-4000-8000-000000000002',message='41000000-0000-4000-8000-000000000003';
const created='2026-01-01T00:00:00.123456Z';
const draft={conversation_id:conversation,body:'LOCAL QA text',sender_nonce:'local-qa-nonce',message_type:'text'};
const request=(action,payload)=>new Request('http://localhost/marketplace-command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,payload})});
function context({insert={data:{id:message,created_at:created},error:null},existing={data:null,error:null},rpc={data:{ok:true,read_through:created},error:null}}={}) {
  const writes=[],calls=[],queries=[];
  return {writes,calls,queries,ctx:{userClaims:{id:user},supabase:{
    rpc:async(name,args)=>{calls.push({name,args});return rpc;},
    from(table){const query={table,filters:[]};queries.push(query);return {
      insert(value){writes.push({privileged:false,table,value});return this;},select(){return this;},
      eq(key,value){query.filters.push([key,value]);return this;},is(key,value){query.filters.push([key,value]);return this;},
      single:async()=>table==='messages'?insert:{data:{user_id:user},error:null},maybeSingle:async()=>existing,
    };},
  },supabaseAdmin:{from(table){return {
    update(value){writes.push({privileged:true,table,value});return this;},eq(){return this;},neq(){return this;},select(){return this;},
    is:async()=>({data:[{user_id:'muted-recipient'}],error:null}),
    upsert:async value=>{writes.push({privileged:true,table,value});return {data:null,error:null};},
    then(resolve){return Promise.resolve({data:null,error:null}).then(resolve);},
  };}}}};
}

test('legacy read command delegates the exact loaded message to caller-scoped watermark RPC',async()=>{
  const c=context();const response=await handler.fetch(request('mark_conversation_read',{conversation_id:conversation,message_id:message}),c.ctx);
  assert.equal(response.status,200);assert.equal(c.writes.length,0);
  assert.deepEqual(JSON.parse(JSON.stringify(c.calls)),[{name:'mark_conversation_read_through',args:{p_conversation_id:conversation,p_message_id:message}}]);
  assert.deepEqual(await response.json(),{ok:true,read_through:created});
});
test('read command rejects missing message IDs before any write',async()=>{
  for(const message_id of [undefined,null,'',42,'x'.repeat(37)]) {
    const c=context();const response=await handler.fetch(request('mark_conversation_read',{conversation_id:conversation,message_id}),c.ctx);
    assert.equal(response.status,400);assert.equal(c.writes.length,0);assert.equal(c.calls.length,0);
  }
});
test('read command never reports success on denied or unconfirmed receipt',async()=>{
  for(const rpc of [{data:null,error:{message:'conversation_locked'}},{data:null,error:null},{data:{ok:false},error:null},{data:{ok:true},error:null}]) {
    const c=context({rpc});const response=await handler.fetch(request('mark_conversation_read',{conversation_id:conversation,message_id:message}),c.ctx);
    assert.equal(response.status,400);assert.equal(c.writes.length,0);
  }
});
test('send command relies on transactional notification trigger without privileged duplicate writes',async()=>{
  const c=context();const response=await handler.fetch(request('send_message',draft),c.ctx);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,message:{id:message,created_at:created}});
  assert.equal(c.writes.length,1);assert.equal(c.writes[0].table,'messages');assert.equal(c.writes[0].privileged,false);
});
test('committed send after lost response replays only an identical caller-owned visible draft',async()=>{
  const c=context({insert:{data:null,error:{message:'duplicate key'}},existing:{data:{id:message,created_at:created,conversation_id:conversation,body:draft.body,message_type:'text'},error:null}});
  const response=await handler.fetch(request('send_message',draft),c.ctx);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,message:{id:message,created_at:created},replayed:true});
  assert.equal(c.writes.filter(w=>w.privileged).length,0);
  assert.deepEqual(c.queries.at(-1).filters,[['sender_id',user],['sender_nonce',draft.sender_nonce]]);
});
test('nonce conflicts, lookup failures and invisible messages cannot become successful replays',async()=>{
  for(const existing of [{data:null,error:null},{data:null,error:{message:'lookup_failed'}},
    {data:{conversation_id:'another-conversation',body:draft.body,message_type:'text'},error:null},
    {data:{conversation_id:conversation,body:'changed body',message_type:'text'},error:null},
    {data:{conversation_id:conversation,body:draft.body,message_type:'image'},error:null}]) {
    const c=context({insert:{data:null,error:{message:'insert_failed'}},existing});
    const response=await handler.fetch(request('send_message',draft),c.ctx);
    assert.equal(response.status,400);assert.equal((await response.json()).error,'insert_failed');
    assert.equal(c.writes.filter(w=>w.privileged).length,0);
  }
});
test('unsupported attachments and invalid drafts are rejected before insertion',async()=>{
  for(const changes of [{message_type:'image'},{message_type:'file'},{message_type:'unknown'},{body:' '},{body:'x'.repeat(4001)},{sender_nonce:''}]) {
    const c=context();const response=await handler.fetch(request('send_message',{...draft,...changes}),c.ctx);
    assert.equal(response.status,400);assert.equal(c.writes.length,0);
  }
});
test('send preserves exact body and nonce whitespace across entry points',async()=>{
  const c=context();await handler.fetch(request('send_message',{...draft,body:'  exact draft\n',sender_nonce:'  exact-nonce  '}),c.ctx);
  assert.equal(c.writes[0].value.body,'  exact draft\n');
  assert.equal(c.writes[0].value.sender_nonce,'  exact-nonce  ');
});
