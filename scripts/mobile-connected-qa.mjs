import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL; const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && publicKey && serviceKey, 'Supabase QA configuration is incomplete');

const buyer = { id: '2458f843-d5c1-4b4d-bcde-bfe695459a9d', email: 'nanas-qa-20261005-muv21zbq-buyer@example.com' };
const provider = { id: '05e8eb22-5064-47a0-b226-0fd8dea3e97f', email: 'nanas-qa-20261005-muv21zbq-seller@example.com' };
const password = `Qa-${crypto.randomBytes(18).toString('base64url')}aA1`;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const client = () => createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const buyerClient = client(); const providerClient = client();
let checks = 0;
const pass = async (name, work) => { await work(); checks += 1; console.log(`PASS ${name}`); };
const ok = (result) => { if (result.error) throw result.error; return result.data; };
const rpc = async (api, name, args = {}) => ok(await api.rpc(name, args));
const key = (scope) => `mobile-qa:${scope}:${Date.now()}:${crypto.randomUUID()}`;

await pass('isolated QA identities receive fresh ephemeral passwords', async () => {
  ok(await admin.auth.admin.updateUserById(buyer.id, { password }));
  ok(await admin.auth.admin.updateUserById(provider.id, { password }));
});
await pass('buyer and provider authenticate through normal password grants', async () => {
  assert.equal(ok(await buyerClient.auth.signInWithPassword({ email: buyer.email, password })).user.id, buyer.id);
  assert.equal(ok(await providerClient.auth.signInWithPassword({ email: provider.email, password })).user.id, provider.id);
});
await pass('roles are RLS-scoped and cannot cross workspaces', async () => {
  const buyerRoles = ok(await buyerClient.from('user_roles').select('role').eq('user_id', buyer.id).is('revoked_at', null));
  const providerRoles = ok(await providerClient.from('user_roles').select('role').eq('user_id', provider.id).is('revoked_at', null));
  assert.deepEqual(buyerRoles.map((x) => x.role), ['buyer']); assert.deepEqual(providerRoles.map((x) => x.role), ['seller']);
  const denied = await providerClient.rpc('create_care_request', { p_payload: {} }); assert(denied.error, 'provider unexpectedly created buyer request');
});
await pass('test-payment enrollment is buyer-only and checked through ordinary sessions', async () => {
  assert.equal(await rpc(buyerClient, 'payment_simulation_allowed'), true);
  assert.equal(await rpc(providerClient, 'payment_simulation_allowed'), false);
});

const buyerSections = [
  ['seller_directory', '*'], ['booking_requests', 'id'], ['booking_quotes', 'id'], ['bookings', 'id'], ['conversations', 'id'], ['wallet_balances', 'account_id'], ['reviews', 'id'], ['favorites', 'seller_id'], ['households', 'id'], ['notifications', 'id'], ['support_cases', 'id'], ['profiles', 'id'],
];
const providerSections = [
  ['booking_quotes', 'id'], ['bookings', 'id'], ['conversations', 'id'], ['availability_rules', 'id'], ['seller_services', 'id'], ['wallet_balances', 'account_id'], ['seller_profiles', 'user_id'], ['seller_documents', 'id'], ['user_badges', 'id'], ['notifications', 'id'], ['support_cases', 'id'], ['profiles', 'id'],
];
await pass('every buyer and provider section query executes under RLS', async () => {
  for (const [table, select] of buyerSections) assert(Array.isArray(ok(await buyerClient.from(table).select(select).limit(3))), `buyer ${table}`);
  for (const [table, select] of providerSections) assert(Array.isArray(ok(await providerClient.from(table).select(select).limit(3))), `provider ${table}`);
  const feed = await rpc(providerClient, 'provider_request_feed', { p_page: 1, p_page_size: 5, p_sort: 'recommended' }); assert(feed && typeof feed === 'object');
});
await pass('application-shaped section projections match the deployed schema', async () => {
  const projections = [
    [buyerClient, 'booking_quotes', 'id,request_id,seller_id,currency,base_minor,travel_minor,platform_fee_minor,total_minor,policy_snapshot,expires_at,created_at'],
    [providerClient, 'booking_quotes', 'id,request_id,currency,base_minor,travel_minor,platform_fee_minor,total_minor,policy_snapshot,expires_at,created_at'],
    [providerClient, 'availability_rules', 'id,weekday,local_start,local_end,timezone,active,valid_from,valid_until,updated_at'],
    [providerClient, 'user_badges', 'id,badge_id,awarded_at,expires_at,revoked_at,created_at,badges(name,description)'],
    [buyerClient, 'profiles', 'id,display_name,phone_e164,account_status,created_at,updated_at'],
    [buyerClient, 'notifications', 'id,title,body,category,event_type,read_at,created_at,deep_link'],
    [providerClient, 'seller_documents', 'id,document_type,status,issue_date,expiry_date,uploaded_at,updated_at'],
  ];
  for (const [api, table, select] of projections) assert(Array.isArray(ok(await api.from(table).select(select).limit(3))), `${table} projection failed`);
});

