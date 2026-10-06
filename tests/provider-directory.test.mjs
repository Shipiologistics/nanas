import test from 'node:test';
import assert from 'node:assert/strict';
import {isDiscoverableProvider,loadDirectoryRows,providerMatchesService,filterPublicProviders} from '../lib/provider-directory.mjs';
import {readFile} from 'node:fs/promises';

test('published directory entries do not require healthcare credentials, but participant stubs stay hidden',()=>{
  const provider={role:'seller',status:'active',sellerDetails:{locality:'Nassau',services:[{id:'pet-care',name:'Dog walker',bio:'Fictional dog walking profile with clear service information.'}],credentials:[],safetyChecks:[]}};
  assert.equal(isDiscoverableProvider(provider),true);
  assert.equal(isDiscoverableProvider({...provider,sellerDetails:undefined}),false);
  assert.equal(isDiscoverableProvider({...provider,sellerDetails:{...provider.sellerDetails,published:false}}),false);
  assert.equal(isDiscoverableProvider({...provider,status:'suspended'}),false);
  assert.equal(isDiscoverableProvider({...provider,role:'buyer'}),false);
  assert.equal(isDiscoverableProvider({...provider,sellerDetails:{...provider.sellerDetails,services:[]}}),false);
});

test('directory keyset loading crosses API caps and never returns partial success',async()=>{
  const rows=Array.from({length:1201},(_,i)=>({user_id:String(i).padStart(5,'0')}));let calls=0;
  const loaded=await loadDirectoryRows(async cursor=>{calls++;return {data:rows.filter(row=>!cursor||row.user_id>cursor).slice(0,250),error:null};});
  assert.deepEqual(loaded,rows);assert.equal(calls,6);
  await assert.rejects(loadDirectoryRows(async cursor=>cursor ? {data:null,error:new Error('failed second page')} : {data:[rows[0]],error:null}),/failed second page/);
  await assert.rejects(loadDirectoryRows(async()=>({data:[rows[0],rows[0]],error:null})),/Invalid provider directory page/);
});

test('public service families match real subservices without unrelated fallback',()=>{
  const provider=slug=>({sellerDetails:{services:[{id:'uuid',slug}]}});
  for(const [slug,family] of [['pet-care-walker','pet-care'],['child-care-nanny','child-care'],['senior-care-companion','senior-care'],['adult-care-hands-on','home-healthcare'],['home-nursing','home-healthcare'],['housekeeping-housekeeper','housekeeping'],['tutoring-math','tutoring']]) assert.equal(providerMatchesService(provider(slug),family),true);
  assert.equal(providerMatchesService(provider('home-nursing'),'pet-care'),false);
});

test('public filtering and stable sorting happen before result slicing',()=>{
  const providers=Array.from({length:1201},(_,i)=>({id:String(i).padStart(5,'0'),name:`Provider ${i}`,sellerDetails:{locality:'Freeport',island:'Grand Bahama',rating:4,completedBookings:i,services:[{id:'uuid',slug:'pet-care-walker',name:'Dog walker',rate:1201-i}]}}));
  const base={service:'pet-care',area:'freeport',sort:'lowest-rate'};
  assert.equal(filterPublicProviders(providers,base)[0].name,'Provider 1200');
  assert.equal(filterPublicProviders(providers,{...base,search:'Provider 1200'}).length,1);
  assert.equal(filterPublicProviders(providers,{...base,service:'tutoring'}).length,0);
  assert.equal(filterPublicProviders(providers,{...base,sort:'highest-rated'})[0].id,'00000');
});

test('directory forms reset with URL filters and live server reads never use privileged credentials',async()=>{
  const source=await readFile(new URL('../app/marketplace/PublicMarketplacePages.tsx',import.meta.url),'utf8');
  assert.match(source, /form key=\{JSON.stringify\(filters\)\}/);
  assert.doesNotMatch(source, /matching.length \? matching : publicProviders/);
  const server=await readFile(new URL('../lib/public-provider-server.ts',import.meta.url),'utf8');
  assert.match(server,/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(server,/cache:'no-store'/);
  assert.doesNotMatch(server,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(server,/catch \{ return \{providers:\[\],error:true\}/);
});
