import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {adminMessageArguments,confirmedAdminMessagePage,adminMessageError} from '../supabase/functions/_shared/admin-message-page.mjs';
const id=n=>`44000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const payload={conversation_id:id(1),case_id:id(2),purpose_code:'dispute-review',reason:'QA exact evidence reason'};
const args=adminMessageArguments(payload);
const row={id:id(3),conversation_id:id(1),sender_id:id(4),body:'PRIVATE QA MESSAGE',message_type:'text',moderation_status:'removed',created_at:'2026-01-01T01:02:03.123456+00:00'};
const receipt=()=>({ok:true,conversation_id:id(1),case_id:id(2),purpose_code:'dispute-review',audit_id:id(5),messages:[row],has_more:false,next_cursor:null,access_expires_at:new Date(Date.now()+300_000).toISOString()});
const raw=await readFile(new URL('../lib/nanas-api.ts',import.meta.url),'utf8');
const source=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const factory=vm.runInNewContext(`(function(getSupabase,adminMessageArguments,confirmedAdminMessagePage,adminMessageError){${source}\nreturn adminCommand;})`,{Error,crypto,Date});
const command=response=>factory(()=>({rpc:async(name,rpcArgs)=>{assert.equal(name,'admin_conversation_message_page');assert.deepEqual(rpcArgs,args);return response;}}),adminMessageArguments,confirmedAdminMessagePage,adminMessageError);
test('browser admin command retains the full case and audited response instead of discarding bodies',async()=>{
 const data=receipt();assert.equal(await command({data,error:null})('read_messages',payload),data);
});
test('admin message arguments preserve exact cursor microseconds and reject invalid scope',()=>{
 const a=adminMessageArguments({...payload,before_id:row.id,before_created_at:row.created_at,limit:100});assert.equal(a.p_before_created_at,row.created_at);assert.equal(a.p_before_id,row.id);
 for(const changes of [{case_id:null},{conversation_id:'bad'},{purpose_code:'unknown'},{reason:'x'},{reason:'x'.repeat(1001)},{before_id:row.id},{before_created_at:row.created_at},{before_id:row.id,before_created_at:'invalid'},{limit:101},{limit:-1},{limit:1.2}])assert.throws(()=>adminMessageArguments({...payload,...changes}));
});
test('unconfirmed evidence, foreign rows, missing audits and expired access are withheld',async()=>{
 for(const data of [null,[],{...receipt(),ok:false},{...receipt(),case_id:id(99)},{...receipt(),conversation_id:id(99)},{...receipt(),purpose_code:'safety-incident'},{...receipt(),audit_id:null},{...receipt(),messages:[{...row,conversation_id:id(99)}]},{...receipt(),messages:[row,row]},{...receipt(),messages:[{...row,body:null}]},{...receipt(),messages:[{...row,created_at:'bad'}]},{...receipt(),access_expires_at:'2000-01-01'}]){
  assert.throws(()=>confirmedAdminMessagePage(data,args),/message_access_unconfirmed/);
  await assert.rejects(command({data,error:null})('read_messages',payload),/Message access could not be confirmed/);
 }
});
test('page receipts require a cursor for exactly the final row and enforce bounded length',()=>{
 const bounded={...args,p_limit:1};const data={...receipt(),has_more:true,next_cursor:{id:row.id,created_at:row.created_at}};
 assert.equal(confirmedAdminMessagePage(data,bounded),data);
 for(const changes of [{next_cursor:null},{next_cursor:{id:id(99),created_at:row.created_at}},{next_cursor:{id:row.id,created_at:'2026-01-01'}},{messages:[]},{messages:[row,{...row,id:id(10)}]},{has_more:false}])assert.throws(()=>confirmedAdminMessagePage({...data,...changes},bounded),/message_access_unconfirmed/);
});
test('admin message errors explain recovery without leaking database evidence',async()=>{
 for(const message of ['recent_authentication_required','permission_denied','case_context_required','case_conversation_unavailable','invalid_access_purpose','access_reason_required','invalid_message_cursor','invalid_page_size','PRIVATE DATABASE DETAIL','__proto__']){
  const error={message,details:row.body};await assert.rejects(command({data:null,error})('read_messages',payload),e=>e.message===adminMessageError(error)&&!e.message.includes(row.body));
 }
});
test('initial server-rendered evidence form contains scope controls and no private message content',async()=>{
 const input=await readFile(new URL('../app/app/AdminMessageAudit.tsx',import.meta.url),'utf8');
 const output=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const testModule={exports:{}};
 const require=name=>name==='react'?React:name==='react/jsx-runtime'?jsx:name.endsWith('.css')?{}:name.includes('nanas-api')?{adminCommand:()=>assert.fail('No request before form submission')}:{getSupabase:()=>null};
 vm.runInNewContext(`(function(require,module,exports){${output}})`,{Date,Error,FormData,setTimeout,clearTimeout})(require,testModule,testModule.exports);
 const html=renderToStaticMarkup(React.createElement(testModule.exports.AdminMessageAudit,{conversationId:id(1),adminUserId:id(4)}));
 assert.match(html,/Authorized case UUID/);assert.match(html,/Access reason/);assert.match(html,/Record purpose and open latest messages/);assert.match(html,/type="submit"/);assert.doesNotMatch(html,/PRIVATE QA MESSAGE|Authorized message evidence/);
});
test('evidence component source contract excludes persistent storage and guards stale responses',async()=>{
 const input=await readFile(new URL('../app/app/AdminMessageAudit.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(input,/localStorage|sessionStorage|\.from\("messages"\)/);
 assert.match(input,/if\(attempt.current!==token\)return/);assert.match(input,/visibilitychange/);assert.match(input,/SIGNED_OUT/);assert.match(input,/access_expires_at/);
 const portal=await readFile(new URL('../app/app/NanasPortal.tsx',import.meta.url),'utf8');
 assert.match(portal,/demoMode && selected && !modal && renderConversation/);assert.match(portal,/modal === "message-audit" && backendConnected && selected/);
});
