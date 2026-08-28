import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, safeError, verifyHmac } from "../_shared/http.ts"

export default {
  fetch: withSupabase({ auth: "none" }, async (request, ctx) => {
    try {
      const verified = await verifyHmac(request, Deno.env.get("PAYMENT_WEBHOOK_SECRET") ?? "")
      if (!verified.ok) return json({ ok: false, error: "invalid_signature" }, 401)
      const event = JSON.parse(verified.body)
      const eventId = String(event.id ?? "")
      if (!eventId || !event.type) throw new Error("invalid_event")
      const persisted = await ctx.supabaseAdmin.from("payment_events").upsert({ processor: event.processor ?? "simulation", external_event_id: eventId, event_type: event.type, payload_redacted: { payment_intent_id: event.payment_intent_id, status: event.status, amount_minor: event.amount_minor }, signature_verified: true }, { onConflict: "processor,external_event_id", ignoreDuplicates: true }).select("id").maybeSingle()
      if (persisted.error) throw new Error(persisted.error.message)
      if (event.payment_intent_id && event.status) assertNoError(await ctx.supabaseAdmin.from("payment_intents").update({ status: event.status, updated_at: new Date().toISOString() }).eq("id", event.payment_intent_id))
      await ctx.supabaseAdmin.from("payment_events").update({ processed_at: new Date().toISOString() }).eq("processor", event.processor ?? "simulation").eq("external_event_id", eventId)
      return json({ ok: true })
    } catch (error) { return safeError(error) }
  }),
}
