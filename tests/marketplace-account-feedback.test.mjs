import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { marketplaceAccountFeedback } from '../lib/marketplace-account-feedback.mjs';

const source = ts.transpileModule(await readFile(new URL('../lib/nanas-api.ts',import.meta.url),'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const factory = vm.runInNewContext(`(function(getSupabase,marketplaceAccountFeedback){${source}\nreturn marketplaceCommand;})`,{Error,crypto,Date});

test('restriction feedback provides next steps without disclosing counterparty moderation details',()=>{
  assert.match(marketplaceAccountFeedback({message:'account_new_activity_restricted'}),/Contact support/);
  const counterpart=marketplaceAccountFeedback({message:'marketplace_account_unavailable',details:'private moderation reason'});
  assert.match(counterpart,/No new purchase was completed/);
  assert.doesNotMatch(counterpart,/restricted|suspended|private moderation reason/);
  for(const error of [null,{},'account_new_activity_restricted',{message:'Network error'}]) assert.equal(marketplaceAccountFeedback(error),null);
});

test('actual marketplace API translates guard failures across all checkout and quote RPC routes',async()=>{
  for(const action of ['create_care_request','submit_quote','accept_quote','purchase_conversation']) {
    for(const message of ['account_new_activity_restricted','marketplace_account_unavailable']) {
      let calls=0;
      const command=factory(()=>({rpc:async()=>{calls++;return {data:null,error:{message,code:'P0001'}};}}),marketplaceAccountFeedback);
      await assert.rejects(command(action,{}),error=>error instanceof Error && error.message===marketplaceAccountFeedback({message}));
      assert.equal(calls,1);
    }
  }
});

test('actual marketplace API preserves other errors and successful idempotent replies',async()=>{
  const error={message:'price_changed',code:'P0001'};
  let command=factory(()=>({rpc:async()=>({data:null,error})}),marketplaceAccountFeedback);
  await assert.rejects(command('create_care_request',{}),err=>err===error);
  const data={ok:true,replayed:true,request_id:'saved-request'};
  command=factory(()=>({rpc:async()=>({data,error:null})}),marketplaceAccountFeedback);
  assert.equal(await command('create_care_request',{}),data);
});

test('browser command requires a loaded message and uses the bounded read RPC',async()=>{
  const calls=[];
  const receipt={ok:true,read_through:'2026-01-01T00:00:00.123456Z'};
  const command=factory(()=>({auth:{getUser:async()=>({data:{user:{id:'reader'}},error:null})},rpc:async(name,args)=>{
    calls.push({name,args});return {data:receipt,error:null};
  }}),marketplaceAccountFeedback);
  await assert.rejects(command('mark_conversation_read',{conversation_id:'conversation'}),/loaded message is required/);
  assert.equal(calls.length,0);
  assert.equal(await command('mark_conversation_read',{conversation_id:'conversation',message_id:'loaded-message'}),receipt);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{name:'mark_conversation_read_through',args:{p_conversation_id:'conversation',p_message_id:'loaded-message'}}]);
});

test('browser read command fails on unconfirmed RPC responses',async()=>{
  for(const data of [null,{ok:false},{ok:true},{read_through:'2026-01-01'},[]]) {
    const command=factory(()=>({auth:{getUser:async()=>({data:{user:{id:'reader'}},error:null})},rpc:async()=>({data,error:null})}),marketplaceAccountFeedback);
    await assert.rejects(command('mark_conversation_read',{conversation_id:'conversation',message_id:'message'}),/not confirmed/);
  }
});
