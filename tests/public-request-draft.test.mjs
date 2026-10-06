import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validatePublicRequestDraft,publicDraftAreaId,publicDraftIslandId} from '../lib/public-request-draft.mjs';
const draft={service:'pet-care',serviceId:'23000000-0000-0000-0000-000000000012',area:'Freeport & Lucaya',date:'2026-11-10',time:'14:00',hours:'4',budget:'160',recipient:'QA pet',description:'Fictional QA dog walking request.'};

test('public draft roundtrip preserves subservice and computes the actual end time',()=>{
  const saved=validatePublicRequestDraft(draft,'2026-10-06');
  assert.equal(saved.endTime,'18:00');assert.equal(saved.hours,4);assert.equal(saved.budget,160);
  assert.equal(saved.serviceId,draft.serviceId);
  assert.deepEqual(validatePublicRequestDraft(JSON.parse(JSON.stringify(saved)),'2026-10-06'),saved);
});
test('public drafts reject invalid dates, amounts, times and unsupported overnight visits',()=>{
  for(const change of [{date:'2026-02-30'},{date:'2026-10-01'},{date:'bad'},{time:'24:00'},{hours:'0'},{hours:'1.5'},{hours:'Infinity'},{budget:'NaN'},{budget:'19'},{budget:'100001'},{time:'22:00'},{service:'__proto__'},{recipient:''},{description:'x'.repeat(2001)}]) assert.throws(()=>validatePublicRequestDraft({...draft,...change},'2026-10-06'));
  assert.throws(()=>validatePublicRequestDraft(null,'2026-10-06'));
});
test('unsupported broad areas do not silently map to Nassau',()=>{
  assert.equal(publicDraftAreaId('Freeport & Lucaya'),'11000000-0000-0000-0000-000000000002');
  assert.equal(publicDraftIslandId('Freeport & Lucaya'),'10000000-0000-0000-0000-000000000002');
  assert.equal(publicDraftIslandId('Exuma'),'');
  for(const area of ['Abaco','Exuma','Eleuthera','Other Family Island','unknown'])assert.equal(publicDraftAreaId(area),'');
});
test('public budget accepts exact cents without floating-point rejection or five-dollar increments',()=>{
  for(const budget of [104,104.01,20.07,81.21,99999.99])assert.equal(validatePublicRequestDraft({...draft,budget},'2026-10-06').budget,budget);
  for(const budget of [20.001,104.011])assert.throws(()=>validatePublicRequestDraft({...draft,budget},'2026-10-06'));
});
test('request restoration requires exact known subservice and does not reuse stale end times',async()=>{
  const portal=await readFile(new URL('../app/app/NanasPortal.tsx',import.meta.url),'utf8');
  assert.match(portal,/subcategory\?\.code \?\? ""/);
  assert.match(portal,/endTime: saved.endTime, useSpecificTimes: true/);
  assert.match(portal,/areaId: publicDraftAreaId\(saved.area\)/);
  const dialog=await readFile(new URL('../app/app/WorkflowDialog.tsx',import.meta.url),'utf8');
  assert.match(dialog,/dialog.showModal\(\)/);
  assert.match(dialog,/onCancel=/);
});
