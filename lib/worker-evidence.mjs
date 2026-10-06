/**
 * Describe recorded evidence, never infer deployment from an enabled registry row.
 * @param {{enabled:boolean, health:string, lastRunAt?:string}} worker
 * @param {{status:string, endedAt?:string}|undefined} run Latest available run for this worker.
 */
export function workerEvidence(worker, run) {
  if (!worker.enabled) return { label: "Disabled", tone: "warn" };
  if (worker.health === "failed" || run?.status === "failed") return { label: "Recorded failure", tone: "warn" };
  if (!run) return { label: worker.lastRunAt ? "Run history unavailable" : "No recorded runs", tone: "warn" };
  if (run.status === "succeeded" && run.endedAt) return { label: "Last recorded run succeeded", tone: "good" };
  if (run.status === "running") return { label: "Last run marked running", tone: "warn" };
  return { label: "Run result unverified", tone: "warn" };
}
