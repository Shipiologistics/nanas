# Nanas end-to-end manual QA report

**Date:** 27 August 2026
**Environment:** Local vinext dev server at `http://localhost:3000`, Codex in-app browser, desktop viewport
**Data mode:** Local buyer/seller/admin simulation backed by shared browser storage; Supabase is configured but no live test-account credentials were supplied
**Payment mode:** Simulated posting fees, booking capture, refund, release, and payout only

## Release recommendation

**NO-GO.** The core request-to-quote-to-booking journey is demonstrable, but buyer discovery crashes, the demo repeatedly hydrates incorrectly, conversation paywalls expose locked content and unlock without checkout, refunded money remains charged in the wallet, and privileged admin actions are not visible in the audit log. These defects prevent reliable acceptance testing and make the current build unsuitable for production release.

## Coverage summary

| Area | Result | Notes |
|---|---|---|
| Public landing, services, safety, seller profile pages | Partial pass | Pages render; public filtering and profile trust/availability data are inconsistent. |
| Authentication UI | Pass with limitation | Login, email/phone, OTP/recovery entry points, and buyer/seller-only signup roles render. No live account was created. |
| Buyer request intake | Pass | Completed all 12 senior-care steps, validation, premium plan selection, and simulated posting payment. |
| Buyer discovery/favorites | Fail | Authenticated/demo Find Care crashes. Public directory filters are non-functional. |
| Seller opportunity discovery and quote | Pass | Search/filter, request details, pricing, quote submission, and buyer delivery worked. |
| Quote acceptance and booking payment | Pass | Simulated capture created a confirmed booking and conversation. |
| Cancellation/refund | Fail | Cancellation status and refund toast work, but buyer/admin financial views still include the refunded charge and fee. |
| Visit code/check-in/out/completion | Blocked | Buyer code generation works, but the local code is component state and cannot be verified by the seller in another role/tab. |
| Messaging | Partial pass | Two-way messages persist across role refreshes; paywall and notification behavior are defective. |
| Notifications | Partial fail | Buyer quote notification/read state works; message notifications, seller notification route, and preference persistence fail. |
| Reviews | Pass | A completed booking accepted one verified review and disabled duplicate submission. |
| Buyer care recipients/privacy/support/safety | Pass with gaps | Recipient, export request, support case, and urgent incident reached admin; privacy queue has no processing actions. |
| Seller services/rates/availability/profile/coverage | Partial pass | Edits save; profile availability summary becomes stale. |
| Seller KYC | Pass with admin gap | Private test image entered KYC and reached admin; admin cannot view evidence before deciding. |
| Seller earnings/payout | Partial fail | Available balance is limited to completed care, but history labels cancelled/confirmed amounts as earnings and payout scheduling changes no state. |
| Admin users/KYC/bookings/cases/messages | Partial pass | Main actions work in simulation; several compliance controls and summaries are missing or inconsistent. |
| Admin finance/analytics/audit | Fail | Captured GMV is zero, refunded fees remain counted, and the audit log stays empty after privileged actions. |
| Admin catalog/areas | Fail in demo | Existing launch records do not render; service creation has an empty category selector. |
| Build | Pass | `npm run build` completed. |
| Lint/full test command | Fail | Three `react-hooks/set-state-in-effect` lint errors stop `npm test`. |
| Contract tests | Fail | 9 passed, 1 failed: stale expectation for “Advanced healthcare seller filters.” |

## Defects

### QA-001 — P0 — Buyer Find Care crashes

**Route:** `/app/buyer/find-care?demo=1&reset=1`

**Steps:** Open Buyer demo, navigate to Find care, or load the route directly.
**Actual:** Runtime error: `Cannot read properties of undefined (reading 'length')` at `publicReadySeller`, `NanasPortal.tsx:5032`, while reading `details.credentials.length`.
**Expected:** Eligible seller cards and filters render; missing credential/safety arrays are treated as empty.
**Impact:** The primary buyer discovery feature is unusable.

### QA-002 — P1 — Demo portals hydrate with different server/client content

**Routes:** Buyer, seller, and admin demo routes.
**Actual:** Every fresh demo route can show an “Unhandled Script Error” hydration overlay. Server markup says `Connected` / `Supabase connected` or `Loading profile`; client markup switches to `Local` / `Local simulation` and loaded values.
**Expected:** Server and first client render match.
**Evidence:** The browser repeatedly logged React hydration mismatch errors. Lint also flags the synchronous effect updates at `NanasPortal.tsx:1066`, `1072`, and `1118`.

