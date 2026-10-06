import test from "node:test";
import assert from "node:assert/strict";
import {clearCredentialRetries,credentialIssuer,credentialRetryKey,decodeCredentialRetry,encodeCredentialRetry} from "../lib/credential-retry.mjs";
const owner="00000000-0000-4000-8000-000000000001",other="00000000-0000-4000-8000-000000000002";
const payload={p_submission_id:other,p_credential_type:"rn_license",p_service_id:null,p_issuing_body:"QA issuer",p_issue_date:"2026-01-01",p_expiry_date:"2027-01-01",p_storage_path:owner+"/unassigned/qa.pdf",p_original_name:"qa.pdf"};
test("retry serialization round trips exactly the same id and uploaded reference",()=>{
  const encoded=encodeCredentialRetry(owner,payload);
  assert.deepEqual(decodeCredentialRetry(encoded,owner),payload);
  assert.equal(encodeCredentialRetry(owner,decodeCredentialRetry(encoded,owner)),encoded);
});
test("retry storage keys and payloads isolate provider accounts",()=>{
  assert.notEqual(credentialRetryKey(owner),credentialRetryKey(other));
  assert.equal(decodeCredentialRetry(encodeCredentialRetry(owner,payload),other),null);
  assert.throws(()=>encodeCredentialRetry(other,payload));
  assert.throws(()=>credentialRetryKey("not-a-user"));
});
test("retry records never persist arbitrary keys, credentials or file contents",()=>{
  const encoded=encodeCredentialRetry(owner,{...payload,access_token:"never-save",file:{bytes:"never-save"},signedUrl:"never-save"});
  assert.equal(encoded.includes("never-save"),false);
});
test("corrupt, oversized or unsupported retry records fail closed",()=>{
  for(const value of [null,"bad JSON","x".repeat(6001),JSON.stringify({version:2,owner,payload}),JSON.stringify({version:1,owner,payload:{...payload,p_issue_date:"2026-02-30"}})])assert.equal(decodeCredentialRetry(value,owner),null);
});
test("retry payload accepts owned private image references but rejects URLs and traversal",()=>{
  const image={...payload,p_storage_path:owner+"/cloudinary/image/authenticated/png/nanas/verification/"+owner+"/fixture"};
  assert.deepEqual(decodeCredentialRetry(encodeCredentialRetry(owner,image),owner),image);
  for(const path of [owner+"/../other/document.pdf",owner+"/https://example.com/private.pdf",owner+"//empty.pdf"])
    assert.throws(()=>encodeCredentialRetry(owner,{...payload,p_storage_path:path}));
});
test("blank issuer is rejected before uploading and valid issuer is normalized",()=>{
  for(const issuer of [null,"","   "," A ","x".repeat(161)])assert.throws(()=>credentialIssuer(issuer));
  assert.equal(credentialIssuer("  Fictional QA  "),"Fictional QA");
});
test("sign-out cleanup removes only this feature's retry data",()=>{
  const entries=new Map([[credentialRetryKey(owner),"draft"],[credentialRetryKey(other),"draft"],["supabase-auth","untouched"]]);
  const storage={get length(){return entries.size;},key:index=>[...entries.keys()][index],removeItem:key=>entries.delete(key)};
  clearCredentialRetries(storage);assert.deepEqual([...entries],[['supabase-auth','untouched']]);
  assert.doesNotThrow(()=>clearCredentialRetries({get length(){throw new Error("storage blocked");}}));
  assert.doesNotThrow(()=>clearCredentialRetries(()=>{throw new Error("storage property blocked");}));
});
