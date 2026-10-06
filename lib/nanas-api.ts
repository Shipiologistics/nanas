import { getSupabase } from "./supabase";
import { verificationReviewError } from "./verification-review.mjs";
import { marketplaceAccountFeedback } from "./marketplace-account-feedback.mjs";
import { confirmedReportReceipt, reportContentError } from "./moderation.mjs";
import { adminMessageArguments, confirmedAdminMessagePage, adminMessageError } from "../supabase/functions/_shared/admin-message-page.mjs";
import { providerOnboardingArguments, confirmedProviderOnboarding } from "../supabase/functions/_shared/provider-onboarding.mjs";
import { providerWorkspaceArguments, confirmedProviderWorkspace } from "./provider-workspace.mjs";
import { householdMemberArguments, confirmedHouseholdMember } from "./household-member.mjs";
import { emergencyContactArguments, confirmedEmergencyContact, confirmedEmergencyContactRevocation, confirmedBookingEmergencyContact } from "./emergency-contact.mjs";
import { visitUpdateArguments, visitUpdatePageArguments, confirmedVisitUpdate, confirmedVisitUpdatePage } from "./visit-update.mjs";

export async function marketplaceCommand(action: string, payload: Record<string, unknown> = {}, idempotencyKey?: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(name as never, args as never);
    if (error) {
      const accountFeedback = marketplaceAccountFeedback(error);
      if (accountFeedback) throw new Error(accountFeedback);
      throw error;
    }
    return data;
  };
  const key = idempotencyKey ?? `${action}:${crypto.randomUUID()}`;

  if (action === "activate_seller" || action === "submit_seller_application") {
    const args = providerOnboardingArguments(action, payload);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("authentication_required");
    return confirmedProviderOnboarding(action, await rpc(action === "activate_seller" ? "activate_seller_profile" : "submit_seller_application", args), data.user.id);
  }

  if (action === "create_care_request") return rpc("create_care_request", { p_payload: payload });
  if (action === "submit_quote") return rpc("submit_seller_quote", {
    p_request_id: payload.request_id, p_rate_minor: payload.rate_minor, p_travel_minor: payload.travel_minor ?? 0,
    p_message: payload.message ?? null, p_expires_at: payload.expires_at ?? new Date(Date.now() + 48 * 3600_000).toISOString(),
  });
  if (action === "accept_quote") return rpc("accept_quote_with_simulated_payment", { p_quote_id: payload.quote_id, p_idempotency_key: key });
  if (action === "purchase_conversation") return rpc("simulate_conversation_purchase", { p_conversation_id: payload.conversation_id, p_expected_amount_minor: payload.amount_minor, p_idempotency_key: key });
  if (action === "transition_booking") return rpc("transition_booking", {
    p_booking_id: payload.booking_id, p_target: payload.target, p_reason: payload.reason ?? null, p_idempotency_key: key,
  });
  if (action === "preview_cancellation") return rpc("preview_booking_cancellation", { p_booking_id: payload.booking_id });
  if (action === "cancel_booking") return rpc("cancel_booking", { p_booking_id: payload.booking_id, p_reason_code: payload.reason_code, p_idempotency_key: key, p_expected_fee_minor: payload.expected_fee_minor ?? null });
  if (action === "submit_review") return rpc("submit_verified_review", { p_booking_id: payload.booking_id, p_rating: payload.rating, p_body: payload.body ?? "" });
  if (action === "open_dispute") return rpc("open_service_dispute", { p_booking_id: payload.booking_id, p_reason_code: payload.reason_code, p_summary: payload.summary });
  if (action === "create_support_case") return rpc("create_support_case", { p_case_type: payload.case_type, p_subject: payload.subject, p_details: payload.details, p_booking_id: payload.booking_id ?? null });
  if (action === "generate_session_code") return rpc("generate_session_code", { p_booking_id: payload.booking_id });
  if (action === "verify_session_code") return rpc("verify_session_code", { p_booking_id: payload.booking_id, p_code: payload.code });
  if (action === "request_data_export") return rpc("request_privacy_action", { p_request_type: "export" });
  if (action === "request_account_deletion") return rpc("request_privacy_action", { p_request_type: "delete" });
  if (action === "report_content") {
    try {
      return confirmedReportReceipt(await rpc("report_content", {
        p_target_type: payload.target_type, p_target_id: payload.target_id,
        p_reason_code: payload.reason_code, p_details: payload.details ?? null,
      }));
    } catch (error) { throw new Error(reportContentError(error)); }
  }
  if (action === "submit_verification_document") return rpc("submit_verification_document", {
    p_document_type: payload.document_type, p_storage_path: payload.storage_path, p_original_name: payload.original_name,
  });
  if (action === "upsert_household_member") {
    const args = householdMemberArguments(payload);
    return confirmedHouseholdMember(await rpc("upsert_household_member", args), args.p_member_id);
  }
  if (action === "upsert_emergency_contact") {
    const args = emergencyContactArguments(payload);
    return confirmedEmergencyContact(await rpc("upsert_emergency_contact", args), args.p_contact_id);
  }
  if (action === "revoke_emergency_contact") {
    const contactId = typeof payload.contact_id === "string" ? payload.contact_id : "";
    return confirmedEmergencyContactRevocation(await rpc("revoke_emergency_contact", { p_contact_id: contactId }), contactId);
  }
  if (action === "booking_emergency_contact") {
    const bookingId = typeof payload.booking_id === "string" ? payload.booking_id : "";
    return confirmedBookingEmergencyContact(await rpc("booking_emergency_contact", { p_booking_id: bookingId }), bookingId);
  }
  if (action === "add_booking_visit_update") {
    const args = visitUpdateArguments(payload);
    return confirmedVisitUpdate(await rpc("add_booking_visit_update", args), payload);
  }
  if (action === "booking_visit_update_page") {
    const args = visitUpdatePageArguments(payload);
    return confirmedVisitUpdatePage(await rpc("booking_visit_update_page", args), args.p_booking_id);
  }
  if (["seller_upsert_service", "seller_replace_weekly_availability", "seller_set_publication", "seller_update_public_profile", "seller_upsert_service_area"].includes(action)) {
    const args = providerWorkspaceArguments(action, payload);
    return confirmedProviderWorkspace(action, await rpc(action, args), payload);
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required");
  const userId = authData.user.id;
  if (action === "mark_notification_read") {
    const { data, error } = await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", String(payload.notification_id)).eq("recipient_id", userId)
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Notification not found or access denied");
    return { ok: true };
  }
  if (action === "set_notification_preference") {
    const category = String(payload.category);
    if (!["booking", "messages", "payments", "account"].includes(category) || typeof payload.enabled !== "boolean") {
      throw new Error("Invalid notification preference");
    }
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: userId, event_category: category, in_app: payload.enabled, email: payload.enabled,
    }, { onConflict: "user_id,event_category" });
    if (error) throw error;
    return { ok: true };
  }
  if (action === "send_message") {
    const { data, error } = await supabase.from("messages").insert({
      conversation_id: String(payload.conversation_id), sender_id: userId, body: String(payload.body),
      message_type: payload.message_type === "file" || payload.message_type === "image" ? payload.message_type : "text",
      sender_nonce: String(payload.sender_nonce),
    }).select("id,created_at").single();
    if (error) {
      // Recover a committed send after a lost response or an explicit retry.
      // The sender's RLS-scoped row must match this exact draft, not just its key.
      const existing = await supabase.from("messages").select("id,created_at,conversation_id,body")
        .eq("sender_id", userId).eq("sender_nonce", String(payload.sender_nonce)).maybeSingle();
      if (existing.data?.conversation_id === String(payload.conversation_id) && existing.data.body === String(payload.body)) {
        return { ok: true, message: { id: existing.data.id, created_at: existing.data.created_at }, replayed: true };
      }
      throw error;
    }
    return { ok: true, message: data };
  }
  if (action === "mark_conversation_read") {
    if (typeof payload.message_id !== "string" || !payload.message_id.trim()) throw new Error("A loaded message is required to save a read receipt.");
    const receipt: unknown = await rpc("mark_conversation_read_through", { p_conversation_id: payload.conversation_id, p_message_id: payload.message_id });
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) || !("ok" in receipt) || receipt.ok !== true || !("read_through" in receipt) || typeof receipt.read_through !== "string") throw new Error("Read receipt was not confirmed. Please retry.");
    return receipt;
  }
  if (action === "toggle_favorite") {
    if (typeof payload.favorite !== "boolean") throw new Error("A saved-provider choice is required");
    return rpc("set_provider_favorite", { p_seller_id: String(payload.seller_id), p_favorite: payload.favorite });
  }
  if (action === "trigger_safety_alert") {
    const { data, error } = await supabase.from("safety_incidents").insert({
      booking_id: typeof payload.booking_id === "string" ? payload.booking_id : null,
      reporter_id: userId, category: String(payload.category), severity: "urgent",
    }).select("id").single();
    if (error) throw error;
    return { ok: true, incident_id: data.id };
  }
  const { data, error } = await supabase.functions.invoke("marketplace-command", {
    body: { action, payload },
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error ?? "Command failed");
  return data;
}

