// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, safeError, verifyHmac } from "../_shared/http.ts"

export default {
  fetch: withSupabase({ auth: "none" }, async (request, ctx) => {
    try {
      const verified = await verifyHmac(request, Deno.env.get("DELIVERY_WEBHOOK_SECRET") ?? "")
      if (!verified.ok) return json({ ok: false, error: "invalid_signature" }, 401)
      const event = JSON.parse(verified.body)
      if (!event.external_id || !["delivered","failed","suppressed"].includes(event.status)) throw new Error("invalid_event")
      const values = { status: event.status, delivered_at: event.status === "delivered" ? new Date().toISOString() : null, failed_at: event.status === "failed" ? new Date().toISOString() : null, error_code: event.error_code ?? null }
      assertNoError(await ctx.supabaseAdmin.from("notification_deliveries").update(values).eq("external_id", event.external_id))
      return json({ ok: true })
    } catch (error) { return safeError(error) }
  }),
}
