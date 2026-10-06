import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import {adminMessageArguments,confirmedAdminMessagePage} from '../supabase/functions/_shared/admin-message-page.mjs';

const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const shared=transpile(await readFile(new URL('../supabase/functions/_shared/http.ts',import.meta.url),'utf8')).replace(/export /g,'');
const source=transpile(await readFile(new URL('../supabase/functions/admin-command/index.ts',import.meta.url),'utf8'))
 .replace(/^import .*;\r?\n/gm,'').replace('export default','return');
const factory=vm.runInNewContext(`(function(withSupabase,adminMessageArguments,confirmedAdminMessagePage){${shared}\n${source}})`,{Request,Response,Date,Error,Number,Set});
const handler=factory((_options,fetch)=>fetch,adminMessageArguments,confirmedAdminMessagePage);
const dispute='40000000-0000-4000-8000-000000000001',admin='40000000-0000-4000-8000-000000000002';
function context({permission='disputes.manage',permissionError=null,permissionData=undefined,queryResult={data:[],error:null},result={data:{ok:true,status:'resolved',refund_minor:1234,replayed:false},error:null}}={}) {
 const calls=[],writes=[],reads=[],authority=[];
 return {calls,writes,reads,authority,ctx:{userClaims:{id:admin},supabase:{
  from(table){reads.push(table);return {select(){return this;},eq(){return this;},is(){return this;},in(){return this;},not(){return this;},order(){return this;},limit(){return this;},single(){return this;},then(resolve,reject){return Promise.resolve(queryResult).then(resolve,reject);}};},
  async rpc(name,args){if(name==='admin_permission_allowed'){authority.push(args.p_permission);return {data:permissionData===undefined?Boolean(permission&&(permission==='*'||permission===args.p_permission)):permissionData,error:permissionError};}calls.push({name,args});return result;},
 },supabaseAdmin:{from(table){return {
  select(){return this;},eq(){return this;},
  single(){return Promise.resolve({data:{id:dispute},error:null});},
  update(value){writes.push({table,operation:'update',value});return {eq:async()=>({data:null,error:null})};},
  insert(value){writes.push({table,operation:'insert',value});return Promise.resolve({data:null,error:null});},
 };}}}};
}
const payload=(overrides={})=>({dispute_id:dispute,resolution_code:'partial_refund',note:'LOCAL QA simulated resolution',refund_minor:1234,...overrides});
const request=(p=payload(),action='resolve_dispute')=>new Request('http://localhost/admin-command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,payload:p})});

test('legacy dispute endpoint delegates through caller-scoped atomic settlement without privileged writes',async()=>{
 const mock=context();const response=await handler.fetch(request(),mock.ctx);
 assert.equal(response.status,200);assert.equal(mock.calls.length,1);
 assert.equal(mock.calls[0].name,'admin_resolve_service_dispute');
 assert.deepEqual(JSON.parse(JSON.stringify(mock.calls[0].args)),{p_dispute_id:dispute,p_resolution_code:'partial_refund',p_note:'LOCAL QA simulated resolution',p_refund_minor:1234});
 assert.equal(mock.writes.length,0);assert.equal((await response.json()).refund_minor,1234);
});
test('all settlement outcomes preserve authoritative statuses and idempotent replay',async()=>{
 for(const outcome of ['release_funds','full_refund','partial_refund','no_action','warning','escalate']) {
  const data={ok:true,status:outcome==='escalate'?'escalated':'resolved',replayed:true,refund_minor:outcome==='partial_refund'?1234:0};
  const mock=context({result:{data,error:null}});const response=await handler.fetch(request(payload({resolution_code:outcome,refund_minor:outcome==='partial_refund'?1234:null})),mock.ctx);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),data);assert.equal(mock.writes.length,0);
 }
});
test('permission denial and permission lookup errors never reach settlement',async()=>{
 for(const options of [{permission:null},{permission:'users.read'},{permissionError:{message:'permission_lookup_failed'}},{permissionData:null},{permissionData:{permission_key:'*'}}]) {
  const mock=context(options);const response=await handler.fetch(request(),mock.ctx);
  assert.ok(response.status>=400);assert.equal(mock.calls.length,0);assert.equal(mock.writes.length,0);
 }
});
test('invalid refund amounts and outcomes fail before any financial command',async()=>{
 for(const overrides of [{refund_minor:null},{refund_minor:0},{refund_minor:-1},{refund_minor:1.2},{refund_minor:'1234'},{refund_minor:Number.MAX_SAFE_INTEGER+1},{resolution_code:'fake_success'},{note:'x'}]) {
  const mock=context();const response=await handler.fetch(request(payload(overrides)),mock.ctx);
  assert.equal(response.status,400,JSON.stringify(overrides));assert.equal(mock.calls.length,0);assert.equal(mock.writes.length,0);
 }
});
test('settlement errors or missing success response never report success',async()=>{
 for(const result of [{data:null,error:{message:'protected_funds_mismatch'}},{data:null,error:null},{data:{ok:false,error:'failed'},error:null},{data:{status:'resolved'},error:null}]) {
  const mock=context({result});const response=await handler.fetch(request(),mock.ctx);
  assert.equal(response.status,400);assert.equal(mock.calls.length,1);assert.equal(mock.writes.length,0);
 }
});
const moderationPayload=(overrides={})=>({report_id:dispute,target_type:'profile',target_id:admin,decision:'remove',reason:'QA legacy reason',reason_code:'qa_policy_reason',public_note:'QA public note',private_note:'QA private note',...overrides});
test('legacy moderation uses the stored report through a caller-scoped audited RPC',async()=>{
 const data={ok:true,report_id:dispute,action_id:admin,action:'remove'};
 const mock=context({permission:'moderation.manage',result:{data,error:null}});
 const response=await handler.fetch(request(moderationPayload(),'moderate_content'),mock.ctx);
 assert.equal(response.status,200);assert.equal(mock.writes.length,0);assert.equal(mock.calls.length,1);
 assert.equal(mock.calls[0].name,'admin_resolve_moderation_report');
 assert.deepEqual(JSON.parse(JSON.stringify(mock.calls[0].args)),{p_report_id:dispute,p_action:'remove',p_reason_code:'qa_policy_reason',p_public_note:'QA public note',p_private_note:'QA private note',p_expires_at:null});
 assert.deepEqual(await response.json(),data);
});
test('unknown moderation actions cannot default to provider approval or review publication',async()=>{
 for(const target_type of ['profile','review','message']) {
  const mock=context({permission:'moderation.manage'});const response=await handler.fetch(request(moderationPayload({target_type,decision:'unknown',reason:'valid old reason'}),'moderate_content'),mock.ctx);
  assert.equal(response.status,400);assert.equal(mock.writes.length,0);assert.equal(mock.calls.length,0);
 }
});
test('missing report or invalid moderation reason cannot mutate content before validation',async()=>{
 for(const changes of [{reason:'',reason_code:''},{report_id:null},{report_id:''},{reason_code:'x'},{reason_code:'x'.repeat(81)},{public_note:'x'.repeat(1001)},{private_note:'x'.repeat(2001)},{expires_at:'not-a-date'}]) {
  const mock=context({permission:'moderation.manage'});const response=await handler.fetch(request(moderationPayload(changes),'moderate_content'),mock.ctx);
  assert.equal(response.status,400);assert.equal(mock.writes.length,0);assert.equal(mock.calls.length,0);
 }
});
test('moderation permission and RPC failures cannot produce privileged writes or false success',async()=>{
 for(const options of [{permission:'moderation.read'},{permission:'moderation.manage',result:{data:null,error:{message:'report_already_closed'}}},{permission:'moderation.manage',result:{data:null,error:null}}]) {
  const mock=context(options);const response=await handler.fetch(request(moderationPayload(),'moderate_content'),mock.ctx);
  assert.ok(response.status>=400);assert.equal(mock.writes.length,0);
 }
});

