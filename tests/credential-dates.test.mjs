import test from "node:test";
import assert from "node:assert/strict";
import {credentialDateWarning} from "../lib/credential-dates.mjs";
const today="2026-10-05";
test("expiry day remains current until the following Bahamas day",()=>{
  const record={issue_date:"2025-01-01",expiry_date:today};
  assert.equal(credentialDateWarning(record,today),null);
  assert.match(credentialDateWarning(record,"2026-10-06"),/expired/);
});
test("explicitly non-expiring evidence still needs a current issue date",()=>{
  assert.equal(credentialDateWarning({issue_date:today,expiry_date:null},today),null);
  assert.match(credentialDateWarning({issue_date:"2026-10-06",expiry_date:null},today),/not yet valid/);
});
test("pending, rejected and approved records all show outdated evidence warnings",()=>{
  for(const status of ["pending","needs_information","approved","rejected","revoked"])
    assert.match(credentialDateWarning({status,issue_date:"2025-01-01",expiry_date:"2026-01-01"},today),/expired/);
});
test("missing, impossible and reversed credential dates are never presented as current",()=>{
  for(const issue_date of [null,"","2026-02-30","not a date"])
    assert.match(credentialDateWarning({issue_date,expiry_date:null},today),/missing or invalid/);
  assert.match(credentialDateWarning({issue_date:today,expiry_date:"2026-10-01"},today),/precedes/);
  assert.match(credentialDateWarning({issue_date:today,expiry_date:""},today),/missing or invalid/);
});