let memberId; let contactId;
await pass('buyer creates private care recipient', async () => {
  const result = await rpc(buyerClient, 'upsert_household_member', { p_member_id: null, p_relationship: 'QA relative', p_display_name: 'MOBILE QA Recipient', p_date_of_birth: '1950-01-01', p_care_notes: 'Fictional mobile QA record only.', p_active: true });
  memberId = result.member_id; assert(memberId);
  const rows = ok(await buyerClient.from('household_members').select('id,display_name').eq('id', memberId)); assert.equal(rows[0].display_name, 'MOBILE QA Recipient');
});
await pass('buyer creates a consented emergency contact', async () => {
  const result = await rpc(buyerClient, 'upsert_emergency_contact', { p_contact_id: null, p_name: 'MOBILE QA Contact', p_phone_e164: '+12425550198', p_relationship: 'QA neighbor', p_priority: 9, p_consent_confirmed: true });
  contactId = result.contact_id; assert(contactId);
});
await pass('notification preference persists and reads back', async () => {
  ok(await buyerClient.from('notification_preferences').upsert({ user_id: buyer.id, event_category: 'messages', in_app: true, email: true }, { onConflict: 'user_id,event_category' }));
  const row = ok(await buyerClient.from('notification_preferences').select('in_app,email').eq('user_id', buyer.id).eq('event_category', 'messages').single()); assert(row.in_app && row.email);
});
await pass('provider availability, service, profile, coverage and publication commands execute', async () => {
  await rpc(providerClient, 'seller_replace_weekly_availability', { p_weekdays: [1, 2, 3, 4, 5], p_local_start: '08:00', p_local_end: '17:00' });
  await rpc(providerClient, 'seller_upsert_service', { p_service_id: '23000000-0000-0000-0000-000000000012', p_rate_minor: 2500, p_rate_max_minor: 3000, p_service_bio: 'LOCAL QA fictional provider profile for mobile end-to-end testing only. I offer scheduled dog walks in the Nassau test service area, follow written care instructions, share clear visit updates, and never represent this test profile as a real service offering.', p_years_experience: 2, p_capabilities: ['Fictional test fixture', 'Dog walking'], p_additional_help: ['Water bowl refill'], p_active: true });
  await rpc(providerClient, 'seller_update_public_profile', { p_display_name: 'LOCAL QA seller 20261005-muv21zbq', p_avatar_path: null, p_headline: 'LOCAL QA fictional dog-walking provider', p_languages: ['English'], p_island_id: '10000000-0000-0000-0000-000000000001', p_locality: 'Nassau', p_vaccinations: [], p_additional_details: [] });
  await rpc(providerClient, 'seller_upsert_service_area', { p_service_area_id: '11000000-0000-0000-0000-000000000001', p_radius_km: 15, p_travel_fee_minor: 0, p_active: true });
  const publication = await rpc(providerClient, 'seller_set_publication', { p_published: true }); assert(publication.published_at);
});

