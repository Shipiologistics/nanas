// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { assertNoError, json, requireObject, requireString, safeError } from "../_shared/http.ts"
import { adminMessageArguments, confirmedAdminMessagePage } from "../_shared/admin-message-page.mjs"

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    try {
      if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405)
      const body = await requireObject(request)
      const action = requireString(body.action, "action", 80)
      const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {}
      const permissionFor: Record<string, string> = {
        overview: "analytics.read", list_users: "users.read", list_kyc: "kyc.review", user_action: "users.enforce", kyc_review: "kyc.review",
        read_messages: "messages.read", list_disputes: "disputes.manage", resolve_dispute: "disputes.manage", list_moderation: "moderation.read",
        moderate_content: "moderation.manage", finance_overview: "finance.read", notification_health: "notifications.read", update_setting: "config.manage",
      }
      const needed = permissionFor[action]
      if (!needed) return json({ ok: false, error: "unknown_action" }, 404)
      const allowed = assertNoError(await ctx.supabase.rpc("admin_permission_allowed", { p_permission: needed }))
      if (allowed !== true) return json({ ok: false, error: "permission_denied" }, 403)

      if (action === "overview") return json({ ok: true, data: assertNoError(await ctx.supabase.from("admin_overview").select("*").single()) })
      if (action === "user_action") return json(assertNoError(await ctx.supabase.rpc("admin_user_action", {
        p_target_user_id: requireString(payload.user_id, "user_id", 36), p_action: requireString(payload.command, "command", 20),
        p_reason: requireString(payload.reason, "reason", 1000), p_until: typeof payload.until === "string" ? payload.until : null,
      })))
      if (action === "kyc_review") return json(assertNoError(await ctx.supabase.rpc("admin_review_verification", {
        p_case_id: requireString(payload.case_id, "case_id", 36), p_decision: requireString(payload.decision, "decision", 30), p_note: requireString(payload.note, "note", 2000),
      })))
      if (action === "read_messages") {
        const args=adminMessageArguments(payload)
        const result=assertNoError(await ctx.supabase.rpc("admin_conversation_message_page",args))
        // The database checks recent sign-in, both permissions, the live case
        // relationship and its audit write on every page, including direct RPCs.
        return json({ ok: true, data: confirmedAdminMessagePage(result,args) })
      }
      if (action === "list_users") {
        const query = ctx.supabase.from("profiles").select("id,display_name,account_status,last_active_at,created_at,seller_profiles(status,rating_average,completed_bookings)").order("created_at", { ascending: false }).limit(100)
        return json({ ok: true, data: assertNoError(await query) })
      }
      if (action === "list_kyc") {
        const query = ctx.supabase.from("verification_cases").select("id,seller_id,verification_type,status,initiated_at,decision_reason,seller_profiles(display_name,headline)").in("status", ["pending","needs_information"]).order("initiated_at").limit(100)
        return json({ ok: true, data: assertNoError(await query) })
      }
      if (action === "list_disputes") return json({ ok: true, data: assertNoError(await ctx.supabase.from("service_disputes").select("*,bookings(reference,buyer_id,seller_id,total_minor,currency)").not("status", "in", '(resolved,closed)').order("created_at").limit(100)) })
      if (action === "list_moderation") return json({ ok: true, data: assertNoError(await ctx.supabase.from("moderation_reports").select("*").not("status", "in", '(resolved,closed)').order("created_at").limit(100)) })
      if (action === "resolve_dispute") {
        const disputeId = requireString(payload.dispute_id, "dispute_id", 36)
        const resolution = requireString(payload.resolution_code, "resolution_code", 80)
        if (!["release_funds","full_refund","partial_refund","no_action","warning","escalate"].includes(resolution)) throw new Error("invalid_resolution_code")
        const note = requireString(payload.note, "note", 2000)
        if (note.length < 5) throw new Error("resolution_note_required")
        const refund = payload.refund_minor ?? null
        if (refund !== null && (typeof refund !== "number" || !Number.isSafeInteger(refund) || refund <= 0)) throw new Error("invalid_refund_amount")
        if (resolution === "partial_refund" && refund === null) throw new Error("partial_refund_amount_required")
        // The same caller-scoped transaction used by the UI owns eligibility,
        // settlement, replay, audit and notifications. Never update case flags
        // with the service role: doing so could close a case without its money.
        const result = assertNoError(await ctx.supabase.rpc("admin_resolve_service_dispute", {
          p_dispute_id: disputeId, p_resolution_code: resolution, p_note: note, p_refund_minor: refund,
        }))
        if (!result || result.ok !== true) throw new Error("invalid_dispute_resolution_response")
        return json(result)
      }
      if (action === "moderate_content") {
        const reportId = requireString(payload.report_id, "report_id", 36)
        const decision = requireString(payload.decision, "decision", 30)
        if (!["allow","limit","remove","warn","restrict","escalate"].includes(decision)) throw new Error("invalid_moderation_action")
        const reason = requireString(payload.reason_code, "reason_code", 80)
        if (reason.length < 2) throw new Error("invalid_reason_code")
        const publicNote = payload.public_note == null || payload.public_note === "" ? null : requireString(payload.public_note, "public_note", 1000)
        const privateNote = payload.private_note == null || payload.private_note === "" ? null : requireString(payload.private_note, "private_note", 2000)
        const expiresAt = payload.expires_at == null ? null : requireString(payload.expires_at, "expires_at", 64)
        if (expiresAt !== null && !Number.isFinite(Date.parse(expiresAt))) throw new Error("invalid_expires_at")
        // Derive the target from its stored report, never arbitrary client IDs.
        // Invalid input cannot write content before an audit reason is checked.
        const result = assertNoError(await ctx.supabase.rpc("admin_resolve_moderation_report", {
          p_report_id: reportId, p_action: decision, p_reason_code: reason,
          p_public_note: publicNote, p_private_note: privateNote, p_expires_at: expiresAt,
        }))
        if (!result || result.ok !== true) throw new Error("invalid_moderation_response")
        return json(result)
      }
      if (action === "finance_overview") {
        const [payments, payouts, refunds, balances] = await Promise.all([
          ctx.supabase.from("payment_intents").select("status,amount_minor,captured_minor,refunded_minor"), ctx.supabase.from("payouts").select("status,amount_minor"),
          ctx.supabase.from("refunds").select("status,amount_minor"), ctx.supabase.from("wallet_balances").select("account_type,currency,balance_minor"),
        ])
        return json({ ok: true, data: { payments: assertNoError(payments), payouts: assertNoError(payouts), refunds: assertNoError(refunds), balances: assertNoError(balances) } })
      }
      if (action === "notification_health") return json({ ok: true, data: assertNoError(await ctx.supabase.from("notification_outbox").select("status,attempts,available_at,created_at").order("created_at", { ascending: false }).limit(200)) })
      if (action === "update_setting") {
        const key = requireString(payload.key, "key", 80)
        const result=assertNoError(await ctx.supabase.rpc("admin_set_system_setting", {
          p_key:key,p_value:payload.value,p_reason:requireString(payload.reason,"reason",1000),
        }))
        if(!result || result.ok!==true || result.key!==key)throw new Error("setting_update_unconfirmed")
        return json(result)
      }
      return json({ ok: false, error: "unknown_action" }, 404)
    } catch (error) { return safeError(error) }
  }),
}
