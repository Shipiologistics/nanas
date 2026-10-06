import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {confirmedReportReceipt,reportContentError} from '../lib/moderation.mjs';
import {marketplaceAccountFeedback} from '../lib/marketplace-account-feedback.mjs';
const source=ts.transpileModule(await readFile(new URL('../lib/nanas-api.ts',import.meta.url),'utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const factory=vm.runInNewContext(`(function(getSupabase,marketplaceAccountFeedback,confirmedReportReceipt,reportContentError){${source}\nreturn marketplaceCommand;})`,{Error,crypto,Date});
const id='43000000-0000-4000-8000-000000000001';
const receipt={ok:true,report_id:id,status:'open',replayed:false};
const payload={target_type:'message',target_id:id,reason_code:'unsafe_content',details:'Keep my exact report details.'};
function commandFor(response) {
 const calls=[];
 const command=factory(()=>({rpc:async(name,args)=>{calls.push({name,args});return response;}}),marketplaceAccountFeedback,confirmedReportReceipt,reportContentError);
 return {command,calls};
}
test('report API sends only intake fields and requires an authoritative receipt',async()=>{
 const {command,calls}=commandFor({data:receipt,error:null});
 assert.equal(await command('report_content',{...payload,status:'resolved',priority:'urgent',assigned_admin_id:id,reporter_id:id}),receipt);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{name:'report_content',args:{p_target_type:'message',p_target_id:id,p_reason_code:'unsafe_content',p_details:payload.details}}]);
});
test('report API preserves confirmed open replay statuses and supports optional details',async()=>{
 for(const status of ['open','awaiting_user','awaiting_admin','escalated']){
  const data={...receipt,status,replayed:true};const {command,calls}=commandFor({data,error:null});
  assert.equal(await command('report_content',{...payload,details:undefined}),data);assert.equal(calls[0].args.p_details,null);
 }
});
test('missing or malformed report results never claim submission succeeded',async()=>{
 for(const data of [null,[],{},false,{...receipt,ok:false},{...receipt,report_id:'not-an-id'},{...receipt,report_id:null},{...receipt,status:'resolved'},{...receipt,status:'closed'},{...receipt,status:'unknown'}]){
  const {command}=commandFor({data,error:null});await assert.rejects(command('report_content',payload),/report could not be confirmed/);
 }
});
test('target denial feedback cannot reveal private content or existence',async()=>{
 const error={message:'report_target_unavailable',details:'PRIVATE BODY AND STATUS'};
 const {command}=commandFor({data:null,error});await assert.rejects(command('report_content',payload),e=>{
  assert.equal(e.message,reportContentError(error));assert.doesNotMatch(e.message,/PRIVATE|exists|deleted|suspended/);return true;
 });
});
test('known report validation errors explain recovery while unknown database errors stay private',async()=>{
 for(const message of ['authentication_required','reporting_account_unavailable','invalid_target_type','invalid_reason','details_too_long','__proto__','PRIVATE DATABASE DETAIL']){
  const error={message};const {command}=commandFor({data:null,error});await assert.rejects(command('report_content',payload),e=>e.message===reportContentError(error));
 }
 for(const error of [null,{},'PRIVATE DATABASE DETAIL'])assert.equal(reportContentError(error),'Your report could not be confirmed. Keep your details and try again.');
});