### QA-003 — P1 — Demo navigation drops demo context

**Steps:** Enter `/app/buyer/overview?demo=1&reset=1`, then click the primary `Find care` link.
**Actual:** Navigation lands on `/app/buyer/find-care` without `demo=1`. The portal can switch toward connected/anonymous state and crash.
**Expected:** Demo mode remains stable across all role navigation or is stored independently of the query string.

### QA-004 — P1 — Locked conversation content is exposed and upgrade has no checkout

**Route:** `/app/buyer/messages?demo=1`

**Steps:** Have the seller send the buyer a booking message, then open the buyer conversation.
**Actual:** The UI says `Upgrade to view seller reply`, but the full seller message text is already rendered underneath the upgrade panel. Clicking `Upgrade to view` instantly unlocks the conversation with no plan, price, confirmation, or simulated payment.
**Expected:** Locked content is absent from the DOM/accessibility tree until an authorized entitlement exists, and a paid upgrade uses a clear checkout/payment record.

### QA-005 — P1 — Simulated refund does not reverse the buyer wallet

**Steps:** Accept the post-hospital quote for BSD 152, preview a 0% cancellation fee, and confirm the simulated refund. Open `/app/buyer/wallet?demo=1`.
**Actual:** Booking becomes `cancelled` and toast says the refund/ledger reversal was recorded, but balance remains `-$410.00`, including the cancelled BSD 152 charge. Transaction history contains the cancelled charge and no refund/reversal entry.
**Expected:** Balance is `-$258.00` for the remaining BSD 164 confirmed plus BSD 94 completed bookings, with an explicit BSD 152 refund/reversal.

### QA-006 — P1 — Admin finance contradicts booking/payment state

**Route:** `/app/admin/finance?demo=1`

**Actual:** `Captured volume` is `$0.00` despite a completed BSD 94 booking and a confirmed BSD 164 booking. `Platform fees` is `$32.00`, including the fully refunded cancelled booking fee. Cancelled, confirmed, and completed booking amounts are all shown as ledger transactions without reversal detail.
**Expected:** Captured/protected/refunded/released totals reconcile to booking status and sum to the immutable ledger.

### QA-007 — P1 — Admin audit log stays empty after privileged actions

**Route:** `/app/admin/audit?demo=1`

**Steps performed before opening the log:** Restrict and restore a buyer, approve KYC, resolve a dispute, purpose-open a conversation, acknowledge/resolve a safety incident, resolve a support case, and edit a posting plan.
**Actual:** Screen shows `0 recent privileged action(s)` and `0 sensitive read(s)`, although each action toast claimed an audit event was recorded.
**Expected:** Each privileged action and sensitive read appears with actor, target, reason/purpose, timestamp, and result.

### QA-008 — P1 — Dispute can be resolved without evidence, outcome choice, or reason

**Route:** `/app/admin/disputes?demo=1`

**Actual:** `View evidence` has no visible effect. `Resolve case` immediately resolves and releases simulated funds using fixed text; no outcome, amount, note, or rationale is collected.
**Expected:** Evidence context opens first, then the admin chooses a supported resolution and enters a required reason before any ledger-affecting action.

### QA-009 — P1 — Admin KYC decision does not expose the uploaded evidence

**Route:** `/app/admin/kyc?demo=1`

**Actual:** A pending uploaded file appears only as type, seller, date, and status. There is no document-view/download action or decision-reason field. Admin can approve/reject/request-info, including on an already approved row.
**Expected:** Purpose-gated evidence viewing, transition validation, and a required decision reason precede approval/rejection.

### QA-010 — P2 — Seller notification button opens Account & Privacy

**Steps:** From seller messages/bookings, click the unread notification bell.
**Actual:** URL changes to `/app/seller/notifications`, but main content is `Account & privacy`; notification rows cannot be read or marked read.
**Expected:** Seller notifications page with event list and read state.

### QA-011 — P2 — Message events do not create recipient notifications

**Steps:** Seller sends buyer a new booking message.
**Actual:** Buyer conversation contains the message after refresh, but unread notification count and notification list do not gain a message event. Quote submission does create a buyer notification.
**Expected:** Message notification is generated according to preferences/deduplication rules.

