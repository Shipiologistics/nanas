import assert from "node:assert/strict";
import test from "node:test";
import { workerEvidence } from "../lib/worker-evidence.mjs";

test("enabled or healthy registry rows alone never establish worker execution", () => {
  for (const health of ["ready", "healthy", "unknown"]) {
    assert.deepEqual(workerEvidence({ enabled: true, health }), { label: "No recorded runs", tone: "warn" });
    assert.equal(workerEvidence({ enabled: true, health, lastRunAt: "2026-10-05T00:00:00Z" }).label, "Run history unavailable");
  }
});
test("worker labels distinguish disabled, failed, running and verified completion evidence", () => {
  const worker = { enabled: true, health: "healthy" };
  assert.equal(workerEvidence({ ...worker, enabled: false }, { status: "succeeded", endedAt: "2026-10-05" }).label, "Disabled");
  assert.equal(workerEvidence({ ...worker, health: "failed" }, { status: "succeeded", endedAt: "2026-10-05" }).tone, "warn");
  assert.equal(workerEvidence(worker, { status: "failed" }).label, "Recorded failure");
  assert.equal(workerEvidence(worker, { status: "running" }).label, "Last run marked running");
  assert.equal(workerEvidence(worker, { status: "succeeded" }).tone, "warn");
  assert.deepEqual(workerEvidence(worker, { status: "succeeded", endedAt: "2026-10-05" }), { label: "Last recorded run succeeded", tone: "good" });
});