const accessPayload={conversation_id:dispute,case_id:admin,purpose_code:'support-case',reason:'QA linked support evidence'};
const accessReceipt=()=>({ok:true,conversation_id:dispute,case_id:admin,purpose_code:'support-case',audit_id:admin,messages:[],has_more:false,next_cursor:null,access_expires_at:new Date(Date.now()+300_000).toISOString()});
test('Edge message access forwards case, reason and bounded cursor through the caller RPC',async()=>{
 const data=accessReceipt();const mock=context({permission:'messages.read',result:{data,error:null}});
 const response=await handler.fetch(request(accessPayload,'read_messages'),mock.ctx);
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,data});assert.equal(mock.writes.length,0);
 assert.deepEqual(JSON.parse(JSON.stringify(mock.calls)),[{name:'admin_conversation_message_page',args:adminMessageArguments(accessPayload)}]);
});
test('Edge message access denies missing case/reason and unconfirmed or wrong-case data',async()=>{
 for(const changes of [{case_id:undefined},{case_id:'random'},{reason:''},{purpose_code:'anything'},{limit:1000},{before_id:admin}]){
  const mock=context({permission:'messages.read'});const response=await handler.fetch(request({...accessPayload,...changes},'read_messages'),mock.ctx);
  assert.equal(response.status,400);assert.equal(mock.calls.length,0);assert.equal(mock.writes.length,0);
 }
 for(const data of [null,[],{...accessReceipt(),case_id:dispute},{...accessReceipt(),audit_id:null}]){
  const mock=context({permission:'messages.read',result:{data,error:null}});assert.equal((await handler.fetch(request(accessPayload,'read_messages'),mock.ctx)).status,400);
 }
});
test('database recent-auth or case denial is not bypassed by Edge claims or the service role',async()=>{
 for(const message of ['recent_authentication_required','case_conversation_unavailable','permission_denied']){
  const mock=context({permission:'messages.read',result:{data:null,error:{message}}});mock.ctx.userClaims.auth_time=Math.floor(Date.now()/1000)+10_000;
  const response=await handler.fetch(request(accessPayload,'read_messages'),mock.ctx);assert.equal(response.status,400);assert.equal(mock.calls.length,1);assert.equal(mock.writes.length,0);
 }
});

