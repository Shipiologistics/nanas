import { getSupabase } from "./supabase";

export async function marketplaceCommand(action: string, payload: Record<string, unknown> = {}, idempotencyKey?: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(name as never, args as never);
    if (error) throw error;
    return data;
  };
  const key = idempotencyKey ?? `${action}:${crypto.randomUUID()}`;

  if (action === "create_care_request") return rpc("create_care_request", { p_payload: payload });
  if (action === "submit_quote") return rpc("submit_seller_quote", {
    p_request_id: payload.request_id, p_rate_minor: payload.rate_minor, p_travel_minor: payload.travel_minor ?? 0,
    p_message: payload.message ?? null, p_expires_at: payload.expires_at ?? new Date(Date.now() + 48 * 3600_000).toISOString(),
  });
  if (action === "accept_quote") return rpc("accept_quote_with_simulated_payment", { p_quote_id: payload.quote_id, p_idempotency_key: key });
  if (action === "transition_booking") return rpc("transition_booking", {
    p_booking_id: payload.booking_id, p_target: payload.target, p_reason: payload.reason ?? null, p_idempotency_key: key,
  });
  if (action === "preview_cancellation") return rpc("preview_booking_cancellation", { p_booking_id: payload.booking_id });
  if (action === "cancel_booking") return rpc("cancel_booking", { p_booking_id: payload.booking_id, p_reason_code: payload.reason_code, p_idempotency_key: key });
  if (action === "submit_review") return rpc("submit_verified_review", { p_booking_id: payload.booking_id, p_rating: payload.rating, p_body: payload.body ?? "" });
  if (action === "open_dispute") return rpc("open_service_dispute", { p_booking_id: payload.booking_id, p_reason_code: payload.reason_code, p_summary: payload.summary });
  if (action === "create_support_case") return rpc("create_support_case", { p_case_type: payload.case_type, p_subject: payload.subject, p_details: payload.details, p_booking_id: payload.booking_id ?? null });
  if (action === "generate_session_code") return rpc("generate_session_code", { p_booking_id: payload.booking_id });
  if (action === "verify_session_code") return rpc("verify_session_code", { p_booking_id: payload.booking_id, p_code: payload.code });
  if (action === "request_data_export") return rpc("request_privacy_action", { p_request_type: "export" });
  if (action === "request_account_deletion") return rpc("request_privacy_action", { p_request_type: "delete" });
  if (action === "report_content") return rpc("report_content", {
    p_target_type: payload.target_type, p_target_id: payload.target_id,
    p_reason_code: payload.reason_code, p_details: payload.details ?? null,
  });
  if (action === "submit_verification_document") return rpc("submit_verification_document", {
    p_document_type: payload.document_type, p_storage_path: payload.storage_path, p_original_name: payload.original_name,
  });
  if (action === "upsert_household_member") return rpc("upsert_household_member", {
    p_member_id: payload.member_id ?? null, p_relationship: payload.relationship, p_display_name: payload.display_name,
    p_date_of_birth: payload.date_of_birth ?? null, p_care_notes: payload.care_notes ?? null, p_active: payload.active ?? true,
  });
  if (action === "seller_upsert_service") return rpc("seller_upsert_service", {
    p_service_id: payload.service_id, p_rate_minor: payload.rate_minor,
    p_rate_max_minor: payload.rate_max_minor ?? null, p_service_bio: payload.service_bio ?? null,
    p_years_experience: payload.years_experience ?? 0, p_capabilities: payload.capabilities ?? [],
    p_additional_help: payload.additional_help ?? [], p_active: payload.active ?? true,
  });
  if (action === "seller_replace_weekly_availability") return rpc("seller_replace_weekly_availability", {
    p_weekdays: payload.weekdays, p_local_start: payload.local_start, p_local_end: payload.local_end,
  });
  if (action === "seller_update_public_profile") return rpc("seller_update_public_profile", {
    p_display_name: payload.display_name, p_avatar_path: payload.avatar_path ?? null,
    p_headline: payload.headline, p_languages: payload.languages, p_island_id: payload.island_id ?? null,
    p_locality: payload.locality, p_vaccinations: payload.vaccinations ?? [],
    p_additional_details: payload.additional_details ?? [],
  });
  if (action === "seller_upsert_service_area") return rpc("seller_upsert_service_area", {
    p_service_area_id: payload.service_area_id, p_radius_km: payload.radius_km,
    p_travel_fee_minor: payload.travel_fee_minor, p_active: payload.active ?? true,
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Authentication required");
  const userId = authData.user.id;
  if (action === "send_message") {
    const { data, error } = await supabase.from("messages").insert({
      conversation_id: String(payload.conversation_id), sender_id: userId, body: String(payload.body),
      message_type: payload.message_type === "file" || payload.message_type === "image" ? payload.message_type : "text",
      sender_nonce: String(payload.sender_nonce),
    }).select("id,created_at").single();
    if (error) throw error;
    return { ok: true, message: data };
  }
  if (action === "mark_conversation_read") {
    const { error } = await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", String(payload.conversation_id)).eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  }
  if (action === "toggle_favorite") {
    const query = payload.favorite === false
      ? supabase.from("favorites").delete().eq("buyer_id", userId).eq("seller_id", String(payload.seller_id))
      : supabase.from("favorites").upsert({ buyer_id: userId, seller_id: String(payload.seller_id) });
    const { error } = await query;
    if (error) throw error;
    return { ok: true, favorite: payload.favorite !== false };
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
    if (error) throw error;
    return data;
  };
  if (action === "user_action") return call("admin_user_action", {
    p_target_user_id: payload.user_id, p_action: payload.command, p_reason: payload.reason, p_until: payload.until ?? null,
  });
  if (action === "kyc_review") return call("admin_review_verification", {
    p_case_id: payload.case_id, p_decision: payload.decision, p_note: payload.note,
  });
  if (action === "read_messages") return call("admin_conversation_messages", {
    p_conversation_id: payload.conversation_id, p_purpose_code: payload.purpose_code,
  });
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
