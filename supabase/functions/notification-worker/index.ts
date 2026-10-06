import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, safeError } from "../_shared/http.ts"
import { notificationDeepLink, notificationRecipientRole, unsupportedNotificationChannels } from "../_shared/notification-routing.mjs"

export default {
  fetch: withSupabase({ auth: ["publishable", "secret:nanas_workers"] }, async (_request, ctx) => {
    try {
      if (ctx.authMode !== "secret") return json({ ok: false, error: "secret_key_required" }, 403)
      const run = assertNoError(await ctx.supabaseAdmin.from("worker_runs").insert({ worker_key: "notification_dispatch" }).select("id").single())
      if (!run) throw new Error("worker_run_not_created")
      const now = new Date().toISOString()
      const queued = assertNoError(await ctx.supabaseAdmin.from("notification_outbox").select("*").in("status", ["queued","failed"]).lte("available_at", now).order("available_at").limit(50))
      let delivered = 0
      let failed = 0
      let processed = 0
      let suppressed = 0
      for (const item of queued ?? []) {
        const claimed = assertNoError(await ctx.supabaseAdmin.from("notification_outbox").update({ status: "processing", attempts: item.attempts + 1 }).eq("id", item.id).eq("attempts", item.attempts).in("status", ["queued","failed"]).select("id").maybeSingle())
        // Another worker may have claimed this item after the initial queue read.
        if (!claimed) continue
        processed++
        try {
          const preferenceResult = await ctx.supabaseAdmin.from("notification_preferences").select("in_app,push,email,sms").eq("user_id", item.recipient_id).eq("event_category", item.category).maybeSingle()
          const preference = assertNoError(preferenceResult) ?? { in_app: true, push: false, email: false, sms: false }
          const activeRoles = assertNoError(await ctx.supabaseAdmin.from("user_roles").select("role").eq("user_id", item.recipient_id).is("revoked_at", null))
          let contextualRole: string | null = null
          if (item.variables_redacted.conversation_id) {
            const membership = assertNoError(await ctx.supabaseAdmin.from("conversation_members").select("role").eq("conversation_id", item.variables_redacted.conversation_id).eq("user_id", item.recipient_id).maybeSingle())
            contextualRole = membership?.role ?? null
          } else if (item.variables_redacted.booking_id) {
            const booking = assertNoError(await ctx.supabaseAdmin.from("bookings").select("buyer_id,seller_id").eq("id", item.variables_redacted.booking_id).maybeSingle())
            contextualRole = booking?.buyer_id === item.recipient_id ? "buyer" : booking?.seller_id === item.recipient_id ? "seller" : null
          }
          const recipientRole = notificationRecipientRole((activeRoles ?? []).map((entry: { role: string }) => entry.role), item.template_key, contextualRole)
          const title = ({ booking: "Nanas booking update", messages: "New Nanas message", payments: "Nanas payment update", account: "Nanas account update" } as Record<string,string>)[item.category] ?? "Nanas update"
          // Reuse the outbox UUID so retrying after a partial failure cannot
          // duplicate the in-app notification or reset its existing read state.
          const notificationId = preference.in_app ? item.id : null
          if (notificationId) assertNoError(await ctx.supabaseAdmin.from("notifications").upsert({
            id: notificationId,
            recipient_id: item.recipient_id, event_type: item.template_key, category: item.category, title,
            body: humanBody(item.template_key), deep_link: notificationDeepLink(recipientRole, item.template_key, item.variables_redacted), related_type: relatedType(item.variables_redacted), related_id: relatedId(item.variables_redacted),
          }, { onConflict: "id", ignoreDuplicates: true }))
          if (notificationId) assertNoError(await ctx.supabaseAdmin.from("notification_deliveries").upsert({
            id: item.id, outbox_id: item.id, notification_id: notificationId,
            channel: "in_app", vendor: "nanas-in-app", status: "delivered", attempts: 1, delivered_at: now,
          }, { onConflict: "id", ignoreDuplicates: true }))
          // No external transport exists yet. Record unsupported channels as
          // suppressed, while allowing the real in-app delivery to complete.
          const unsupportedChannels = unsupportedNotificationChannels(preference)
          if (unsupportedChannels.length) {
            assertNoError(await ctx.supabaseAdmin.from("notification_deliveries").insert(unsupportedChannels.map((channel) => ({
              outbox_id: item.id, notification_id: notificationId, channel,
              vendor: "not-configured", status: "suppressed", attempts: item.attempts + 1,
              error_code: "adapter_not_configured",
            }))))
            suppressed += unsupportedChannels.length
          }
          assertNoError(await ctx.supabaseAdmin.from("notification_outbox").update({ status: notificationId ? "delivered" : "suppressed" }).eq("id", item.id))
          if (notificationId) delivered++
        } catch (error) {
          failed++
          const exhausted = item.attempts + 1 >= 5
          await ctx.supabaseAdmin.from("notification_outbox").update({ status: exhausted ? "dead_letter" : "failed", available_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** item.attempts) * 1000).toISOString() }).eq("id", item.id)
          if (exhausted) await ctx.supabaseAdmin.from("dead_letters").insert({ source_queue: "notification_outbox", message_ref: item.id, attempts: item.attempts + 1, last_error: error instanceof Error ? error.message.slice(0,500) : "unknown", payload_redacted: { template_key: item.template_key } })
        }
      }
      await ctx.supabaseAdmin.from("worker_runs").update({
        ended_at: new Date().toISOString(), status: failed ? "completed_with_errors" : "succeeded",
        processed_count: processed, error_summary: failed ? `${failed} notification item(s) failed` : null,
      }).eq("id", run.id)
      await ctx.supabaseAdmin.from("scheduled_workers").update({
        last_run_at: new Date().toISOString(), next_run_at: new Date(Date.now() + 60_000).toISOString(),
        health_status: failed ? "degraded" : "healthy",
      }).eq("key", "notification_dispatch")
      return json({ ok: true, processed, delivered, failed, suppressed })
    } catch (error) { return safeError(error) }
  }),
}

const humanBody = (key: string) => ({
  purchase_receipt: "A test purchase receipt is available in your payment records. No real money was charged.",
  quote_received: "You received a new quote for your care request.", booking_confirmed: "A Nanas care booking has been confirmed.",
  booking_status_changed: "The status of your care booking changed.", new_message: "You have a new secure message.",
  payment_captured: "Your simulated protected payment was recorded.", verification_decision: "Your provider verification has been updated.",
}[key] ?? "There is a new update in your Nanas account.")
const relatedType = (variables: Record<string, unknown>) => variables.booking_id ? "booking" : variables.request_id ? "booking_request" : variables.conversation_id ? "conversation" : null
const relatedId = (variables: Record<string, unknown>) => variables.booking_id ?? variables.request_id ?? variables.conversation_id ?? null