test('every admin action requires a true authoritative permission result before any data operation',async()=>{
 for(const action of ['overview','list_users','list_kyc','user_action','kyc_review','read_messages','list_disputes','resolve_dispute','list_moderation','moderate_content','finance_overview','notification_health','update_setting']){
  for(const value of [false,null,{},[],{permission_key:'*'},'true',1]){
   const mock=context({permissionData:value});const response=await handler.fetch(request({},action),mock.ctx);
   assert.equal(response.status,403);assert.equal(mock.authority.length,1);assert.equal(mock.calls.length,0);assert.equal(mock.reads.length,0);assert.equal(mock.writes.length,0);
  }
 }
});
test('admin list and finance queries use caller RLS rather than a privileged client',async()=>{
 for(const [action,tables] of [['overview',['admin_overview']],['list_users',['profiles']],['list_kyc',['verification_cases']],['list_disputes',['service_disputes']],['list_moderation',['moderation_reports']],['finance_overview',['payment_intents','payouts','refunds','wallet_balances']],['notification_health',['notification_outbox']]]){
  const mock=context({permission:'*'});const response=await handler.fetch(request({},action),mock.ctx);
  assert.equal(response.status,200,action);assert.deepEqual(mock.reads,tables);assert.equal(mock.writes.length,0);assert.equal(mock.authority.length,1);
 }
});
test('caller-RLS query failures never fall back to the privileged client',async()=>{
 const mock=context({permission:'*',queryResult:{data:null,error:{message:'permission_denied'}}});
 assert.equal((await handler.fetch(request({},'list_users'),mock.ctx)).status,400);assert.equal(mock.writes.length,0);
});
test('legacy setting update requires a reason and confirmed atomic RPC result',async()=>{
 const input={key:'qa_setting',value:{enabled:true},reason:'QA configuration change'};
 const mock=context({permission:'config.manage',result:{data:{ok:true,key:'qa_setting'},error:null}});
 assert.equal((await handler.fetch(request(input,'update_setting'),mock.ctx)).status,200);assert.equal(mock.writes.length,0);
 assert.deepEqual(JSON.parse(JSON.stringify(mock.calls)),[{name:'admin_set_system_setting',args:{p_key:input.key,p_value:input.value,p_reason:input.reason}}]);
 const missing=context({permission:'config.manage'});assert.equal((await handler.fetch(request({...input,reason:undefined},'update_setting'),missing.ctx)).status,400);assert.equal(missing.calls.length,0);
 for(const result of [{data:null,error:{message:'qa_audit_failure'}},{data:null,error:null},{data:{ok:true,key:'wrong_setting'},error:null}]){
  const bad=context({permission:'config.manage',result});assert.equal((await handler.fetch(request(input,'update_setting'),bad.ctx)).status,400);assert.equal(bad.writes.length,0);
 }
});
