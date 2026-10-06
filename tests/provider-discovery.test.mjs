import test from 'node:test';
import assert from 'node:assert/strict';
import { compareProviderRequests, parseProviderFeed } from '../lib/provider-discovery.mjs';

test('newest is creation date; featured priority applies only to recommended', () => {
  const old = { id:'a',createdAt:'2026-01-01',startsAt:'2026-12-01',featured:true,budget:5,quotes:[],quoteCount:9 };
  const recent = { id:'b',createdAt:'2026-02-01',startsAt:'2026-11-01',featured:false,budget:9,quotes:[],quoteCount:1 };
  assert.equal([recent,old].sort((a,b)=>compareProviderRequests(a,b,'recommended'))[0],old);
  for(const sort of ['newest','soonest','budget','quotes']) assert.equal([old,recent].sort((a,b)=>compareProviderRequests(a,b,sort))[0],recent);
});

test('provider feed validates records instead of silently treating failures as empty', () => {
  const row={id:'a',buyer_id:'b',service:'Pet care',area:'Nassau',care_summary:'QA',status:'requested',featured:true,has_quoted:false,quote_count:1,created_at:'2026-01-01',desired_start:'2026-12-01',desired_end:'2026-12-02',budget_minor:1900,schedule:{kind:'recurring',start_date:'2026-12-01',end_date:'2026-12-31',flexible_start:false,weekdays:[2,4],time_periods:[],specific_start:'09:00:00',specific_end:'12:00:00',schedule_may_vary:false,timezone:'America/Nassau'}};
  const result={items:[row],total:41,page:0,page_size:20};
  assert.equal(parseProviderFeed(result),result);
  for(const bad of [null,{}, {...result,total:-1},{...result,items:[{...row,featured:'true'}]},{...result,items:[{...row,created_at:'invalid'}]},{...result,items:[{...row,quote_count:-1}]},{...result,items:[{...row,schedule:{...row.schedule,weekdays:[]}}]}]) assert.throws(()=>parseProviderFeed(bad),/Invalid provider/);
  assert.equal(parseProviderFeed({items:[],total:0,page:0,page_size:20}).total,0);
});
