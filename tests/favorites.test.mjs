import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFavorite,checkFavoriteConfirmation,loadFavoriteIds} from '../lib/favorites.mjs';

test('favorite confirmation matches provider and desired state before local success',()=>{
  const ok={ok:true,seller_id:'provider',favorite:true};
  assert.equal(checkFavoriteConfirmation(ok,'provider',true),ok);
  for(const value of [null,{}, {ok:true},{...ok,seller_id:'other'},{...ok,favorite:false}]) assert.throws(()=>checkFavoriteConfirmation(value,'provider',true),/not confirmed/);
});
test('favorite state updates are idempotent and preserve other providers',()=>{
  assert.deepEqual(applyFavorite(['a','b','b'],'b',true),['a','b']);
  assert.deepEqual(applyFavorite(['a','b'],'b',false),['a']);
  assert.deepEqual(applyFavorite(['a'],'b',false),['a']);
});
test('favorites paginate past API caps and propagate errors instead of false empty success',async()=>{
  const ids=Array.from({length:1201},(_,i)=>String(i).padStart(4,'0'));let calls=0;
  const result=await loadFavoriteIds(async cursor=>{calls++;const offset=cursor===null?0:ids.indexOf(cursor)+1;return {data:ids.slice(offset,offset+500).map(seller_id=>({seller_id})),error:null};});
  assert.deepEqual(result,ids);assert.equal(calls,4);
  await assert.rejects(loadFavoriteIds(async()=>({data:null,error:new Error('offline')})),/offline/);
  await assert.rejects(loadFavoriteIds(async()=>({data:[{seller_id:'a'},{seller_id:'a'}],error:null})),/Invalid saved-provider page/);
  assert.deepEqual(await loadFavoriteIds(async()=>({data:[],error:null})),[]);
});