### QA-012 — P2 — Notification preferences are not persisted

**Route:** `/app/buyer/account?demo=1` (same renderer affects seller account)
**Actual:** Unchecking `Messages notification preference` shows a saved toast, but a fresh navigation resets it to checked.
**Expected:** Preference persists per user and controls event delivery.

### QA-013 — P2 — Local visit code cannot complete the cross-role journey

**Steps:** Buyer generates a 6-digit code in one role/tab; seller enters the same code in seller booking details.
**Actual:** Seller receives `The visit code is incorrect or expired.` because demo codes live only in the buyer component's `sessionCodes` state.
**Expected:** Shared simulated storage or backend state lets the other booking participant verify the code, check in, check out, and complete the visit.

### QA-014 — P2 — Public seller filters are no-ops

**Route:** `/find-care`

**Steps:** Select `Home nursing` and `Nassau`, then click `Search sellers`.
**Actual:** The URL receives filter query parameters, but the rendered selectors reset to `All` and all four sellers remain visible.
**Expected:** Selected filters persist and results narrow to eligible matches.

### QA-015 — P2 — Public profile trust and availability conflict with seller data

**Route:** `/providers/alicia-m`

**Actual:** Profile banner says approved, but Safety says `Not on file`; every August day is unavailable and weekly hours say `Ask about availability`, despite seller weekly availability. Review count is 42 publicly versus 18 in seller workspace. Public rate remains `$32–$42` after the seller demo saves `$32–$43`.
**Expected:** One authoritative public-safe projection for approval, safety labels, rates, reviews, and availability.

### QA-016 — P2 — Seller availability summary becomes stale

**Steps:** Save Mon–Fri 08:00–17:00 with Saturday disabled in `/app/seller/availability?demo=1`; open seller profile.
**Actual:** Availability page is correct, but profile summary still lists `Mon, Tue, Wed, Thu, Fri, Sat`.
**Expected:** Profile summary immediately uses the saved availability rows.

### QA-017 — P2 — Payout simulation records no payout state

**Route:** `/app/seller/earnings?demo=1`

**Actual:** Clicking `Simulate payout` only shows `Simulated payout scheduled`; available balance remains BSD 86 and no payout history/status/reference appears. Earnings history also labels confirmed and cancelled net amounts as `Care earnings`.
**Expected:** A simulated payout record moves eligible funds to pending/paid once and excludes cancelled/unreleased amounts from earnings.

### QA-018 — P2 — Admin demo KPIs and analytics are inconsistent

**Actual:** Admin overview reports 0 active users, 0 KYC queue, and 0 active bookings while user, KYC, and booking pages contain data. Analytics shows `67% · 2/3 care requests confirmed`, counting a cancelled booking in the fulfilled numerator, and `SIMULATED GMV $0.00`.
**Expected:** All summaries derive from the same scenario state and use status-accurate definitions.

### QA-019 — P2 — Catalog and area administration are empty/broken in demo

**Routes:** `/app/admin/catalog?demo=1`, `/app/admin/areas?demo=1`

**Actual:** Existing launch services, islands, and areas do not render. `Add healthcare service` opens with an empty `Category` selector, so a valid service cannot be created.
**Expected:** Seeded launch catalog/coverage renders and can be edited, created, retired, and propagated to buyer/seller flows.

### QA-020 — P2 — Privacy requests cannot be processed by admin

**Route:** `/app/admin/access?demo=1`

**Actual:** Buyer export request reaches the queue, but there are no assign/start/complete/reject/download actions or operational notes.
**Expected:** Authorized admin can process the case through its lifecycle with step-up and audit controls.

### QA-021 — P2 — Message audit records a generic purpose, not a case context

**Route:** `/app/admin/messages?demo=1`

**Actual:** Admin selects only a purpose label such as `Dispute review`; no dispute/support/safety/moderation case ID is required. Any booking conversation can then be opened.
**Expected:** Purpose plus an authorized existing case is validated and recorded before access.

### QA-022 — P2 — Existing contract and lint checks fail

**Commands:**

- `npm test` stops at lint with three `react-hooks/set-state-in-effect` errors.
- `npm run test:contracts` returns 9 pass / 1 fail because the buyer workspace test still expects `Advanced healthcare seller filters`.
- `npm run build` passes.

### QA-023 — P3 — Some required intake fields lack robust labels/required cues

