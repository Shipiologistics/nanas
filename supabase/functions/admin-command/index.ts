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
      const action = requireString(body.action, "action", 80)
      const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {}
      const requireRecentAuth = () => {
        const authTime = Number((ctx.userClaims as Record<string, unknown>).auth_time ?? 0)
        if (!authTime || Math.floor(Date.now() / 1000) - authTime > 600) throw new Error("recent_authentication_required")
      }
      const permissionFor: Record<string, string> = {
        overview: "analytics.read", list_users: "users.read", list_kyc: "kyc.review", user_action: "users.enforce", kyc_review: "kyc.review",
        read_messages: "messages.read", list_disputes: "disputes.manage", resolve_dispute: "disputes.manage", list_moderation: "moderation.read",
        moderate_content: "moderation.manage", finance_overview: "finance.read", notification_health: "notifications.read", update_setting: "config.manage",
      }
      const needed = permissionFor[action]
      if (!needed) return json({ ok: false, error: "unknown_action" }, 404)
      const permissions = await ctx.supabase.from("admin_permissions").select("permission_key").eq("admin_user_id", ctx.userClaims!.id).is("revoked_at", null)
      const allowed = assertNoError(permissions).some((p) => p.permission_key === needed || p.permission_key === "*")
      if (!allowed) return json({ ok: false, error: "permission_denied" }, 403)

      if (action === "overview") return json({ ok: true, data: assertNoError(await ctx.supabase.from("admin_overview").select("*").single()) })
      if (action === "user_action") return json(assertNoError(await ctx.supabase.rpc("admin_user_action", {
        p_target_user_id: requireString(payload.user_id, "user_id", 36), p_action: requireString(payload.command, "command", 20),
        p_reason: requireString(payload.reason, "reason", 1000), p_until: typeof payload.until === "string" ? payload.until : null,
      })))
      if (action === "kyc_review") return json(assertNoError(await ctx.supabase.rpc("admin_review_verification", {
        p_case_id: requireString(payload.case_id, "case_id", 36), p_decision: requireString(payload.decision, "decision", 30), p_note: requireString(payload.note, "note", 2000),
      })))
      if (action === "read_messages") {
        requireRecentAuth()
        return json({ ok: true, data: assertNoError(await ctx.supabase.rpc("admin_conversation_messages", {
        p_conversation_id: requireString(payload.conversation_id, "conversation_id", 36), p_purpose_code: requireString(payload.purpose_code, "purpose_code", 100),
        })) })
      }
      if (action === "list_users") {
        const query = ctx.supabaseAdmin.from("profiles").select("id,display_name,account_status,last_active_at,created_at,seller_profiles(status,rating_average,completed_bookings)").order("created_at", { ascending: false }).limit(100)
        return json({ ok: true, data: assertNoError(await query) })
      }
      if (action === "list_kyc") {
        const query = ctx.supabaseAdmin.from("verification_cases").select("id,seller_id,verification_type,status,initiated_at,decision_reason,seller_profiles(display_name,headline)").in("status", ["pending","needs_information"]).order("initiated_at").limit(100)
        return json({ ok: true, data: assertNoError(await query) })
      }
      if (action === "list_disputes") return json({ ok: true, data: assertNoError(await ctx.supabaseAdmin.from("service_disputes").select("*,bookings(reference,buyer_id,seller_id,total_minor,currency)").not("status", "in", '(resolved,closed)').order("created_at").limit(100)) })
      if (action === "list_moderation") return json({ ok: true, data: assertNoError(await ctx.supabaseAdmin.from("moderation_reports").select("*").not("status", "in", '(resolved,closed)').order("created_at").limit(100)) })
      if (action === "resolve_dispute") {
        const disputeId = requireString(payload.dispute_id, "dispute_id", 36)
        const before = assertNoError(await ctx.supabaseAdmin.from("service_disputes").select("*").eq("id", disputeId).single())
        assertNoError(await ctx.supabaseAdmin.from("service_disputes").update({ status: "resolved", resolution_code: requireString(payload.resolution_code, "resolution_code", 80), resolution_note: requireString(payload.note, "note", 3000), resolved_at: new Date().toISOString(), assigned_admin_id: ctx.userClaims!.id }).eq("id", disputeId))
        await ctx.supabaseAdmin.from("admin_audit_logs").insert({ actor_id: ctx.userClaims!.id, action: "dispute.resolve", target_type: "service_dispute", target_id: disputeId, before_redacted: before, after_redacted: { status: "resolved", resolution_code: payload.resolution_code }, reason: payload.note })
        return json({ ok: true })
      }
      if (action === "moderate_content") {
        const targetType = requireString(payload.target_type, "target_type", 30)
        const table = ({ message: "messages", review: "reviews", profile: "seller_profiles" } as Record<string,string>)[targetType]
        if (!table) throw new Error("unsupported_target")
        const targetId = requireString(payload.target_id, "target_id", 36)
        const values = table === "reviews" ? { status: payload.decision === "remove" ? "removed" : "published" } : table === "messages" ? { moderation_status: payload.decision === "remove" ? "removed" : "allowed" } : { status: payload.decision === "suspend" ? "suspended" : "approved" }
        assertNoError(await ctx.supabaseAdmin.from(table).update(values).eq(table === "seller_profiles" ? "user_id" : "id", targetId))
        await ctx.supabaseAdmin.from("admin_audit_logs").insert({ actor_id: ctx.userClaims!.id, action: `moderation.${payload.decision}`, target_type: targetType, target_id: targetId, reason: requireString(payload.reason, "reason", 1000) })
        return json({ ok: true })
      }
      if (action === "finance_overview") {
        const [payments, payouts, refunds, balances] = await Promise.all([
          ctx.supabaseAdmin.from("payment_intents").select("status,amount_minor,captured_minor,refunded_minor"), ctx.supabaseAdmin.from("payouts").select("status,amount_minor"),
          ctx.supabaseAdmin.from("refunds").select("status,amount_minor"), ctx.supabaseAdmin.from("wallet_balances").select("account_type,currency,balance_minor"),
        ])
        return json({ ok: true, data: { payments: assertNoError(payments), payouts: assertNoError(payouts), refunds: assertNoError(refunds), balances: assertNoError(balances) } })
      }
      if (action === "notification_health") return json({ ok: true, data: assertNoError(await ctx.supabaseAdmin.from("notification_outbox").select("status,attempts,available_at,created_at").order("created_at", { ascending: false }).limit(200)) })
      if (action === "update_setting") {
        const key = requireString(payload.key, "key", 80)
        assertNoError(await ctx.supabaseAdmin.from("system_settings").upsert({ key, value: payload.value ?? {}, updated_by: ctx.userClaims!.id, updated_at: new Date().toISOString() }))
        await ctx.supabaseAdmin.from("admin_audit_logs").insert({ actor_id: ctx.userClaims!.id, action: "setting.update", target_type: "system_setting", reason: `Updated ${key}`, after_redacted: { key } })
        return json({ ok: true })
      }
      return json({ ok: false, error: "unknown_action" }, 404)
    } catch (error) { return safeError(error) }
  }),
}
