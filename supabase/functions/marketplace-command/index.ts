import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, requireIdempotencyKey, requireObject, requireString, safeError } from "../_shared/http.ts"
import { providerOnboardingArguments, confirmedProviderOnboarding } from "../_shared/provider-onboarding.mjs"

const requireRow = <T>(result: { data: T | null; error: { message: string } | null }): T => {
  const row = assertNoError(result)
  if (row == null) throw new Error("record_not_returned")
  return row
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    try {
      if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405)
      const body = await requireObject(request)
      const action = requireString(body.action, "action", 80)
      const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {}
      const requireRecentAuth = () => {
        const authTime = Number((ctx.userClaims as unknown as { auth_time?: unknown } | null)?.auth_time ?? 0)
        if (!authTime || Math.floor(Date.now() / 1000) - authTime > 600) throw new Error("recent_authentication_required")
      }

      if (action === "create_care_request") {
        const result = await ctx.supabase.rpc("create_care_request", { p_payload: payload })
        return json(assertNoError(result))
      }
      if (action === "activate_seller" || action === "submit_seller_application") {
        const args = providerOnboardingArguments(action, payload)
        const result = await ctx.supabase.rpc(action === "activate_seller" ? "activate_seller_profile" : "submit_seller_application", args)
        return json(confirmedProviderOnboarding(action, assertNoError(result), ctx.userClaims!.id))
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
          p_expected_fee_minor: payload.expected_fee_minor ?? null,
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
        requireString(payload.sender_nonce, "sender_nonce", 100)
        const senderNonce = payload.sender_nonce as string
        requireString(payload.body, "message", 4000)
        if (payload.message_type !== undefined && payload.message_type !== "text") throw new Error("message_attachments_not_supported")
        // Preserve the exact draft shared with the ordinary browser insert path.
        const body = payload.body as string
        const inserted = await ctx.supabase.from("messages").insert({
          conversation_id: conversationId, sender_id: ctx.userClaims!.id, body,
          message_type: "text", sender_nonce: senderNonce,
        }).select("id,created_at").single()
        if (inserted.error) {
          // A committed send may have lost its HTTP response. Recover only the
          // same visible message through caller RLS, never a privileged lookup.
          const existing = await ctx.supabase.from("messages").select("id,created_at,conversation_id,body,message_type")
            .eq("sender_id", ctx.userClaims!.id).eq("sender_nonce", senderNonce).maybeSingle()
          if (!existing.error && existing.data?.conversation_id === conversationId && existing.data.body === body && existing.data.message_type === "text") {
            return json({ ok: true, message: { id: existing.data.id, created_at: existing.data.created_at }, replayed: true })
          }
        }
        const message = requireRow(inserted)
        // The database trigger owns monotonic last-message time and exactly one
        // preference/mute-aware notification transaction. Do not enqueue again.
        return json({ ok: true, message })
      }
      if (action === "mark_conversation_read") {
        const conversationId = requireString(payload.conversation_id, "conversation_id", 36)
        const messageId = requireString(payload.message_id, "message_id", 36)
        const receipt = assertNoError(await ctx.supabase.rpc("mark_conversation_read_through", {
          p_conversation_id: conversationId, p_message_id: messageId,
        }))
        if (!receipt || receipt.ok !== true || typeof receipt.read_through !== "string") throw new Error("read_receipt_not_confirmed")
        return json(receipt)
      }
      if (action === "toggle_favorite") {
        const sellerId = requireString(payload.seller_id, "seller_id", 36)
        if (typeof payload.favorite !== "boolean") throw new Error("favorite_choice_required")
        return json(assertNoError(await ctx.supabase.rpc("set_provider_favorite", { p_seller_id: sellerId, p_favorite: payload.favorite })))
      }
      if (action === "request_data_export" || action === "request_account_deletion") {
        requireRecentAuth()
        const requestType = action === "request_data_export" ? "export" : "delete"
        const inserted = await ctx.supabase.from("privacy_requests").insert({ user_id: ctx.userClaims!.id, request_type: requestType, due_at: new Date(Date.now() + 30 * 86400_000).toISOString() }).select("id").single()
        return json({ ok: true, request_id: requireRow(inserted).id })
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
        return json({ ok: true, incident_id: requireRow(inserted).id, emergency_guidance: "Nanas is not an emergency service. Contact local emergency services for urgent help." })
      }
      return json({ ok: false, error: "unknown_action" }, 404)
    } catch (error) { return safeError(error) }
  }),
}
