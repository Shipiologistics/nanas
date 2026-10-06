import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Source-contract checks complement, but do not replace, applying migrations
// and running authenticated integration tests against the test database.
test("resolved reviews require recorded completion in database and portal", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261005210000_review_completed_resolved_visits.sql", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  assert.match(sql, /v_booking.status not in \('completed','resolved'\) or v_booking.completed_at is null/);
  assert.match(portal, /status,completed_at,total_minor/);
  assert.match(portal, /completedAt: booking.completed_at \?\? undefined/);
  assert.match(portal, /Boolean\(booking.completedAt\) \|\| \(demoMode && booking.status === "completed"\)/);
  assert.match(portal, /busy \|\| submitted \|\| !canReviewBooking\(booking\)/);
  assert.match(portal, /role !== "admin" && canReviewBooking\(booking\)/);
});

test("self-service RPC repair exposes named PostgREST arguments", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261005094000_name_self_service_rpc_arguments.sql", import.meta.url), "utf8");
  for (const [name, firstArgument] of [
    ["upsert_household_member", "p_member_id"],
    ["seller_replace_weekly_availability", "p_weekdays"],
    ["seller_upsert_service_area", "p_service_area_id"],
    ["seller_upsert_service", "p_service_id"],
    ["seller_update_public_profile", "p_display_name"],
  ]) {
    assert.match(sql, new RegExp(`function public\\.${name}\\(\\s*${firstArgument} `));
    assert.match(sql, new RegExp(`select app_private\\.${name}\\(`));
  }
  assert.match(sql, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(sql, /security definer/i);
});

test("notification permissions stay column-scoped and retain RLS", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261005093000_restore_notification_client_permissions.sql", import.meta.url), "utf8");
  assert.match(sql, /grant update \(read_at, archived_at\) on public\.notifications/);
  assert.match(sql, /grant insert \(user_id, event_category, in_app, email\)/);
  assert.doesNotMatch(sql, /disable row level security|grant all/i);
});

test("provider editor waits for saved data and trust labels use approval state", async () => {
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  const studio = await readFile(new URL("../app/app/SellerProfileStudio.tsx", import.meta.url), "utf8");
  assert.match(portal, /sellerWorkspaceLoading \? \([\s\S]*Loading your saved provider profile/);
  assert.match(portal, /key=\{`\$\{currentUserId\}:\$\{JSON\.stringify\(sellerProfileForm\)\}:\$\{liveIslands\.length\}`\}/);
  assert.match(portal, /providerApproved=\{sellerApprovalStatus === "approved"\}/);
  assert.match(studio, /providerApproved \? "Approved care provider" : "Provider preview · not approved"/);
  assert.equal((studio.match(/providerApproved && <i aria-label="Approved provider">/g) ?? []).length, 2);
  assert.doesNotMatch(studio, />Approved healthcare seller</);
});

test("verification feedback survives connected hydration and local review updates", async () => {
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  assert.equal((portal.match(/decisionReason: item\.decision_reason \?\? undefined/g) ?? []).length, 2);
  assert.match(portal, /status: decision, decisionReason: reason/);
  assert.match(portal, /Review feedback:<\/strong> \{item\.decisionReason\}/);
  assert.match(portal, /prev\.kyc\.filter\(\(item\) => item\.id !== caseId\)/);
});

test("private evidence authorization uses stored ownership and short-lived no-store links", async () => {
  const route = await readFile(new URL("../app/api/verification/evidence/route.ts", import.meta.url), "utf8");
  const sql = await readFile(new URL("../supabase/migrations/20261005110000_verification_evidence_access.sql", import.meta.url), "utf8");
  assert.match(route, /authenticatedApiClient\(request\)/);
  assert.match(route, /supabase\.rpc\("verification_evidence"/);
  assert.match(route, /Math\.floor\(Date\.now\(\) \/ 1000\) \+ 120/);
  assert.match(route, /private, no-store/);
  assert.match(route, /publicId\.startsWith\(ownedPrefix\)/);
  assert.match(sql, /v_case\.seller_id <> v_user and not app_private\.has_admin_permission\('kyc.review'\)/);
  assert.match(sql, /insert into public\.admin_access_logs/);
  assert.match(sql, /d\.seller_id=v_case\.seller_id and d\.document_type=v_case\.verification_type/);
});

test("provider publication is explicit, caller-bound and reflected in eligibility", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261005120000_provider_publication.sql", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  assert.match(sql, /v_user uuid := \(select auth.uid\(\)\)/);
  assert.match(sql, /v_profile\.status <> 'approved'/);
  assert.match(sql, /where user_id=v_user for update/);
  assert.match(sql, /coalesce\(v_profile\.profile_published_at,now\(\)\)/);
  assert.match(sql, /active_coverage_required/);
  assert.match(sql, /availability_required/);
  assert.match(portal, /sellerPublicReady = sellerReadyToPublish && sellerPublishedAt !== null/);
  assert.match(portal, /"Unpublish profile" : "Publish profile"/);
});

test("connected message access is database-enforced and simulation remains gated", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261005130000_enforce_conversation_access.sql", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../lib/nanas-api.ts", import.meta.url), "utf8");
  assert.match(sql, /create policy messages_members_only[\s\S]*conversation_is_locked/);
  assert.match(sql, /if not app_private.payment_simulation_allowed\(\)/);
  assert.match(sql, /test_provider_not_enabled/);
  assert.match(sql, /p_expected_amount_minor is distinct from v_amount/);
  assert.match(sql, /revoke update \(last_read_at\)/);
  assert.match(sql, /unique \(conversation_id,buyer_id\)/);
  assert.match(api, /rpc\("mark_conversation_read_through"/);
  assert.match(portal, /if \(backendConnected\) return role === "buyer" && \(conversationAccess/);
  assert.match(portal, /messageSending.current = true/);
  assert.match(portal, /TEST ONLY: unlock this conversation/);
});

