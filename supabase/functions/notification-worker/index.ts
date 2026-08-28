import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, safeError } from "../_shared/http.ts"

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (_request, ctx) => {
    try {
      if (ctx.authMode !== "secret") return json({ ok: false, error: "secret_key_required" }, 403)
      const run = assertNoError(await ctx.supabaseAdmin.from("worker_runs").insert({ worker_key: "notification_dispatch" }).select("id").single())
      const now = new Date().toISOString()
      const queued = assertNoError(await ctx.supabaseAdmin.from("notification_outbox").select("*").in("status", ["queued","failed"]).lte("available_at", now).order("available_at").limit(50))
      let delivered = 0
      let failed = 0
      for (const item of queued) {
        await ctx.supabaseAdmin.from("notification_outbox").update({ status: "processing", attempts: item.attempts + 1 }).eq("id", item.id).in("status", ["queued","failed"])
        try {
          const preferenceResult = await ctx.supabaseAdmin.from("notification_preferences").select("in_app,push,email,sms").eq("user_id", item.recipient_id).eq("event_category", item.category).maybeSingle()
          const preference = preferenceResult.data ?? { in_app: true, push: true, email: true, sms: false }
          const title = ({ booking: "Nanas booking update", messages: "New Nanas message", payments: "Nanas payment update", account: "Nanas account update" } as Record<string,string>)[item.category] ?? "Nanas update"
          const notification = assertNoError(await ctx.supabaseAdmin.from("notifications").insert({
            recipient_id: item.recipient_id, event_type: item.template_key, category: item.category, title,
            body: humanBody(item.template_key), deep_link: deepLink(item.variables_redacted), related_type: relatedType(item.variables_redacted), related_id: relatedId(item.variables_redacted),
          }).select("id").single())
          const channels = (["in_app","push","email","sms"] as const).filter((channel) => preference[channel])
          if (channels.length) assertNoError(await ctx.supabaseAdmin.from("notification_deliveries").insert(channels.map((channel) => ({
            outbox_id: item.id, notification_id: notification.id, channel, vendor: "local-simulation", status: "delivered", attempts: 1, delivered_at: now,
          }))))
          await ctx.supabaseAdmin.from("notification_outbox").update({ status: "delivered" }).eq("id", item.id)
          delivered++
        } catch (error) {
          failed++
          const exhausted = item.attempts + 1 >= 5
          await ctx.supabaseAdmin.from("notification_outbox").update({ status: exhausted ? "dead_letter" : "failed", available_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** item.attempts) * 1000).toISOString() }).eq("id", item.id)
          if (exhausted) await ctx.supabaseAdmin.from("dead_letters").insert({ source_queue: "notification_outbox", message_ref: item.id, attempts: item.attempts + 1, last_error: error instanceof Error ? error.message.slice(0,500) : "unknown", payload_redacted: { template_key: item.template_key } })
        }
      }
      await ctx.supabaseAdmin.from("worker_runs").update({
        ended_at: new Date().toISOString(), status: failed ? "completed_with_errors" : "succeeded",
        processed_count: queued.length, error_summary: failed ? `${failed} notification item(s) failed` : null,
      }).eq("id", run.id)
      await ctx.supabaseAdmin.from("scheduled_workers").update({
        last_run_at: new Date().toISOString(), next_run_at: new Date(Date.now() + 60_000).toISOString(),
        health_status: failed ? "degraded" : "healthy",
      }).eq("key", "notification_dispatch")
      return json({ ok: true, processed: queued.length, delivered, failed })
    } catch (error) { return safeError(error) }
  }),
}

const humanBody = (key: string) => ({
  quote_received: "You received a new quote for your care request.", booking_confirmed: "A Nanas care booking has been confirmed.",
  booking_status_changed: "The status of your care booking changed.", new_message: "You have a new secure message.",
  payment_captured: "Your simulated protected payment was recorded.", verification_decision: "Your seller verification has been updated.",
}[key] ?? "There is a new update in your Nanas account.")
const deepLink = (variables: Record<string, unknown>) => variables.booking_id ? `/app/bookings/${variables.booking_id}` : variables.conversation_id ? `/app/messages/${variables.conversation_id}` : "/app/notifications"
const relatedType = (variables: Record<string, unknown>) => variables.booking_id ? "booking" : variables.request_id ? "booking_request" : variables.conversation_id ? "conversation" : null
const relatedId = (variables: Record<string, unknown>) => variables.booking_id ?? variables.request_id ?? variables.conversation_id ?? null
