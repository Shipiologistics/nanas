import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, safeError } from "../_shared/http.ts"

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (request, ctx) => {
    try {
      if (ctx.authMode !== "secret") return json({ ok: false, error: "secret_key_required" }, 403)
      const requested = request.headers.get("content-type")?.includes("application/json") ? (await request.json()).action ?? "all" : "all"
      const allowed = new Set(["all","expire_offers","auto_complete","publish_reviews","expire_credentials","evaluate_badges","reminders","purge","analytics"])
      if (!allowed.has(requested)) return json({ ok: false, error: "unknown_worker" }, 404)
      const run = assertNoError(await ctx.supabaseAdmin.from("worker_runs").insert({ worker_key: requested === "all" ? "maintenance" : requested }).select("id").single())
      const counts: Record<string,number> = {}
      if (requested === "all" || requested === "expire_offers") {
        const offers = assertNoError(await ctx.supabaseAdmin.from("booking_offers").update({ status: "expired" }).in("status", ["queued","sent","viewed"]).lt("expires_at", new Date().toISOString()).select("id"))
        const requests = assertNoError(await ctx.supabaseAdmin.from("booking_requests").update({ status: "expired" }).in("status", ["requested","offered"]).lt("expires_at", new Date().toISOString()).select("id"))
        counts.expired = offers.length + requests.length
      }
      if (requested === "all" || requested === "auto_complete") {
        const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString()
        const candidates = assertNoError(await ctx.supabaseAdmin.from("bookings").select("id,buyer_id,seller_id,status").eq("status", "completion_pending").lt("ended_at", cutoff).limit(100))
        let completed = 0
        for (const booking of candidates) {
          const { count } = await ctx.supabaseAdmin.from("service_disputes").select("id", { count: "exact", head: true }).eq("booking_id", booking.id).not("status", "in", '(resolved,closed)')
          if (count) continue
          await ctx.supabaseAdmin.from("bookings").update({ status: "completed", blocks_calendar: false, completed_at: new Date().toISOString() }).eq("id", booking.id).eq("status", "completion_pending")
          await ctx.supabaseAdmin.from("booking_status_history").insert({ booking_id: booking.id, from_status: "completion_pending", to_status: "completed", reason_code: "auto_complete", source: "maintenance" })
          completed++
        }
        counts.completed = completed
      }
      if (requested === "all" || requested === "publish_reviews") {
        const published = assertNoError(await ctx.supabaseAdmin.from("reviews").update({ status: "published", published_at: new Date().toISOString() }).eq("status", "pending_peer").lt("submitted_at", new Date(Date.now() - 7 * 86400_000).toISOString()).select("id"))
        counts.reviews_published = published.length
      }
      if (requested === "all" || requested === "expire_credentials") {
        const [docs, credentials] = await Promise.all([
          ctx.supabaseAdmin.from("seller_documents").update({ status: "expired" }).in("status", ["approved","pending"]).lt("expiry_date", new Date().toISOString().slice(0,10)).select("id,seller_id"),
          ctx.supabaseAdmin.from("seller_credentials").update({ status: "expired" }).eq("status", "approved").lt("expiry_date", new Date().toISOString().slice(0,10)).select("id,seller_id"),
        ])
        counts.credentials_expired = assertNoError(docs).length + assertNoError(credentials).length
      }
      if (requested === "all" || requested === "evaluate_badges") {
        const sellers = assertNoError(await ctx.supabaseAdmin.from("seller_profiles").select("user_id,status,rating_average,rating_count,completed_bookings,response_rate"))
        const badges = assertNoError(await ctx.supabaseAdmin.from("badges").select("id,code,rule_version"))
        const byCode = Object.fromEntries(badges.map((b) => [b.code,b]))
        let awarded = 0, evaluated = 0
        for (const seller of sellers) {
          const codes = [seller.status === "approved" && "identity_verified", seller.rating_count >= 10 && seller.rating_average >= 4.8 && "highly_rated", seller.response_rate >= 90 && "reliable_responder", seller.completed_bookings >= 25 && "experienced_seller"].filter(Boolean) as string[]
          const metrics = { rating: seller.rating_average, reviews: seller.rating_count, completed: seller.completed_bookings, response_rate: seller.response_rate, seller_status: seller.status }
          if (badges.length) {
            assertNoError(await ctx.supabaseAdmin.from("badge_evaluation_runs").insert(badges.map((badge) => ({
              badge_id: badge.id, rule_version: badge.rule_version, user_id: seller.user_id,
              metrics_snapshot: metrics, result: codes.includes(badge.code),
              result_reason: codes.includes(badge.code) ? "rule_requirements_met" : "rule_requirements_not_met",
            }))))
            evaluated += badges.length
          }
          for (const code of codes) {
            const badge = byCode[code]; if (!badge) continue
            const result = await ctx.supabaseAdmin.from("user_badges").upsert({ user_id: seller.user_id, badge_id: badge.id, source_type: "rule", source_id: seller.user_id, rule_version: badge.rule_version, metric_snapshot: metrics }, { onConflict: "user_id,badge_id,source_type,source_id", ignoreDuplicates: true })
            if (!result.error) awarded++
          }
        }
        counts.badges_evaluated = evaluated
        counts.badges_awarded = awarded
      }
      if (requested === "all" || requested === "reminders") {
        const windowStart = new Date(Date.now() + 23 * 3600_000).toISOString(), windowEnd = new Date(Date.now() + 25 * 3600_000).toISOString()
        const bookings = assertNoError(await ctx.supabaseAdmin.from("bookings").select("id,buyer_id,seller_id").eq("status", "confirmed").gte("scheduled_start", windowStart).lte("scheduled_start", windowEnd))
        const rows = bookings.flatMap((b) => [b.buyer_id,b.seller_id].map((recipient) => ({ recipient_id: recipient, template_key: "booking_reminder_24h", category: "booking", priority: "normal", variables_redacted: { booking_id: b.id }, dedupe_key: `reminder24:${b.id}:${recipient}` })))
        if (rows.length) await ctx.supabaseAdmin.from("notification_outbox").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
        counts.reminders = rows.length
      }
      if (requested === "all" || requested === "purge") {
        const purged = assertNoError(await ctx.supabaseAdmin.from("booking_location_samples").delete().lt("purge_at", new Date().toISOString()).select("id"))
        await ctx.supabaseAdmin.from("devices").update({ revoked_at: new Date().toISOString() }).is("revoked_at", null).lt("last_seen_at", new Date(Date.now() - 180 * 86400_000).toISOString())
        await ctx.supabaseAdmin.from("idempotency_keys").delete().lt("expires_at", new Date().toISOString())
        counts.location_samples_purged = purged.length
      }
      if (requested === "all" || requested === "analytics") {
        const today = new Date().toISOString().slice(0,10)
        const { count: completed } = await ctx.supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed")
        await ctx.supabaseAdmin.from("analytics_daily").upsert({ metric_date: today, metric_key: "completed_bookings_total", metric_count: completed ?? 0 }, { onConflict: "metric_date,service_id,service_area_id,metric_key" })
        counts.analytics = 1
      }
      await ctx.supabaseAdmin.from("worker_runs").update({ ended_at: new Date().toISOString(), status: "succeeded", processed_count: Object.values(counts).reduce((a,b) => a+b,0) }).eq("id", run.id)
      await ctx.supabaseAdmin.from("scheduled_workers").update({
        last_run_at: new Date().toISOString(), health_status: "healthy",
      }).eq("key", requested === "all" ? "maintenance" : requested)
      return json({ ok: true, counts })
    } catch (error) { return safeError(error) }
  }),
}