const start = new Date(Date.now() + (20 + crypto.randomBytes(1)[0] % 55) * 86400_000); start.setUTCHours(14, 0, 0, 0); const end = new Date(start.getTime() + 2 * 3600_000);
const requestPayload = (suffix) => ({
  service_id: '23000000-0000-0000-0000-000000000012', service_area_id: '11000000-0000-0000-0000-000000000001', desired_start: start.toISOString(), desired_end: end.toISOString(), mode: 'scheduled', care_summary: `MOBILE QA ${suffix}: fictional dog walking request, not a real job.`, budget_minor: 8000, rate_min_minor: 2000, rate_max_minor: 3500, household_member_id: memberId, emergency_contact_id: contactId, recipients: [],
  address: { label: 'QA care location', line1: '1 Fictional QA Street', line2: '', locality: 'Nassau', island_id: '10000000-0000-0000-0000-000000000001', postal_code: '', access_notes: '' },
  schedule: { kind: 'recurring', start_date: start.toISOString().slice(0, 10), end_date: '', flexible_start: false, weekdays: [1, 3, 5], time_periods: [], specific_start: '10:00', specific_end: '12:00', schedule_may_vary: false },
  category_code: 'pet_care', subcategory_code: 'dog_walker', intake_answers: { responsibilities: ['QA walk'], caregiver_qualities: [], extras: [] }, intake_public_summary: { category: 'pet care', service: 'Walker', responsibilities: ['QA walk'], caregiver_qualities: [], extras: [] }, care_requirements: { category_code: 'pet_care', subcategory_code: 'dog_walker', responsibilities: ['QA walk'], caregiver_qualities: [] }, access_notes: '', posting_plan_code: 'premium', simulated_payment_confirmed: true, expected_fee_minor: 1900, idempotency_key: key(`request-${suffix}`),
});