**Route:** Buyer request step 3 and location step.
**Actual:** Gender and age `<select>` controls have no programmatic label association (`getByLabel` cannot locate them), and Postal/ZIP blocks progress despite not being visibly marked required.
**Expected:** Explicit label/control association, required indicators, and inline validation messages.

## Verified working scenarios

1. Buyer completed a 12-step senior-care request and paid a simulated BSD 19 premium posting fee.
2. Admin changed the premium fee to BSD 20 in the same scenario; the buyer paywall immediately displayed BSD 20.
3. Seller searched active care requests and submitted a BSD 152 itemized quote; buyer received the quote notification and accepted it.
4. Quote acceptance created a confirmed booking and booking-scoped conversation with a simulated payment toast.
5. Seller and buyer exchanged two secure booking messages; both persisted across role refreshes.
6. Buyer cancelled a future booking; the preview calculated 0% fee and BSD 152 refund, and booking status changed to cancelled (financial presentation defects remain above).
7. Buyer submitted one verified review for a completed booking; duplicate review submission became disabled.
8. Buyer created a fictional private care recipient and a privacy export request.
9. Buyer opened a support case and a booking safety alert; both appeared in the admin operations queue.
10. Admin acknowledged/resolved the safety alert and resolved the support case with operational notes.
11. Seller edited a service rate, weekly availability, profile coverage, and uploaded a non-sensitive image fixture to the private KYC queue.
12. Admin approved the pending KYC row, restricted/restored the buyer, and purpose-opened a two-message conversation.
13. Production build completed successfully.

## Untested external/live gates

- Real card authorization/capture/refund/payout and saved payment methods: no payment processor is configured; only the documented local simulation was exercised.
- Email, SMS, and push delivery: vendors/workers are intentionally unconfigured/local, so only in-app scenario notifications were testable.
- Live Supabase authentication/RLS/storage with separate buyer, seller, and admin accounts: no test credentials were provided. The upload exercised the local demo queue, not a production vendor.
- Identity/background-check vendor, real KYC document review, webhook signatures, scheduled workers, mobile native apps, load, concurrency, and accessibility conformance require separate release testing.

## Recommended fix order

1. Fix QA-001 to QA-007 before further acceptance testing.
2. Make demo/connected mode server-stable and preserve mode across navigation.
3. Treat paywall authorization as server/data-state enforcement; never render locked message bodies.
4. Reconcile payment/refund/release/payout summaries from one direction-aware ledger source.
5. Require evidence, case context, reason, and auditable outcome for every privileged admin action.
6. Repair notifications, public discovery, and authoritative public seller projection.
7. Restore green lint and contract tests, then rerun the complete manual matrix with live role credentials and configured test vendors.

## Post-fix verification — 27 Aug 2026

All locally reproducible issues QA-001 through QA-023 were addressed and regression-tested.

- Buyer Find Care no longer crashes on sellers with optional credential arrays; demo rendering is hydration-stable and all role/navigation links preserve `?demo=1`.
- Locked messages are absent from the DOM until a priced simulated checkout is confirmed. Sending a message now creates an in-app notification for the other booking participant.
- Cancellation fees/refunds, buyer balance, admin captured volume/platform fees, seller earnings, and persisted payout history now reconcile from booking status.
- Visit codes, demo state, notification preferences, and admin operations/audit state persist across role navigation and reloads.
- Seller notifications route correctly; weekly availability updates the seller record; the public Alicia profile reads the saved demo seller projection and the reviewed public seed is consistent.
- Admin demo KPIs, analytics GMV/conversion, launch catalog, islands/areas, privacy processing, KYC evidence/reasons, dispute evidence/outcomes, case-bound message access, sensitive reads, and privileged audit entries are functional.
- Public `/find-care` applies `service`, `area`, and `sort` query parameters and preserves the selected controls.
- Required intake controls now expose explicit accessible names and visible required cues.

Regression evidence:

- `npm test`: lint passed, production build passed, 10/10 rendered contract tests passed.
- Manual browser: buyer crash/navigation, paywall payment, quote payment/cancellation/refund, seller payout, seller notifications, cross-role visit code, message notification, KYC decision/audit, dispute outcome, privacy processing, catalog/KPIs/finance, public filtering, and public profile consistency passed.
- Live Supabase accounts, external payment processor, email/SMS/push vendors, and third-party KYC/background vendors remain external release gates as described above.
