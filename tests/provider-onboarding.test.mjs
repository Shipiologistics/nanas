import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import {providerOnboardingArguments,confirmedProviderOnboarding} from '../supabase/functions/_shared/provider-onboarding.mjs';
import {marketplaceAccountFeedback} from '../lib/marketplace-account-feedback.mjs';
const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const strip=source=>source.replace(/^import .*;\r?\n/gm,'');
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const shared=transpile(await read('../supabase/functions/_shared/http.ts')).replace(/export /g,'');
const edgeSource=strip(transpile(await read('../supabase/functions/marketplace-command/index.ts'))).replace('export default','return');
const edge=vm.runInNewContext(`(function(withSupabase,providerOnboardingArguments,confirmedProviderOnboarding){${shared}\n${edgeSource}})`,{Request,Response,Error,Date,Number})((_options,fetch)=>fetch,providerOnboardingArguments,confirmedProviderOnboarding);
const browserSource=strip(transpile(await read('../lib/nanas-api.ts'))).replace(/export /g,'');
const browserFactory=vm.runInNewContext(`(function(getSupabase,providerOnboardingArguments,confirmedProviderOnboarding,marketplaceAccountFeedback){${browserSource}\nreturn marketplaceCommand;})`,{Error,Date,crypto});
const user='46000000-0000-4000-8000-000000000001',caseId='46000000-0000-4000-8000-000000000002';
const payload={display_name:' QA Provider ',headline:' Fictional provider ',bio:' Fictional test biography. ',years_experience:4};
const receipt={ok:true,seller_id:user,status:'under_review',verification_case_id:caseId};
function harness(response={data:receipt,error:null},authenticated=true){
 const calls=[];const client={auth:{getUser:async()=>({data:{user:authenticated?{id:user}:null},error:null})},rpc:async(name,args)=>{calls.push({name,args});return response;},from(){throw new Error('direct_table_write_not_allowed');}};
 const browser=browserFactory(()=>client,providerOnboardingArguments,confirmedProviderOnboarding,marketplaceAccountFeedback);
 const invokeEdge=async(action,values)=>{
  const request=new Request('http://localhost/marketplace-command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,payload:values})});
  const result=await edge.fetch(request,{userClaims:{id:user},supabase:client});return {status:result.status,body:await result.json()};
 };
 return {calls,browser,invokeEdge};
}
test('browser and Edge application actions each use one identical caller-scoped atomic RPC',async()=>{
 for(const surface of ['browser','edge']){
  const h=harness();const result=surface==='browser'?await h.browser('submit_seller_application',payload):(await h.invokeEdge('submit_seller_application',payload)).body;
  assert.deepEqual(result,receipt);assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[{name:'submit_seller_application',args:{p_display_name:'QA Provider',p_headline:'Fictional provider',p_bio:'Fictional test biography.',p_years_experience:4}}]);
 }
});
test('activation preserves every authoritative provider status without pretending it is draft',async()=>{
 for(const status of ['draft','submitted','needs_information','under_review','approved','rejected','paused','suspended']){
  const r={ok:true,seller_id:user,status};const h=harness({data:r,error:null});
  assert.deepEqual(await h.browser('activate_seller',payload),r);assert.deepEqual((await h.invokeEdge('activate_seller',payload)).body,r);
  assert.ok(h.calls.every(c=>c.name==='activate_seller_profile'&&Object.keys(c.args).join(',')==='p_display_name'));
 }
});
test('invalid application values never activate or write before validation',async()=>{
 for(const changes of [{display_name:''},{display_name:'x'},{display_name:'x'.repeat(81)},{headline:''},{headline:'x'.repeat(121)},{bio:null},{bio:'x'.repeat(2001)},{years_experience:null},{years_experience:'4'},{years_experience:1.5},{years_experience:-1},{years_experience:81},{years_experience:true}]){
  const h=harness();await assert.rejects(h.browser('submit_seller_application',{...payload,...changes}),/invalid_/);
  assert.equal((await h.invokeEdge('submit_seller_application',{...payload,...changes})).status,400);assert.equal(h.calls.length,0);
 }
});
test('application years default to zero and client-supplied authority fields are ignored',async()=>{
 const h=harness();await h.browser('submit_seller_application',{...payload,years_experience:undefined,seller_id:caseId,status:'approved',verification_case_id:user});
 assert.equal(h.calls[0].args.p_years_experience,0);assert.deepEqual(Object.keys(h.calls[0].args).sort(),['p_bio','p_display_name','p_headline','p_years_experience']);
});
test('missing, wrong-account and malformed responses never confirm application submission',async()=>{
 for(const data of [null,{},[],false,{...receipt,ok:false},{...receipt,seller_id:caseId},{...receipt,status:'approved'},{...receipt,status:'unknown'},{...receipt,verification_case_id:null},{...receipt,verification_case_id:'bad-id'}]){
  const h=harness({data,error:null});await assert.rejects(h.browser('submit_seller_application',payload),/provider_onboarding_not_confirmed/);
  const result=await h.invokeEdge('submit_seller_application',payload);assert.equal(result.status,400);assert.equal(result.body.error,'provider_onboarding_not_confirmed');
 }
});
test('RPC failures are not converted to success or followed by fallback writes',async()=>{
 for(const message of ['identity_verification_required','seller_role_revoked','application_not_editable','qa_save_failure']){
  const h=harness({data:null,error:{message}});await assert.rejects(h.browser('submit_seller_application',payload),e=>e.message===message);
  const r=await h.invokeEdge('submit_seller_application',payload);assert.equal(r.status,400);assert.equal(r.body.error,message);assert.equal(h.calls.length,2);
 }
});
test('browser activation requires authenticated identity before invoking a mutation',async()=>{
 const h=harness(undefined,false);await assert.rejects(h.browser('activate_seller',payload),/authentication_required/);assert.equal(h.calls.length,0);
});
