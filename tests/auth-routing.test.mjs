import assert from 'node:assert/strict';
import test from 'node:test';
import {safeWorkspacePath,ownWorkspace,workspaceRoute} from '../lib/auth-routing.mjs';

test('auth handoff preserves local workspace queries and anchors',()=>{
 const path='/app/buyer/overview?newRequest=1&category=senior_care&resumeRequest=1#details';
 assert.equal(safeWorkspacePath(path),path);
 assert.deepEqual(workspaceRoute(path,['buyer']),{destination:path,requestedRole:'buyer'});
 assert.equal(safeWorkspacePath('/app/seller/requests/abc-123'),'/app/seller/requests/abc-123');
});
test('auth destination rejects external, ambiguous, traversing and encoded paths',()=>{
 for(const path of ['https://evil.example/app/buyer','//evil.example','/app/buyer/../../auth','/app/buyer/%2e%2e/auth','/app/buyer/%5cfoo','/app/buyer/\\evil','/app/buyer/\nfoo','/app/buyer/ space','/app/outsider/overview',['/app/admin/overview'],null, '/app/buyer/'+ 'x'.repeat(2048)]) assert.equal(safeWorkspacePath(path),undefined,String(path));
});
test('wrong role offers an account choice instead of silently routing away',()=>{
 assert.deepEqual(workspaceRoute('/app/admin/kyc',['buyer']),{destination:null,requestedRole:'admin'});
 assert.equal(ownWorkspace(['buyer']),'/app/buyer/overview');
 assert.equal(workspaceRoute('/app/buyer?resumeRequest=1',['buyer']).destination,'/app/buyer?resumeRequest=1');
});
test('active multi-role accounts retain requested role and no-role accounts fail closed',()=>{
 assert.equal(workspaceRoute('/app/buyer/bookings',['admin','buyer']).destination,'/app/buyer/bookings');
 assert.equal(ownWorkspace(['seller','admin','buyer']),'/app/admin/overview');
 assert.equal(ownWorkspace([]),null);
 assert.deepEqual(workspaceRoute(undefined,[]),{destination:null,requestedRole:null});
});
