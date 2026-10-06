import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
const source=ts.transpileModule(await readFile(new URL('../lib/cloudinary-policy.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/export /g,'');
const policy=vm.runInNewContext(`(function(){${source}\nreturn {cloudinaryPublicIdPrefix,isOwnedCloudinaryPublicId};})()`,{});
const user='48000000-0000-4000-8000-000000000001',asset='48000000-0000-4000-8000-000000000002';

test('Cloudinary ownership accepts only one generated asset under the exact user and purpose folder',()=>{
 const profile=`nanas/public/users/${user}/profile/${asset}`;
 assert.equal(policy.isOwnedCloudinaryPublicId('profile',user,profile),true);
 for(const candidate of [
  `nanas/public/users/${user}/general/${asset}`,
  `nanas/public/users/48000000-0000-4000-8000-000000000009/profile/${asset}`,
  `nanas/public/users/${user}/profile/not-a-uuid`,`${profile}/child`,`${profile}extra`,
 ])assert.equal(policy.isOwnedCloudinaryPublicId('profile',user,candidate),false);
 assert.equal(policy.isOwnedCloudinaryPublicId('verification',user,`nanas/private/users/${user}/verification/${asset}`),true);
});
test('verification and deletion routes enforce exact ownership, while deletion protects stored references',async()=>{
 const [sign,verify,remove,auth]=await Promise.all([
  readFile(new URL('../app/api/uploads/images/sign/route.ts',import.meta.url),'utf8'),
  readFile(new URL('../app/api/uploads/images/verify/route.ts',import.meta.url),'utf8'),
  readFile(new URL('../app/api/uploads/images/delete/route.ts',import.meta.url),'utf8'),
  readFile(new URL('../lib/supabase-api-auth.ts',import.meta.url),'utf8'),
 ]);
 assert.match(sign,/requireActiveAccount\(supabase, user\.id\)/);
 assert.match(verify,/requireActiveAccount\(supabase, user\.id\)/);
 assert.match(auth,/data\?\.account_status !== "active" \|\| data\.deleted_at/);
 assert.match(verify,/isOwnedCloudinaryPublicId\(body\.kind, user\.id, publicId\)/);
 assert.match(remove,/isOwnedCloudinaryPublicId\(body\.kind, user\.id, body\.publicId\)/);
 assert.match(remove,/seller_profiles"\)\.select\("avatar_path"\)/);
 assert.match(remove,/seller_documents"\)\.select\("id"\)/);
 assert.match(remove,/Image is still in use[\s\S]*status: 409/);
 assert.ok(remove.indexOf('Image is still in use')<remove.indexOf('destroyCloudinaryImage(body.publicId'));
 assert.match(remove,/reference check"\) \? 503/);
});
