import test from "node:test";
import assert from "node:assert/strict";
import { verificationStorageType } from "../lib/verification-storage.mjs";
const owner = "05e8eb22-5064-47a0-b226-0fd8dea3e97f";
test("private PDF and legacy image references stay under the stored document owner", () => {
  assert.equal(verificationStorageType(`${owner}/unassigned/uuid-credential.pdf`, owner), "document");
  assert.equal(verificationStorageType(`${owner}/identity.JPG`, owner), "image");
  assert.equal(verificationStorageType(`${owner}/legacy/image.webp`, owner), "image");
});
test("private evidence rejects traversal, foreign owners, URL payloads and unsupported types", () => {
  for (const path of ["other/file.pdf",`${owner}/../file.pdf`,`${owner}/./file.pdf`,`${owner}//file.pdf`,`${owner}/%2e%2e/file.pdf`,`${owner}/file.pdf?token=x`,`${owner}/file.pdf#x`,`${owner}/file\\x.pdf`,`${owner}/file.html`,`${owner}/file.svg`,`${owner}/`,null]) {
    assert.equal(verificationStorageType(path,owner),null,String(path));
  }
});