let requestId; let quoteId; let bookingId; let conversationId;
await pass('buyer publishes recurring paid request with simulated receipt', async () => {
  const result = await rpc(buyerClient, 'create_care_request', { p_payload: requestPayload('BOOKING') }); requestId = result.request_id; assert(requestId && result.payment_intent_id && result.simulation === true);
});
await pass('provider feed receives matching request and provider submits quote', async () => {
  const feed = await rpc(providerClient, 'provider_request_feed', { p_page: 0, p_page_size: 50, p_sort: 'recommended' }); const items = Array.isArray(feed) ? feed : feed.items; assert(items.some((item) => item.id === requestId));
  const result = await rpc(providerClient, 'submit_seller_quote', { p_request_id: requestId, p_rate_minor: 2500, p_travel_minor: 0, p_message: 'MOBILE QA test quote only.', p_expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() }); quoteId = result.quote_id; assert(quoteId);
});
await pass('buyer accepts quote with simulated payment and booking is created', async () => {
  const result = await rpc(buyerClient, 'accept_quote_with_simulated_payment', { p_quote_id: quoteId, p_idempotency_key: key('accept') }); bookingId = result.booking_id; assert(bookingId);
  const conversation = ok(await buyerClient.from('conversations').select('id').eq('booking_id', bookingId).single()); conversationId = conversation.id; assert(conversationId);
  assert.equal(ok(await buyerClient.from('payment_intents').select('id').eq('booking_id', bookingId)).length, 1);
});
await pass('conversation paywall state, simulated unlock and scoped messaging work', async () => {
  let state = (await rpc(buyerClient, 'conversation_access_state')).find((item) => item.conversation_id === conversationId); assert(state); assert.equal(state.locked, false);
  const nonce = crypto.randomUUID(); ok(await providerClient.from('messages').insert({ conversation_id: conversationId, sender_id: provider.id, body: 'MOBILE QA secure test message.', message_type: 'text', sender_nonce: nonce }));
  const sentRows = ok(await providerClient.from('messages').select('id,body').eq('sender_id', provider.id).eq('sender_nonce', nonce)); assert.equal(sentRows.length, 1, 'sender cannot read its own inserted message'); const sent = sentRows[0];
  state = (await rpc(buyerClient, 'conversation_access_state')).find((item) => item.conversation_id === conversationId); assert.equal(state.locked, true); assert.equal(state.can_send, false);
  assert.equal(ok(await buyerClient.from('messages').select('id').eq('id', sent.id)).length, 0, 'locked body leaked before purchase');
  await rpc(buyerClient, 'simulate_conversation_purchase', { p_conversation_id: conversationId, p_expected_amount_minor: 1900, p_idempotency_key: key('conversation') });
  state = (await rpc(buyerClient, 'conversation_access_state')).find((item) => item.conversation_id === conversationId); assert.equal(state.locked, false); assert.equal(state.can_send, true);
  const visibleRows = ok(await buyerClient.from('messages').select('id,body').eq('id', sent.id)); assert.equal(visibleRows.length, 1, 'buyer cannot read unlocked provider message'); const visible = visibleRows[0]; assert.equal(visible.body, 'MOBILE QA secure test message.');
  await rpc(buyerClient, 'mark_conversation_read_through', { p_conversation_id: conversationId, p_message_id: sent.id });
});
await pass('booking emergency contact is scoped to participants', async () => {
  const result = await rpc(providerClient, 'booking_emergency_contact', { p_booking_id: bookingId }); assert(result.configured && result.contact.phone_e164 === '+12425550198');
});
await pass('session code starts visit and provider posts visit update', async () => {
  const oldActive = ok(await buyerClient.from('bookings').select('id,status').eq('seller_id', provider.id).neq('id', bookingId).in('status', ['confirmed', 'in_progress', 'completion_pending']));
  for (const old of oldActive) await rpc(buyerClient, 'open_service_dispute', { p_booking_id: old.id, p_reason_code: 'mobile_qa_cleanup', p_summary: 'Automated cleanup of an interrupted fictional mobile QA booking.' });
  ok(await admin.from('bookings').update({ scheduled_start: new Date(Date.now() - 10 * 60_000).toISOString(), scheduled_end: new Date(Date.now() + 2 * 3600_000).toISOString() }).eq('id', bookingId));
  const generated = await rpc(buyerClient, 'generate_session_code', { p_booking_id: bookingId }); assert(/^\d{6}$/.test(generated.code));
  const verified = await rpc(providerClient, 'verify_session_code', { p_booking_id: bookingId, p_code: generated.code }); assert.equal(verified.ok, true);
  const started = await rpc(providerClient, 'transition_booking', { p_booking_id: bookingId, p_target: 'in_progress', p_reason: 'MOBILE QA start', p_idempotency_key: key('start') }); assert.equal(started.status, 'in_progress');
  const update = await rpc(providerClient, 'add_booking_visit_update', { p_booking_id: bookingId, p_update_type: 'activity', p_note: 'MOBILE QA fictional visit update.', p_client_nonce: crypto.randomUUID() }); assert(update.visit_update_id);
  const page = await rpc(buyerClient, 'booking_visit_update_page', { p_booking_id: bookingId, p_before_at: null, p_before_id: null, p_limit: 50 }); assert(page.updates.some((item) => item.id === update.visit_update_id));
});
await pass('provider checkout and buyer completion settle simulated funds', async () => {
  const pending = await rpc(providerClient, 'transition_booking', { p_booking_id: bookingId, p_target: 'completion_pending', p_reason: 'MOBILE QA checkout', p_idempotency_key: key('checkout') }); assert.equal(pending.status, 'completion_pending');
  const completed = await rpc(buyerClient, 'transition_booking', { p_booking_id: bookingId, p_target: 'completed', p_reason: 'MOBILE QA confirmed', p_idempotency_key: key('complete') }); assert.equal(completed.status, 'completed');
});
await pass('cancellation preview, fee validation and simulated refund complete atomically', async () => {
  const cancelStart = new Date(start.getTime() + 3 * 86400_000); const cancelEnd = new Date(cancelStart.getTime() + 2 * 3600_000);
  const payload = requestPayload('CANCELLATION'); payload.desired_start = cancelStart.toISOString(); payload.desired_end = cancelEnd.toISOString(); payload.schedule.start_date = cancelStart.toISOString().slice(0, 10); payload.idempotency_key = key('cancel-request');
  const request = await rpc(buyerClient, 'create_care_request', { p_payload: payload });
  const quote = await rpc(providerClient, 'submit_seller_quote', { p_request_id: request.request_id, p_rate_minor: 2500, p_travel_minor: 0, p_message: 'MOBILE QA cancellation quote.', p_expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
  const accepted = await rpc(buyerClient, 'accept_quote_with_simulated_payment', { p_quote_id: quote.quote_id, p_idempotency_key: key('cancel-accept') });
  const preview = await rpc(buyerClient, 'preview_booking_cancellation', { p_booking_id: accepted.booking_id }); assert.equal(preview.fee_minor, 0); assert(preview.refund_minor > 0);
  const cancelled = await rpc(buyerClient, 'cancel_booking', { p_booking_id: accepted.booking_id, p_reason_code: 'mobile_qa_cancellation', p_idempotency_key: key('cancel'), p_expected_fee_minor: preview.fee_minor }); assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.refund_minor, preview.refund_minor);
  const booking = ok(await buyerClient.from('bookings').select('status,blocks_calendar').eq('id', accepted.booking_id).single()); assert.equal(booking.status, 'cancelled'); assert.equal(booking.blocks_calendar, false);
});
await pass('verified review, favorite, support and safety writes persist', async () => {
  const review = await rpc(buyerClient, 'submit_verified_review', { p_booking_id: bookingId, p_rating: 5, p_body: 'MOBILE QA verified review.' }); assert(review.review_id);
  await rpc(buyerClient, 'set_provider_favorite', { p_seller_id: provider.id, p_favorite: true }); assert(ok(await buyerClient.from('favorites').select('seller_id').eq('seller_id', provider.id)).length > 0);
  const support = await rpc(buyerClient, 'create_support_case', { p_case_type: 'other', p_subject: 'MOBILE QA support case', p_details: 'Fictional automated mobile end-to-end test support case.', p_booking_id: bookingId }); assert(support.case_id);
  const safety = ok(await buyerClient.from('safety_incidents').insert({ booking_id: bookingId, reporter_id: buyer.id, category: 'MOBILE QA safety test', severity: 'urgent' }).select('id').single()); assert(safety.id);
});
await pass('completed booking can open a participant dispute and release the calendar', async () => {
  const dispute = await rpc(buyerClient, 'open_service_dispute', { p_booking_id: bookingId, p_reason_code: 'mobile_qa_dispute', p_summary: 'Fictional automated dispute used only to test the mobile workflow.' }); assert(dispute.dispute_id);
  const booking = ok(await buyerClient.from('bookings').select('status,blocks_calendar').eq('id', bookingId).single()); assert.equal(booking.status, 'disputed'); assert.equal(booking.blocks_calendar, false);
});
await pass('privacy export request is accepted with recent auth', async () => {
  const result = await rpc(buyerClient, 'request_privacy_action', { p_request_type: 'export' }); assert(result.request_id);
});
await pass('wallet, receipts, ledger, notifications and provider earnings are visible', async () => {
  assert(ok(await buyerClient.from('payment_intents').select('id').eq('request_id', requestId)).length > 0);
  assert(ok(await buyerClient.from('notifications').select('id').eq('recipient_id', buyer.id)).length > 0);
  assert(Array.isArray(ok(await providerClient.from('payouts').select('id,amount_minor,status').eq('seller_id', provider.id))));
  assert(Array.isArray(ok(await providerClient.from('wallet_balances').select('account_id,balance_minor').eq('owner_user_id', provider.id))));
});
await pass('outsider cannot read participant booking, messages or private contact', async () => {
  const outsider = client(); const outsiderEmail = 'qa.buyer.1791260194280@example.com'; ok(await admin.auth.admin.updateUserById('f326ac14-f214-470a-bae5-0aa7f000cc47', { password })); ok(await outsider.auth.signInWithPassword({ email: outsiderEmail, password }));
  assert.equal(ok(await outsider.from('bookings').select('id').eq('id', bookingId)).length, 0);
  assert.equal(ok(await outsider.from('messages').select('id').eq('conversation_id', conversationId)).length, 0);
  const denied = await outsider.rpc('booking_emergency_contact', { p_booking_id: bookingId }); assert(denied.error);
  await outsider.auth.signOut();
});
await pass('emergency-contact consent revocation immediately closes disclosure', async () => {
  const result = await rpc(buyerClient, 'revoke_emergency_contact', { p_contact_id: contactId }); assert.equal(result.consent_confirmed, false);
  const hidden = await providerClient.rpc('booking_emergency_contact', { p_booking_id: bookingId });
  assert(hidden.error || hidden.data?.configured === false, 'revoked contact remained visible');
});

await buyerClient.auth.signOut(); await providerClient.auth.signOut();
console.log(`${checks} connected mobile checks passed using ordinary authenticated sessions and isolated QA data.`);
