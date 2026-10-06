import test from 'node:test';
import assert from 'node:assert/strict';
import {additionalIntakeServices, requestIntakeSelection} from '../lib/intake-service-selection.mjs';
import {publicRequestCategories, validatePublicRequestDraft} from '../lib/public-request-draft.mjs';
const categories=Object.entries(additionalIntakeServices).map(([code,subcategories])=>({code,subcategories}));

test('all six original care services retain exact identity through request selection',()=>{
  for(const category of categories)for(const service of category.subcategories){
    const selected=requestIntakeSelection(categories,service.serviceId);
    assert.equal(selected.category.code,category.code);
    assert.equal(selected.subcategory,service);
  }
});
test('unknown service never silently becomes a different service',()=>{
  assert.equal(requestIntakeSelection(categories,'unknown').subcategory,undefined);
  assert.equal(requestIntakeSelection(categories,undefined).subcategory,categories[0].subcategories[0]);
});
test('public clinical handoffs restore within the correct category with exact service IDs',()=>{
  for(const category of categories)for(const service of category.subcategories){
    const family=category.code==='adult_care'?'home-healthcare':'senior-care';
    const saved=validatePublicRequestDraft({service:family,serviceId:service.serviceId,area:'Nassau & Paradise Island',date:'2099-01-01',time:'10:00',hours:2,budget:100,recipient:'Fictional QA adult',description:'Fictional QA care request only.'},'2026-10-06');
    const target=categories.find(item=>item.code===publicRequestCategories[saved.service]);
    assert.equal(target.subcategories.find(item=>item.serviceId===saved.serviceId),service);
  }
});
