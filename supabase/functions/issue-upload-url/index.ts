// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, requireObject, requireString, safeError } from "../_shared/http.ts"

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    try {
      if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405)
      const body = await requireObject(request)
      const bucket = requireString(body.bucket, "bucket", 40)
      const mime = requireString(body.mime_type, "mime_type", 100)
      const size = Number(body.size_bytes)
      const allowed: Record<string, { max: number; mimes: string[] }> = {
        "public-profile-media": { max: 5_242_880, mimes: ["image/jpeg","image/png","image/webp"] },
        "seller-documents": { max: 10_485_760, mimes: ["image/jpeg","image/png","application/pdf"] },
        "booking-attachments": { max: 20_971_520, mimes: ["image/jpeg","image/png","image/webp","application/pdf"] },
        "case-evidence": { max: 20_971_520, mimes: ["image/jpeg","image/png","image/webp","application/pdf"] },
      }
      const rule = allowed[bucket]
      if (!rule || !rule.mimes.includes(mime) || !Number.isFinite(size) || size < 1 || size > rule.max) throw new Error("upload_not_allowed")
      const userId = ctx.userClaims!.id
      let prefix = userId
      if (bucket === "booking-attachments") {
        const bookingId = requireString(body.entity_id, "entity_id", 36)
        assertNoError(await ctx.supabase.from("bookings").select("id").eq("id", bookingId).single())
        prefix = `${bookingId}/${userId}`
      } else if (bucket === "case-evidence") {
        const disputeId = requireString(body.entity_id, "entity_id", 36)
        assertNoError(await ctx.supabase.from("service_disputes").select("id").eq("id", disputeId).single())
        prefix = `${disputeId}/${userId}`
      }
      const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as Record<string,string>)[mime]
      const path = `${prefix}/${crypto.randomUUID()}.${extension}`
      const signed = await ctx.supabase.storage.from(bucket).createSignedUploadUrl(path)
      const data = assertNoError(signed)
      return json({ ok: true, bucket, path, token: data.token, signed_url: data.signedUrl, expires_in_seconds: 120 })
    } catch (error) { return safeError(error) }
  }),
}