export async function adminCommand(action: string, payload: Record<string, unknown> = {}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const call = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(name as never, args as never);
    if (error && name === "admin_review_verification") throw new Error(verificationReviewError(error));
    if (error) throw error;
    return data;
  };
  if (action === "user_action") return call("admin_user_action", {
    p_target_user_id: payload.user_id, p_action: payload.command, p_reason: payload.reason, p_until: payload.until ?? null,
  });
  if (action === "kyc_review") return call("admin_review_verification", {
    p_case_id: payload.case_id, p_decision: payload.decision, p_note: payload.note,
  });
  if (action === "read_messages") {
    try {
      const args=adminMessageArguments(payload);
      return confirmedAdminMessagePage(await call("admin_conversation_message_page",args),args);
    } catch(error) { throw new Error(adminMessageError(error)); }
  }
  if (action === "resolve_dispute") return call("admin_resolve_service_dispute", {
    p_dispute_id: payload.dispute_id, p_resolution_code: payload.resolution_code, p_note: payload.note,
    p_refund_minor: payload.refund_minor ?? null,
  });
  if (action === "resolve_moderation") return call("admin_resolve_moderation_report", {
    p_report_id: payload.report_id, p_action: payload.moderation_action,
    p_reason_code: payload.reason_code, p_public_note: payload.public_note ?? null,
    p_private_note: payload.private_note ?? null, p_expires_at: payload.expires_at ?? null,
  });
  if (action === "manage_operations_case") return call("admin_manage_operations_case", {
    p_case_kind: payload.case_kind, p_case_id: payload.case_id,
    p_action: payload.case_action, p_note: payload.note,
  });
  if (action === "update_feature_flag") return call("admin_update_feature_flag", {
    p_key: payload.key, p_enabled: payload.enabled, p_reason: payload.reason,
  });
  if (action === "upsert_service") return call("admin_upsert_service", {
    p_service_id: payload.service_id ?? null, p_category_id: payload.category_id,
    p_name: payload.name, p_description: payload.description,
    p_pricing_unit: payload.pricing_unit, p_risk_level: payload.risk_level,
    p_active: payload.active, p_reason: payload.reason,
  });
  if (action === "upsert_service_area") return call("admin_upsert_service_area", {
    p_area_id: payload.area_id ?? null, p_island_id: payload.island_id,
    p_name: payload.name, p_active: payload.active, p_reason: payload.reason,
  });
  if (action === "upsert_job_posting_plan") return call("admin_upsert_job_posting_plan", {
    p_plan_id: payload.plan_id ?? null, p_code: payload.code, p_name: payload.name,
    p_description: payload.description, p_fee_minor: payload.fee_minor,
    p_duration_days: payload.duration_days, p_free_post_allowance: payload.free_post_allowance,
    p_featured: payload.featured, p_active: payload.active, p_reason: payload.reason,
  });
  const { data, error } = await supabase.functions.invoke("admin-command", { body: { action, payload } });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error ?? "Admin command failed");
  return data;
}

export async function issueUploadUrl(bucket: string, file: File, entityId?: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required");
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-120);
  const path = `${authData.user.id}/${entityId ?? "unassigned"}/${crypto.randomUUID()}-${safeName}`;
  const upload = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw upload.error;
  return { bucket, path };
}

export const idempotencyKey = (scope: string) => `${scope}:${crypto.randomUUID()}`;
