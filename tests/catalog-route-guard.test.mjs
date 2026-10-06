import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const {NextRequest,NextResponse}=require('next/server');
// This installed Next version retains the older exported utility name.
const {unstable_doesMiddlewareMatch:matches,getRewrittenUrl}=require('next/experimental/testing/server');
const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const catalog=vm.runInNewContext(`(function(){${transpile(await readFile(new URL('../lib/public-marketplace.ts',import.meta.url),'utf8'))}\nreturn {careServices,publicCareRequests};})`)();
const {proxy,config}=vm.runInNewContext(`(function(NextResponse,careServices,publicCareRequests){${transpile(await readFile(new URL('../proxy.ts',import.meta.url),'utf8'))}\nreturn {proxy,config};})`,{URL,decodeURIComponent})(NextResponse,catalog.careServices,catalog.publicCareRequests);

test('catalogue proxy excludes private panels, auth, APIs, provider pages and assets',()=>{
  for(const url of ['/app/admin/users','/app/buyer/messages','/app/seller/requests','/auth','/api/uploads/images/sign','/providers/a-provider','/_next/static/a.js','/favicon.svg','/services','/care-requests','/']) {
    assert.equal(matches({config,nextConfig:{},url}),false,url);
  }
  for(const url of ['/services/example','/care-requests/example']) assert.equal(matches({config,nextConfig:{},url}),true,url);
});

test('every actual service and illustrative request slug passes through unchanged',()=>{
  for(const [prefix,items] of [['services',catalog.careServices],['care-requests',catalog.publicCareRequests]]) {
    for(const {slug} of items) {
      const response=proxy(new NextRequest(`http://localhost/${prefix}/${slug}?demo=1`));
      assert.equal(response.headers.get('x-middleware-next'),'1');
      assert.equal(response.headers.get('x-middleware-rewrite'),null);
    }
  }
});

test('missing and malformed catalogue slugs rewrite internally without retaining query values',()=>{
  for(const suffix of ['unknown','%ZZ','%2Funknown','%3Cscript%3E']) {
    for(const prefix of ['services','care-requests']) {
      const response=proxy(new NextRequest(`http://localhost/${prefix}/${suffix}?private_hint=not-forwarded`));
      assert.equal(response.status,404);assert.equal(getRewrittenUrl(response),'http://localhost/_not-found');
      assert.equal(response.headers.get('location'),null);
    }
  }
});

test('route guard does not intercept mutations or alter real HTTP method handling',()=>{
  for(const method of ['POST','PUT','PATCH','DELETE']) {
    assert.equal(proxy(new NextRequest('http://localhost/services/unknown',{method})).headers.get('x-middleware-next'),'1');
  }
  assert.equal(proxy(new NextRequest('http://localhost/services/unknown',{method:'HEAD'})).status,404);
});
