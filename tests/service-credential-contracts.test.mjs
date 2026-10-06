import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const source=await readFile(new URL('../app/app/ServiceCredentials.tsx',import.meta.url),'utf8');
const portal=await readFile(new URL('../app/app/NanasPortal.tsx',import.meta.url),'utf8');

test('service credential source contract exposes separate connected provider and admin workflows',()=>{
 assert.match(portal,/<ServiceCredentials key=\{currentUserId\} userId=\{currentUserId\} \/>/);assert.match(portal,/<ServiceCredentials admin key=\{currentUserId\} userId=\{currentUserId\} \/>/);
 for(const field of ['Service scope','Credential type','Issuing body','Issue date','Expiry date','Private credential evidence']) assert.ok(source.includes(field),field);
 assert.match(source,/p_submission_id:crypto.randomUUID\(\)/);assert.match(source,/p_expiry_date:noExpiry \? null/);
});
test('credential UI source contract preserves uncertain submissions and resets stale decisions',()=>{
 assert.match(source,/if \(!pending.current\)/);assert.match(source,/Retry submission to reuse the same evidence safely/);
 assert.doesNotMatch(source,/deleteImage/);assert.match(source,/<form key=\{row.status\}/);
 assert.match(source,/key=\{`\$\{row.case_id\}:\$\{row.status\}`\}/);
});
test('credential UI source contract handles load failures and requires review reasons',()=>{
 assert.match(source,/role="alert"/);assert.match(source,/minLength=\{5\} maxLength=\{2000\} required/);
 assert.match(source,/!loading && !error && rows.length===0/);assert.match(source,/p_after: cursor, p_limit: 20/);
 assert.match(source,/expires<issued/);assert.match(source,/file.size > 8\*1024\*1024/);
});
test('credential retry source contract persists before RPC and stops uploads after unmount',()=>{
 assert.ok(source.indexOf('sessionStorage.setItem(credentialRetryKey(userId),encodeCredentialRetry')<source.indexOf('await call("submit_service_credential",pending.current)'));
 assert.match(source,/if\(!activeSubmission.current\)return/);
 assert.match(source,/credentialIssuer\(form.get\("issuer"\)\)/);
 assert.match(source,/decodeCredentialRetry\(saved,userId\)/);
});
