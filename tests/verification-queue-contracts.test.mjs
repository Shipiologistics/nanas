import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const hook=await readFile(new URL("../app/app/useVerificationQueue.ts",import.meta.url),"utf8");
const portal=await readFile(new URL("../app/app/NanasPortal.tsx",import.meta.url),"utf8");
test("verification queue source contract counts both pending states without a client page limit",()=>{
  assert.match(hook,/from\("verification_cases"\)/);
  assert.match(hook,/count:"exact",head:true/);
  assert.match(hook,/\["pending","needs_information"\]/);
  assert.doesNotMatch(hook,/\.limit\(/);
});
test("verification queue source contract refreshes and represents unknown counts explicitly",()=>{
  assert.match(hook,/setInterval/);assert.match(hook,/removeEventListener/);
  assert.match(hook,/if\(active\)setCount\(null\)/);
  assert.match(portal,/Verification case count unavailable/);
  assert.doesNotMatch(portal,/String\(adminOverview.sellersUnderReview\)/);
});
