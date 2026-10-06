import test from "node:test";
import assert from "node:assert/strict";
import { activeAdministratorAccount, preserveWorkspaceDuringRefresh } from "../lib/workspace-session.mjs";

test("same verified account refresh preserves mounted forms during role recheck", () => {
  assert.equal(preserveWorkspaceDuringRefresh("provider-a", "provider-a"), true);
});
test("different, missing or never-verified identities cannot retain the workspace", () => {
  for (const [current,next] of [["provider-a","admin-b"],[null,"provider-a"],["provider-a",undefined],["",""]]) {
    assert.equal(preserveWorkspaceDuringRefresh(current,next), false);
  }
});

test("admin workspace requires an explicitly active, non-deleted account",()=>{
  assert.equal(activeAdministratorAccount({account_status:"active",deleted_at:null}),true);
  for(const profile of [null,{},...['restricted','suspended','closed','pending'].map(account_status=>({account_status,deleted_at:null})),{account_status:'active'},{account_status:'active',deleted_at:'2026-01-01'}])assert.equal(activeAdministratorAccount(profile),false);
});
