import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, requireIdempotencyKey, requireObject, requireString, safeError } from "../_shared/http.ts"

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    try {
      if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405)
      const body = await requireObject(request)
      const action = requireString(body.action, "action", 80)
      const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {}
      const requireRecentAuth = () => {
        const authTime = Number((ctx.userClaims as Record<string, unknown>).auth_time ?? 0)
        if (!authTime || Math.floor(Date.now() / 1000) - authTime > 600) throw new Error("recent_authentication_required")
      }

      if (action === "create_care_request") {
        const result = await ctx.supabase.rpc("create_care_request", { p_payload: payload })
        return json(assertNoError(result))
      }
      if (action === "activate_seller") {
        const result = await ctx.supabase.rpc("activate_seller_profile", { p_display_name: requireString(payload.display_name, "display_name", 80) })
        return json(assertNoError(result))
      }
      if (action === "submit_seller_application") {
        const sellerId = ctx.userClaims!.id
        const activated = await ctx.supabase.rpc("activate_seller_profile", { p_display_name: requireString(payload.display_name, "display_name", 80) })
        assertNoError(activated)
        assertNoError(await ctx.supabase.from("seller_profiles").update({
          headline: requireString(payload.headline, "headline", 120),
          bio: requireString(payload.bio, "bio", 2000),
          years_experience: Number(payload.years_experience ?? 0),
          status: "under_review",
        }).eq("user_id", sellerId))
        const verification = await ctx.supabase.from("verification_cases").insert({ seller_id: sellerId, verification_type: "seller_onboarding", vendor: "manual", status: "pending" }).select("id").single()
        return json({ ok: true, verification_case_id: assertNoError(verification).id, status: "under_review" })
      }
      if (action === "submit_quote") {
        const result = await ctx.supabase.rpc("submit_seller_quote", {
          p_request_id: requireString(payload.request_id, "request_id", 36),
          p_rate_minor: Number(payload.rate_minor), p_travel_minor: Number(payload.travel_minor ?? 0),
          p_message: typeof payload.message === "string" ? payload.message : null,
          p_expires_at: typeof payload.expires_at === "string" ? payload.expires_at : new Date(Date.now() + 48 * 3600_000).toISOString(),
        })
        return json(assertNoError(result))
      }
      if (action === "accept_quote") {
        const key = requireIdempotencyKey(request)
        const result = await ctx.supabase.rpc("accept_quote_with_simulated_payment", { p_quote_id: requireString(payload.quote_id, "quote_id", 36), p_idempotency_key: key })
        return json(assertNoError(result))
      }
      if (action === "transition_booking") {
        const key = requireIdempotencyKey(request)
        const result = await ctx.supabase.rpc("transition_booking", {
          p_booking_id: requireString(payload.booking_id, "booking_id", 36), p_target: requireString(payload.target, "target", 40),
          p_reason: typeof payload.reason === "string" ? payload.reason : null, p_idempotency_key: key,
        })
        return json(assertNoError(result))
      }
      if (action === "preview_cancellation") {
        return json(assertNoError(await ctx.supabase.rpc("preview_booking_cancellation", {
          p_booking_id: requireString(payload.booking_id, "booking_id", 36),
        })))
      }
      if (action === "cancel_booking") {
        const key = requireIdempotencyKey(request)
        return json(assertNoError(await ctx.supabase.rpc("cancel_booking", {
          p_booking_id: requireString(payload.booking_id, "booking_id", 36),
          p_reason_code: requireString(payload.reason_code, "reason_code", 80),
          p_idempotency_key: key,
        })))
      }
      if (action === "submit_review") {
        const result = await ctx.supabase.rpc("submit_verified_review", {
          p_booking_id: requireString(payload.booking_id, "booking_id", 36), p_rating: Number(payload.rating), p_body: typeof payload.body === "string" ? payload.body : "",
        })
        return json(assertNoError(result))
      }
      if (action === "send_message") {
        const conversationId = requireString(payload.conversation_id, "conversation_id", 36)
        const inserted = await ctx.supabase.from("messages").insert({
          conversation_id: conversationId, sender_id: ctx.userClaims!.id, body: requireString(payload.body, "message", 4000),
          message_type: payload.message_type === "file" || payload.message_type === "image" ? payload.message_type : "text",
          sender_nonce: requireString(payload.sender_nonce, "sender_nonce", 100),
        }).select("id,created_at").single()
        const message = assertNoError(inserted)
        await ctx.supabaseAdmin.from("conversations").update({ last_message_at: message.created_at }).eq("id", conversationId)
        const { data: recipients } = await ctx.supabaseAdmin.from("conversation_members").select("user_id").eq("conversation_id", conversationId).neq("user_id", ctx.userClaims!.id).is("left_at", null)
        if (recipients?.length) await ctx.supabaseAdmin.from("notification_outbox").upsert(recipients.map((r) => ({ recipient_id: r.user_id, template_key: "new_message", category: "messages", variables_redacted: { conversation_id: conversationId }, dedupe_key: `message:${message.id}:${r.user_id}` })), { onConflict: "dedupe_key" })
        return json({ ok: true, message })
      }
      if (action === "mark_conversation_read") {
        const conversationId = requireString(payload.conversation_id, "conversation_id", 36)
        const member = await ctx.supabase.from("conversation_members").select("user_id").eq("conversation_id", conversationId).eq("user_id", ctx.userClaims!.id).single()
        assertNoError(member)
        await ctx.supabaseAdmin.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", ctx.userClaims!.id)
        return json({ ok: true })
      }
      if (action === "toggle_favorite") {
        const sellerId = requireString(payload.seller_id, "seller_id", 36)
        if (payload.favorite === false) assertNoError(await ctx.supabase.from("favorites").delete().eq("seller_id", sellerId))
        else assertNoError(await ctx.supabase.from("favorites").upsert({ buyer_id: ctx.userClaims!.id, seller_id: sellerId }))
        return json({ ok: true, favorite: payload.favorite !== false })
      }
      if (action === "request_data_export" || action === "request_account_deletion") {
        requireRecentAuth()
        const requestType = action === "request_data_export" ? "export" : "delete"
        const inserted = await ctx.supabase.from("privacy_requests").insert({ user_id: ctx.userClaims!.id, request_type: requestType, due_at: new Date(Date.now() + 30 * 86400_000).toISOString() }).select("id").single()
        return json({ ok: true, request_id: assertNoError(inserted).id })
      }
      if (action === "open_dispute") {
        requireIdempotencyKey(request)
        const result = await ctx.supabase.rpc("open_service_dispute", {
          p_booking_id: requireString(payload.booking_id, "booking_id", 36),
          p_reason_code: requireString(payload.reason_code, "reason_code", 80),
          p_summary: requireString(payload.summary, "summary", 3000),
        })
        return json(assertNoError(result))
      }
      if (action === "create_support_case") {
        const result = await ctx.supabase.rpc("create_support_case", {
          p_case_type: requireString(payload.case_type, "case_type", 30),
          p_subject: requireString(payload.subject, "subject", 160),
          p_details: requireString(payload.details, "details", 4000),
          p_booking_id: typeof payload.booking_id === "string" ? payload.booking_id : null,
        })
        return json(assertNoError(result))
      }
      if (action === "generate_session_code") {
        requireIdempotencyKey(request)
        return json(assertNoError(await ctx.supabase.rpc("generate_session_code", { p_booking_id: requireString(payload.booking_id, "booking_id", 36) })))
      }
      if (action === "verify_session_code") {
        requireIdempotencyKey(request)
        return json(assertNoError(await ctx.supabase.rpc("verify_session_code", {
          p_booking_id: requireString(payload.booking_id, "booking_id", 36), p_code: requireString(payload.code, "code", 6),
        })))
      }
      if (action === "trigger_safety_alert") {
        const inserted = await ctx.supabase.from("safety_incidents").insert({
          booking_id: payload.booking_id ?? null, reporter_id: ctx.userClaims!.id, category: requireString(payload.category, "category", 80), severity: "urgent",
        }).select("id").single()
        return json({ ok: true, incident_id: assertNoError(inserted).id, emergency_guidance: "Nanas is not an emergency service. Contact local emergency services for urgent help." })
      }
      return json({ ok: false, error: "unknown_action" }, 404)
    } catch (error) { return safeError(error) }
  }),
}