test("message notifications are transactional, generic and realtime recipient-scoped", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261005140000_transactional_in_app_notifications.sql", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  assert.match(sql, /create trigger messages_notification after insert/);
  assert.match(sql, /create trigger notification_outbox_in_app after insert/);
  assert.match(sql, /and not cm.muted/);
  assert.match(sql, /on conflict\(dedupe_key\) do nothing/);
  assert.match(sql, /'in_app','nanas-database','delivered'/);
  assert.doesNotMatch(sql, /new\.body|update public.notification_outbox set status='delivered'/);
  assert.match(portal, /filter: `recipient_id=eq.\$\{currentUserId\}`/);
  assert.match(portal, /row.recipient_id !== currentUserId/);
});

test("visit UI fails closed and only reports confirmed check-in", async () => {
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  const sql = await readFile(new URL("../supabase/migrations/20261005150000_enforce_verified_booking_lifecycle.sql", import.meta.url), "utf8");
  assert.match(portal, /if \(!result\?\.ok \|\| !result\.verified\)/);
  assert.match(portal, /if \(!await transition\(booking, "in_progress"\)\) return/);
  assert.match(portal, /No visit code was issued/);
  assert.match(portal, /bookingTransitionPending\.current = true/);
  assert.match(sql, /revoke all on public\.booking_session_codes from public, anon, authenticated/);
  assert.match(sql, /return jsonb_build_object\('ok',false,'error',case when v_attempts=5/);
  assert.match(sql, /verified_session_code_required/);
});

test("double-blind reviews hide pending feedback and are reachable from both roles", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261005160000_double_blind_reviews.sql", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../supabase/functions/maintenance-worker/index.ts", import.meta.url), "utf8");
  const policy = sql.slice(sql.indexOf("create policy reviews_public"), sql.indexOf("-- Keep aggregates"));
  assert.doesNotMatch(policy, /subject_id=/);
  assert.match(policy, /author_id=\(select auth.uid\(\)\)/);
  assert.match(sql, /create trigger reviews_refresh_ratings/);
  assert.match(sql, /review_already_submitted/);
  assert.match(worker, /rpc\("publish_due_reviews"/);
  assert.match(portal, /function renderBookingReviews\(\)/);
  assert.match(portal, /reviewSubmitting.current = true/);
  assert.match(portal, /account-workflow-links/);
});

test("connected finances use recorded balances and preserve simulated capture history", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261005170000_correct_simulated_payment_funding.sql", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  assert.match(sql, /simulation-funding-correction:/);
  assert.match(sql, /p\.processor='simulation'/);
  assert.doesNotMatch(sql, /(?:delete from|update) public\.ledger_entries/i);
  assert.match(portal, /backendConnected \? financeRecords.balance/);
  assert.match(portal, /Payouts not connected/);
});

test("dispute UI uses confirmed responses and retains saved case status", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261005180000_settle_dispute_balances.sql", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  assert.match(sql, /v_remaining := v_payment.captured_minor-v_payment.refunded_minor-v_refund/);
  assert.match(sql, /refund_processor_not_connected/);
  assert.match(sql, /dispute_already_resolved/);
  assert.match(portal, /disputePending.current = true/);
  assert.match(portal, /Saved resolution:.*result.resolution_code/);
  assert.match(portal, /booking.status === "resolved" \|\| booking.status === "confirmed"/);
  assert.match(portal, /Service dispute \{status\(item.status\)\}/);
});

test("cancellation UI previews server amounts and confirms the accepted fee", async () => {
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../lib/nanas-api.ts", import.meta.url), "utf8");
  const sql = await readFile(new URL("../supabase/migrations/20261005190000_validate_cancellation_preview.sql", import.meta.url), "utf8");
  assert.match(portal, /syncCommand\("preview_cancellation"/);
  assert.match(portal, /cancellationPending.current = true/);
  assert.match(portal, /expected_fee_minor: cancellationEstimate\?\.feeMinor/);
  assert.match(portal, /disabled=\{busy \|\| cancellationLoading \|\| !preview\}/);
  assert.match(api, /p_expected_fee_minor: payload.expected_fee_minor \?\? null/);
  assert.match(sql, /p_expected_fee_minor is distinct from/);
  assert.match(sql, /refund_processor_not_connected/);
});

test("notification navigation updates portal state instead of only its URL", async () => {
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  const handler = portal.slice(portal.indexOf("async function openNotification"), portal.indexOf("const recordAdminAudit"));
  assert.match(handler, /route\?\.\[1\] === role/);
  assert.match(handler, /roleNav\[role\]\.some/);
  assert.match(handler, /setSection\(route\[2\], route\[3\]\)/);
  assert.match(handler, /route\[2\] === "bookings" && route\[3\] \? "booking-detail"/);
  assert.doesNotMatch(handler, /router\.push/);
});

test("local lifecycle notifications carry role-qualified destinations", async () => {
  const portal = await readFile(new URL("../app/app/NanasPortal.tsx", import.meta.url), "utf8");
  assert.match(portal, /deepLink: `\/app\/seller\/requests\/\$\{request\.id\}`/);
  assert.match(portal, /deepLink: `\/app\/buyer\/care-requests\/\$\{request\.id\}`/);
  assert.match(portal, /deepLink: `\/app\/seller\/bookings\/\$\{booking\.id\}`/);
  assert.match(portal, /deepLink: `\/app\/\$\{role === "buyer" \? "seller" : "buyer"\}\/messages\/\$\{selected\}`/);
});
