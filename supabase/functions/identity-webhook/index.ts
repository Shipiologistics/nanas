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
      const verified = await verifyHmac(request, Deno.env.get("IDENTITY_WEBHOOK_SECRET") ?? "")
      if (!verified.ok) return json({ ok: false, error: "invalid_signature" }, 401)
      const event = JSON.parse(verified.body)
      const status = ["approved","rejected","needs_information"].includes(event.status) ? event.status : "pending"
      assertNoError(await ctx.supabaseAdmin.from("verification_cases").update({ status, result_summary: String(event.summary ?? "").slice(0,1000), decided_at: status === "pending" ? null : new Date().toISOString() }).eq("external_ref", String(event.case_ref)))
      return json({ ok: true })
    } catch (error) { return safeError(error) }
  }),
}
