import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { requestPostingKey } from '../lib/request-posting.mjs';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};};
test('unchanged posting retries retain a key without storing private intake text',async()=>{
  const storage=memory(),payload={summary:'PRIVATE QA NOTE',expected_fee_minor:1900};
  const key=await requestPostingKey(payload,'buyer',storage);
  assert.equal(await requestPostingKey({...payload},'buyer',storage),key);
  assert.doesNotMatch([...storage.values.values()].join(''),/PRIVATE QA NOTE/);
  assert.notEqual(await requestPostingKey(payload,'other',storage),key);
  assert.notEqual(await requestPostingKey({...payload,expected_fee_minor:3900},'buyer',storage),key);
});
test('corrupt stored posting attempts recover before requesting a payment',async()=>{
  const storage=memory();storage.setItem('nanas-request-checkout:buyer','not JSON');
  assert.match(await requestPostingKey({},'buyer',storage),/^request:/);
  await assert.rejects(requestPostingKey({},'buyer',{getItem(){return null;},setItem(){throw new Error('storage unavailable');}}),/storage unavailable/);
});
test('posting UI submits expected server price and stable key with explicit simulation labels',async()=>{
  const source=await readFile(new URL('../app/app/NanasPortal.tsx',import.meta.url),'utf8');
  assert.match(source,/requestPostingPending.current\) return/);
  assert.match(source,/requestPostingKey\(payload, currentUserId, sessionStorage\)/);
  assert.match(source,/idempotency_key: key/);
  assert.match(source,/expected_fee_minor: Math.round\(chosenPlan.fee \* 100\)/);
  assert.match(source,/Simulate \$\{money\(chosenPlan.fee\)\} payment & post/);
  assert.doesNotMatch(source,/`Pay \$\{money\(chosenPlan.fee\)\} & post`/);
});
