import { supabase } from '@/lib/supabase';

export type Payload = Record<string, unknown>;
export const operationKey = (scope: string) => `${scope}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

async function rpc(name: string, args: Payload) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Authentication required.');
  return data.user.id;
}

export async function marketplace(action: string, payload: Payload = {}, idempotencyKey = operationKey(action)) {
  if (action === 'create_care_request') return rpc('create_care_request', { p_payload: payload });
  if (action === 'submit_quote') return rpc('submit_seller_quote', { p_request_id: payload.request_id, p_rate_minor: payload.rate_minor, p_travel_minor: payload.travel_minor ?? 0, p_message: payload.message ?? null, p_expires_at: payload.expires_at ?? new Date(Date.now() + 48 * 3600_000).toISOString() });
  if (action === 'accept_quote') return rpc('accept_quote_with_simulated_payment', { p_quote_id: payload.quote_id, p_idempotency_key: idempotencyKey });
  if (action === 'purchase_conversation') return rpc('simulate_conversation_purchase', { p_conversation_id: payload.conversation_id, p_expected_amount_minor: payload.amount_minor, p_idempotency_key: idempotencyKey });
  if (action === 'transition_booking') return rpc('transition_booking', { p_booking_id: payload.booking_id, p_target: payload.target, p_reason: payload.reason ?? null, p_idempotency_key: idempotencyKey });
  if (action === 'preview_cancellation') return rpc('preview_booking_cancellation', { p_booking_id: payload.booking_id });
  if (action === 'cancel_booking') return rpc('cancel_booking', { p_booking_id: payload.booking_id, p_reason_code: payload.reason_code, p_idempotency_key: idempotencyKey, p_expected_fee_minor: payload.expected_fee_minor ?? null });
  if (action === 'submit_review') return rpc('submit_verified_review', { p_booking_id: payload.booking_id, p_rating: payload.rating, p_body: payload.body ?? '' });
  if (action === 'open_dispute') return rpc('open_service_dispute', { p_booking_id: payload.booking_id, p_reason_code: payload.reason_code, p_summary: payload.summary });
  if (action === 'create_support_case') return rpc('create_support_case', { p_case_type: payload.case_type, p_subject: payload.subject, p_details: payload.details, p_booking_id: payload.booking_id ?? null });
  if (action === 'generate_session_code') return rpc('generate_session_code', { p_booking_id: payload.booking_id });
  if (action === 'verify_session_code') return rpc('verify_session_code', { p_booking_id: payload.booking_id, p_code: payload.code });
  if (action === 'request_data_export') return rpc('request_privacy_action', { p_request_type: 'export' });
  if (action === 'request_account_deletion') return rpc('request_privacy_action', { p_request_type: 'delete' });
  if (action === 'submit_verification_document') return rpc('submit_verification_document', { p_document_type: payload.document_type, p_storage_path: payload.storage_path, p_original_name: payload.original_name });
  if (action === 'upsert_household_member') return rpc('upsert_household_member', { p_member_id: payload.member_id ?? null, p_relationship: payload.relationship, p_display_name: payload.display_name, p_date_of_birth: payload.date_of_birth ?? null, p_care_notes: payload.care_notes ?? '', p_active: payload.active ?? true });
  if (action === 'upsert_emergency_contact') return rpc('upsert_emergency_contact', { p_contact_id: payload.contact_id ?? null, p_name: payload.name, p_phone_e164: payload.phone_e164, p_relationship: payload.relationship, p_priority: payload.priority, p_consent_confirmed: payload.consent_confirmed });
  if (action === 'revoke_emergency_contact') return rpc('revoke_emergency_contact', { p_contact_id: payload.contact_id });
  if (action === 'booking_emergency_contact') return rpc('booking_emergency_contact', { p_booking_id: payload.booking_id });
  if (action === 'add_booking_visit_update') return rpc('add_booking_visit_update', { p_booking_id: payload.booking_id, p_update_type: payload.update_type, p_note: payload.note, p_client_nonce: payload.client_nonce });
  if (action === 'booking_visit_update_page') return rpc('booking_visit_update_page', { p_booking_id: payload.booking_id, p_before_at: payload.before_at ?? null, p_before_id: payload.before_id ?? null, p_limit: payload.limit ?? 50 });
  if (action === 'seller_replace_weekly_availability') return rpc('seller_replace_weekly_availability', { p_weekdays: payload.weekdays, p_local_start: payload.local_start, p_local_end: payload.local_end });
  if (action === 'seller_set_publication') return rpc('seller_set_publication', { p_published: payload.published });
  if (action === 'seller_update_public_profile') return rpc('seller_update_public_profile', { p_display_name: payload.display_name, p_avatar_path: payload.avatar_path ?? null, p_headline: payload.headline ?? null, p_languages: payload.languages ?? [], p_island_id: payload.island_id ?? null, p_locality: payload.locality ?? null, p_vaccinations: payload.vaccinations ?? [], p_additional_details: payload.additional_details ?? [] });
  if (action === 'seller_upsert_service') return rpc('seller_upsert_service', { p_service_id: payload.service_id, p_rate_minor: payload.rate_minor, p_rate_max_minor: payload.rate_max_minor ?? null, p_service_bio: payload.service_bio, p_years_experience: payload.years_experience, p_capabilities: payload.capabilities ?? [], p_additional_help: payload.additional_help ?? [], p_active: payload.active ?? true });
  if (action === 'seller_upsert_service_area') return rpc('seller_upsert_service_area', { p_service_area_id: payload.service_area_id, p_radius_km: payload.radius_km ?? null, p_travel_fee_minor: payload.travel_fee_minor ?? 0, p_active: payload.active ?? true });
  if (action === 'set_favorite') return rpc('set_provider_favorite', { p_seller_id: payload.seller_id, p_favorite: payload.favorite });
  if (action === 'set_notification_preference') {
    const userId = await currentUserId();
    const enabled = Boolean(payload.enabled);
    const { data, error } = await supabase.from('notification_preferences').upsert({
      user_id: userId,
      event_category: String(payload.category),
      in_app: enabled,
      email: enabled,
    }, { onConflict: 'user_id,event_category' }).select('event_category,in_app,email,push,sms').single();
    if (error) throw error;
    return data;
  }
  if (action === 'mark_notification_read') {
    const userId = await currentUserId();
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('id', payload.notification_id).eq('recipient_id', userId);
    if (error) throw error;
    return { ok: true };
  }
  if (action === 'report_content') return rpc('report_content', {
    p_target_type: payload.target_type,
    p_target_id: payload.target_id,
    p_reason_code: payload.reason_code,
    p_details: payload.details ?? '',
  });

  const userId = await currentUserId();
  if (action === 'send_message') {
    const draft = { conversation_id: String(payload.conversation_id), sender_id: userId, body: String(payload.body), message_type: payload.message_type === 'image' || payload.message_type === 'file' ? payload.message_type : 'text', sender_nonce: String(payload.sender_nonce) };
    const { data, error } = await supabase.from('messages').insert(draft).select('id,created_at').single();
    if (!error) return { ok: true, message: data };
    const replay = await supabase.from('messages').select('id,created_at,conversation_id,body').eq('sender_id', userId).eq('sender_nonce', draft.sender_nonce).maybeSingle();
    if (replay.data?.conversation_id === draft.conversation_id && replay.data.body === draft.body) return { ok: true, message: replay.data, replayed: true };
    throw error;
  }
  if (action === 'mark_conversation_read') return rpc('mark_conversation_read_through', { p_conversation_id: payload.conversation_id, p_message_id: payload.message_id });
  if (action === 'trigger_safety_alert') {
    const { data, error } = await supabase.from('safety_incidents').insert({ booking_id: typeof payload.booking_id === 'string' ? payload.booking_id : null, reporter_id: userId, category: String(payload.category), severity: 'urgent' }).select('id').single();
    if (error) throw error;
    return { ok: true, incident_id: data.id };
  }
  throw new Error(`Unsupported marketplace action: ${action}`);
}
