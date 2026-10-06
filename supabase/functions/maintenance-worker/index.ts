import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, safeError } from "../_shared/http.ts"
import { bahamasDate } from "../_shared/business-date.mjs"
import { validateBadgePage } from "../_shared/badge-page.mjs"

const requireData = <T>(result: { data: T; error: { message: string } | null }): NonNullable<T> => {
  const data = assertNoError(result)
  if (data == null) throw new Error("worker_response_missing")
  return data
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret:nanas_workers"] }, async (request, ctx) => {
    let runId: string | null = null
    let workerKey = "maintenance"
    const counts: Record<string,number> = {}
    try {
      if (ctx.authMode !== "secret") return json({ ok: false, error: "secret_key_required" }, 403)
      const requested = request.headers.get("content-type")?.includes("application/json") ? (await request.json()).action ?? "all" : "all"
      const allowed = new Set(["all","expire_offers","auto_complete","publish_reviews","expire_credentials","evaluate_badges","reminders","purge","analytics"])
      if (!allowed.has(requested)) return json({ ok: false, error: "unknown_worker" }, 404)
      workerKey = requested === "all" ? "maintenance" : requested
      const run = requireData(await ctx.supabaseAdmin.from("worker_runs").insert({ worker_key: workerKey }).select("id").single())
      runId = run.id
      if (requested === "all" || requested === "expire_offers") {
        const offers = requireData(await ctx.supabaseAdmin.from("booking_offers").update({ status: "expired" }).in("status", ["queued","sent","viewed"]).lt("expires_at", new Date().toISOString()).select("id"))
        const requests = requireData(await ctx.supabaseAdmin.from("booking_requests").update({ status: "expired" }).in("status", ["requested","offered"]).lt("expires_at", new Date().toISOString()).select("id"))
        counts.expired = offers.length + requests.length
      }
      if (requested === "all" || requested === "auto_complete") {
        const result = requireData(await ctx.supabaseAdmin.rpc("auto_complete_bookings", { p_limit: 100 }))
        if (typeof result.ok !== "boolean" || !Number.isSafeInteger(result.completed) || result.completed < 0 || !Array.isArray(result.failures)) throw new Error("invalid_completion_response")
        counts.completed = result.completed
        if (!result.ok || result.failures.length) throw new Error("auto_completion_failed: inspect pending bookings and protected funds")
      }
      if (requested === "all" || requested === "publish_reviews") {
        counts.reviews_published = assertNoError(await ctx.supabaseAdmin.rpc("publish_due_reviews", { p_limit: 100 }))
      }
      if (requested === "all" || requested === "expire_credentials") {
        const today = bahamasDate(new Date())
        const [docs, credentials] = await Promise.all([
          // Undecided evidence must remain reviewable, even when its stated
          // expiry has passed. Reviewers can reject it or request replacement.
          ctx.supabaseAdmin.from("seller_documents").update({ status: "expired" }).eq("status", "approved").lt("expiry_date", today).select("id,seller_id"),
          ctx.supabaseAdmin.from("seller_credentials").update({ status: "expired" }).eq("status", "approved").lt("expiry_date", today).select("id,seller_id"),
        ])
        // These are separate idempotent writes. Preserve evidence of a committed
        // half-batch even when the other table fails; never mark it healthy.
        counts.credentials_expired = [docs,credentials].reduce((total,result)=>
          total + (!result.error && Array.isArray(result.data) ? result.data.length : 0),0)
        if (!Array.isArray(requireData(docs)) || !Array.isArray(requireData(credentials))) throw new Error("invalid_expiry_response")
      }
      if (requested === "all" || requested === "evaluate_badges") {
        let cursor: string | null = null
        counts.badges_evaluated = 0
        counts.badges_awarded = 0
        counts.badges_revoked = 0
        do {
          const result = requireData(await ctx.supabaseAdmin.rpc("evaluate_provider_badges", { p_after: cursor, p_limit: 100 }))
          const next = validateBadgePage(result,cursor)
          counts.badges_evaluated += result.evaluated
          counts.badges_awarded += result.awarded
          counts.badges_revoked += result.revoked
          cursor = next
        } while (cursor !== null)
      }
      if (requested === "all" || requested === "reminders") {
        const windowStart = new Date(Date.now() + 23 * 3600_000).toISOString(), windowEnd = new Date(Date.now() + 25 * 3600_000).toISOString()
        const bookings = requireData(await ctx.supabaseAdmin.from("bookings").select("id,buyer_id,seller_id").eq("status", "confirmed").gte("scheduled_start", windowStart).lte("scheduled_start", windowEnd))
        const rows = bookings.flatMap((b) => [b.buyer_id,b.seller_id].map((recipient) => ({ recipient_id: recipient, template_key: "booking_reminder_24h", category: "booking", priority: "normal", variables_redacted: { booking_id: b.id }, dedupe_key: `reminder24:${b.id}:${recipient}` })))
        if (rows.length) assertNoError(await ctx.supabaseAdmin.from("notification_outbox").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true }))
        counts.reminders = rows.length
      }
      if (requested === "all" || requested === "purge") {
        const purged = requireData(await ctx.supabaseAdmin.from("booking_location_samples").delete().lt("purge_at", new Date().toISOString()).select("id"))
        assertNoError(await ctx.supabaseAdmin.from("devices").update({ revoked_at: new Date().toISOString() }).is("revoked_at", null).lt("last_seen_at", new Date(Date.now() - 180 * 86400_000).toISOString()))
        assertNoError(await ctx.supabaseAdmin.from("idempotency_keys").delete().lt("expires_at", new Date().toISOString()))
        counts.location_samples_purged = purged.length
      }
      if (requested === "all" || requested === "analytics") {
        const today = new Date().toISOString().slice(0,10)
        const result = await ctx.supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed")
        assertNoError(result)
        assertNoError(await ctx.supabaseAdmin.from("analytics_daily").upsert({ metric_date: today, metric_key: "completed_bookings_total", metric_count: result.count ?? 0 }, { onConflict: "metric_date,service_id,service_area_id,metric_key" }))
        counts.analytics = 1
      }
      assertNoError(await ctx.supabaseAdmin.from("worker_runs").update({ ended_at: new Date().toISOString(), status: "succeeded", processed_count: Object.values(counts).reduce((a,b) => a+b,0) }).eq("id", run.id))
      assertNoError(await ctx.supabaseAdmin.from("scheduled_workers").update({
        last_run_at: new Date().toISOString(), health_status: "healthy",
      }).eq("key", workerKey))
      return json({ ok: true, counts })
    } catch (error) {
      if (runId) {
        const summary = error instanceof Error ? error.message.slice(0,160) : "maintenance_failed"
        // A failed RPC or partial batch is never reported as a healthy run.
        await ctx.supabaseAdmin.from("worker_runs").update({ ended_at: new Date().toISOString(), status: "failed", error_summary: summary, processed_count: Object.values(counts).reduce((a,b) => a+b,0) }).eq("id", runId)
        await ctx.supabaseAdmin.from("scheduled_workers").update({ last_run_at: new Date().toISOString(), health_status: "failed" }).eq("key", workerKey)
      }
      return safeError(error)
    }
  }),
}
