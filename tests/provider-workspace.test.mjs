import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import {providerWorkspaceArguments,confirmedProviderWorkspace,uploadedProfileImageCommitted} from '../lib/provider-workspace.mjs';
import {marketplaceAccountFeedback} from '../lib/marketplace-account-feedback.mjs';
const id='47000000-0000-4000-8000-000000000001',row='47000000-0000-4000-8000-000000000002';
const actions={
 seller_upsert_service:{payload:{service_id:id,rate_minor:2500,rate_max_minor:4000,service_bio:'Fictional service biography',years_experience:4,capabilities:['Companionship'],additional_help:[],active:true},receipt:{ok:true,seller_service_id:row,active_service_profiles:1,maximum_service_profiles:3}},
 seller_replace_weekly_availability:{payload:{weekdays:[1,3,5],local_start:'09:00',local_end:'17:30'},receipt:{ok:true,rules_created:3}},
 seller_set_publication:{payload:{published:true},receipt:{ok:true,published_at:'2026-10-06T10:00:00Z'}},
 seller_update_public_profile:{payload:{display_name:' QA Provider ',avatar_path:null,headline:' Trusted local care ',languages:['English'],island_id:id,locality:' Nassau ',vaccinations:[],additional_details:['Has transport']},receipt:{ok:true,avatar_path:null}},
 seller_upsert_service_area:{payload:{service_area_id:id,radius_km:20.5,travel_fee_minor:500,active:true},receipt:{ok:true,seller_service_area_id:row}},
};
const source=ts.transpileModule(await readFile(new URL('../lib/nanas-api.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const factory=vm.runInNewContext(`(function(getSupabase,providerWorkspaceArguments,confirmedProviderWorkspace,marketplaceAccountFeedback){${source}\nreturn marketplaceCommand;})`,{Error,Date,crypto});
function commandFor(response){const calls=[];const command=factory(()=>({rpc:async(name,args)=>{calls.push({name,args});return response;}}),providerWorkspaceArguments,confirmedProviderWorkspace,marketplaceAccountFeedback);return {command,calls};}

test('all provider workspace saves use exact validated RPC arguments and confirmed receipts',async()=>{
 for(const [action,{payload,receipt}] of Object.entries(actions)){
  const {command,calls}=commandFor({data:receipt,error:null});assert.deepEqual(await command(action,payload),receipt);assert.equal(calls.length,1);assert.equal(calls[0].name,action);assert.deepEqual(calls[0].args,providerWorkspaceArguments(action,payload));
 }
});
test('malformed or contradictory receipts never become successful UI saves',async()=>{
 for(const [action,{payload}] of Object.entries(actions))for(const data of [null,{},[],false,{ok:false},{ok:true}]){
  const {command}=commandFor({data,error:null});await assert.rejects(command(action,payload),/provider_workspace_save_not_confirmed/);
 }
 assert.throws(()=>confirmedProviderWorkspace('seller_replace_weekly_availability',{ok:true,rules_created:2},actions.seller_replace_weekly_availability.payload),/not_confirmed/);
 assert.throws(()=>confirmedProviderWorkspace('seller_set_publication',{ok:true,published_at:null},{published:true}),/not_confirmed/);
 assert.throws(()=>confirmedProviderWorkspace('seller_set_publication',{ok:true,published_at:'bad'},{published:true}),/not_confirmed/);
 assert.throws(()=>confirmedProviderWorkspace('seller_update_public_profile',{ok:true,avatar_path:'other'},{avatar_path:null}),/not_confirmed/);
});
test('invalid provider values are rejected before an RPC',async()=>{
 const invalid=[
  ['seller_upsert_service',{...actions.seller_upsert_service.payload,service_id:'bad'}],['seller_upsert_service',{...actions.seller_upsert_service.payload,rate_minor:NaN}],['seller_upsert_service',{...actions.seller_upsert_service.payload,rate_max_minor:2000}],['seller_upsert_service',{...actions.seller_upsert_service.payload,years_experience:1.5}],['seller_upsert_service',{...actions.seller_upsert_service.payload,capabilities:['x']}],
  ['seller_replace_weekly_availability',{...actions.seller_replace_weekly_availability.payload,weekdays:[1,1]}],['seller_replace_weekly_availability',{...actions.seller_replace_weekly_availability.payload,weekdays:[7]}],['seller_replace_weekly_availability',{...actions.seller_replace_weekly_availability.payload,local_start:'24:00'}],['seller_replace_weekly_availability',{...actions.seller_replace_weekly_availability.payload,local_end:'08:00'}],
  ['seller_set_publication',{published:'true'}],['seller_update_public_profile',{...actions.seller_update_public_profile.payload,display_name:'x'}],['seller_update_public_profile',{...actions.seller_update_public_profile.payload,languages:[]}],['seller_update_public_profile',{...actions.seller_update_public_profile.payload,island_id:'bad'}],['seller_update_public_profile',{...actions.seller_update_public_profile.payload,vaccinations:['x']}],
  ['seller_upsert_service_area',{...actions.seller_upsert_service_area.payload,radius_km:501}],['seller_upsert_service_area',{...actions.seller_upsert_service_area.payload,travel_fee_minor:-1}],['seller_upsert_service_area',{...actions.seller_upsert_service_area.payload,active:null}],
 ];
 for(const [action,payload] of invalid){const {command,calls}=commandFor({data:null,error:null});await assert.rejects(command(action,payload),/invalid_/);assert.equal(calls.length,0);}
});
test('profile-image cleanup distinguishes committed, absent and uncertain readback',()=>{
 const asset='cloudinary:image:upload:png:nanas/public/users/qa/profile/asset';
 assert.equal(uploadedProfileImageCommitted(asset,{avatar_path:asset},null),true);
 assert.equal(uploadedProfileImageCommitted(asset,{avatar_path:'old'},null),false);
 assert.equal(uploadedProfileImageCommitted(asset,{avatar_path:asset},{message:'network'}),false);
 assert.equal(uploadedProfileImageCommitted(undefined,{avatar_path:null},null),false);
});
test('profile editor verifies the authoritative avatar before cleanup after a lost save response',async()=>{
 const portal=await readFile(new URL('../app/app/NanasPortal.tsx',import.meta.url),'utf8');
 assert.match(portal,/seller_profiles"\)\.select\("avatar_path"\)/);
 assert.match(portal,/if \(readback\.error\) uploadedImageCleanupSafe = false/);
 assert.match(portal,/if \(cloudinaryUpload && uploadedImageCleanupSafe\)/);
});
test('coverage manager exposes every saved row for update and deactivation',async()=>{
 const portal=await readFile(new URL('../app/app/NanasPortal.tsx',import.meta.url),'utf8');
 assert.match(portal,/const selectedSellerCoverageRow = sellerCoverageRows\.find/);
 assert.match(portal,/sellerCoverageRows\.map\(\(area\) => <button/);
 assert.match(portal,/setSelected\(area\.areaId\)/);
 assert.match(portal,/selectedSellerCoverageRow && <input type="hidden" name="areaId"/);
 assert.match(portal,/defaultChecked=\{selectedSellerCoverageRow\?\.active \?\? true\}/);
 assert.match(portal,/Unavailable service area/);
});
test('demo publication survives reloads and hides unpublished providers across buyer surfaces',async()=>{
 const portal=await readFile(new URL('../app/app/NanasPortal.tsx',import.meta.url),'utf8');
 assert.match(portal,/sellerPublishedAt \}\)\);/);
 assert.match(portal,/sellerDetails: \{ \.\.\.user\.sellerDetails, published \}/);
 assert.match(portal,/isDiscoverableProvider\(item\)/);
 assert.match(portal,/isDiscoverableProvider\(user\)/);
});
