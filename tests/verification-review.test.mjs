import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verificationReviewError} from '../lib/verification-review.mjs';

test('verification review explains approval guards for ordinary SDK errors',()=>{
 assert.match(verificationReviewError({message:'inspect_current_verification_evidence_first'}),/Load the current private evidence/);
 assert.match(verificationReviewError(new Error('verification_evidence_not_current')),/expired/);
 assert.match(verificationReviewError({message:'case_already_decided'}),/final decision/);
 assert.match(verificationReviewError({message:'use_service_credential_review'}),/Service credentials/);
});
test('unknown verification errors do not echo database details or hostile keys',()=>{
 for(const error of [null,undefined,'network failure',{message:'private sql details'}, {message:'__proto__'},{message:'constructor'},{message:1}])
  assert.equal(verificationReviewError(error),'Verification decision could not be saved. Refresh the case and try again.');
});
test('evidence presentation forwards optional recorded dates without claiming missing dates are nonexpiring',async()=>{
 const route=await readFile(new URL('../app/api/verification/evidence/route.ts',import.meta.url),'utf8');
 const component=await readFile(new URL('../app/app/VerificationEvidence.tsx',import.meta.url),'utf8');
 const api=await readFile(new URL('../lib/nanas-api.ts',import.meta.url),'utf8');
 assert.match(route,/issueDate: document.issue_date \?\? null/);assert.match(route,/expiryDate: document.expiry_date \?\? null/);
 assert.match(component,/Dates not shown here do not mean this document never expires/);
 assert.match(api,/name === "admin_review_verification"\) throw new Error\(verificationReviewError\(error\)\)/);
});
