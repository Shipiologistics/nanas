import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {moderationActionsForTarget,moderationError} from '../lib/moderation.mjs';
test('moderation UI only offers actions compatible with the target',()=>{
 assert.deepEqual(moderationActionsForTarget('user').map(x=>x[0]),['allow','warn','restrict','escalate']);
 for(const type of ['message','review'])assert.ok(!moderationActionsForTarget(type).some(x=>x[0]==='restrict'));
 assert.equal(moderationActionsForTarget('seller_profile').length,6);assert.deepEqual(moderationActionsForTarget(undefined),[]);
});
test('moderation error messages explain permission boundaries without leaking arbitrary errors',()=>{
 assert.match(moderationError({message:'account_enforcement_permission_required'}),/permission/);
 assert.match(moderationError({message:'report_already_closed'}),/final decision/);
 for(const error of [null,{message:'__proto__'},{message:'PRIVATE DATABASE DETAIL'}])assert.match(moderationError(error),/^Moderation could not be confirmed/);
});
test('moderation UI source contract requires authoritative confirmation and guards repeat submission',async()=>{
 const source=await readFile(new URL('../app/app/NanasPortal.tsx',import.meta.url),'utf8');
 assert.match(source,/if \(!selected \|\| moderationPending.current\) return/);
 assert.match(source,/result.report_id!==selected/);assert.match(source,/result.status!==\(moderationAction==='escalate'/);
 assert.match(source,/Allowing a report does not approve provider identity/);
});
