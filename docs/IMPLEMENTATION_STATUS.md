# Nanas implementation status

Last updated: 24 August 2026

This file traces the local web application to the root PRD. It distinguishes the connected Supabase implementation, deliberately simulated provider integrations, and features that require an approved external provider or policy decision. Nanas has exactly three account entities: buyer, seller, and admin. A seller is an individual healthcare provider; there are no contractor, business, shift, roster, or TaskRabbit-style entities.

## Status legend

- **Connected:** interactive local UI plus the live Nanas Supabase project, schema, RLS, RPCs, and Storage.
- **Local + backend:** interactive local UI plus Supabase schema/RLS/RPC or local Edge Function implementation.
- **Local simulation:** interactive local UI and deterministic scenario state; connected persistence remains to be validated.
- **Backend prepared:** schema, security policy, worker, or webhook is present; remote execution remains to be validated.
- **External gate:** cannot be production-enabled until a provider, credential, legal rule, or operations decision is approved.

## Product and experience

| PRD area | Status | Evidence |
|---|---|---|
| Bahamas healthcare positioning and teal brand | Local + backend | Landing, auth, and portals use `en-BS`, `BSD`, `America/Nassau`, Bahamas service areas, healthcare-only language, and the supplied teal family. |
| Buyer workspace | Connected | Overview, healthcare discovery, favorites, care recipients, requests, quotes, bookings, messages, wallet/receipts, reviews, notifications, safety/support, and privacy/account pages rebuild from participant-scoped Supabase reads after refresh. |
| Seller workspace | Connected | Care opportunities, quote history, bookings/check-in/out, messages, appointment availability, healthcare services/rates, earnings, profile/coverage, KYC, badges/reviews, safety/support, and privacy/account pages rebuild from seller-scoped Supabase reads after refresh. |
| Admin workspace | Connected | Operations, users, KYC, bookings, disputes, purpose-gated message audit, moderation, finance, delivery health, catalog, islands/areas, cases, analytics, access/privacy, workers/integrations, audit, and configuration; operational queues rebuild through admin RLS policies. |
| Responsive experience | Connected | Desktop and 390×844 mobile layouts verified in the in-app browser; mobile navigation opens and exposes all admin sections. |

## Identity, trust, and safety

| Requirement | Status | Evidence |
|---|---|---|
| Email/phone registration and sign-in | Connected | Auth screen supports buyer/seller signup, email/phone password login, email magic link, SMS OTP verification, generic email recovery, role routing, and local sign-out. Auth bootstrap creates only buyer or seller resources; admin cannot be self-selected. |
| Three-role enforcement | Local + backend | Postgres enum is only `buyer`, `seller`, `admin`; role and admin-permission functions include account status checks. |
| Step-up authentication | Connected | A recent Supabase token (`auth_time`, with Supabase `iat` fallback) is enforced in database RPCs for privacy export/deletion, and purpose is required for every admin message read. Payment-provider refund thresholds remain an external policy gate. |
| Seller KYC/healthcare credentials | Local + backend | Private seller-document bucket, signed upload command, seller verification page, verification cases, admin approve/reject/request-info actions, credential expiry worker, and audit tables. |
| Account enforcement | Local + backend | Admin restrict/suspend/ban/restore controls call a transactional audited RPC; suspended accounts fail role checks while retaining database records. |
| Two-party visit code | Local + backend | Buyer-only secure code generation, bcrypt digest, 15-minute window, booking/time scope, seller-only verification, attempt counting, risk signal after failures, then seller check-in. |
| Safety and support | Connected | Booking-scoped urgent alerts, non-emergency guidance, safety incident queue, support case creation/tracking, owner-scoped reads, audited admin assign/acknowledge/resolve actions, and case evidence storage. |
| Privacy | Local + backend | Export/deletion requests, retention/legal-hold entities, private exports bucket, step-up gate, admin privacy queue, and deletion status tracking. |

## Marketplace lifecycle

| Requirement | Status | Evidence |
|---|---|---|
| Healthcare seller discovery | Connected | Approved seller profiles, healthcare services, service areas, availability, languages, credentials, badges, ratings, favorites, matching rules, and public-safe policies hydrate from Supabase. Admin catalog/area edits flow into the buyer builder; seller service, rate, profile, coverage, and availability edits are owner-scoped. |
| Care request and seller quote | Local + backend | Buyer request builder; seller opportunity queue and server-priced quote RPC with expiry, platform fee, policy snapshot, quote hash, notification event, and seller eligibility checks. |
| Booking acceptance/payment | Local + backend | Atomic quote acceptance creates the booking, protects the seller calendar, captures a simulated payment idempotently, creates buyer/protected ledger entries, conversation, participants, events, and notifications. |
| Visit lifecycle | Local + backend | Confirmed → code-verified in progress → seller checkout/completion pending → buyer completion → idempotent balanced seller/platform release. |
| Cancellation/refund | Local + backend | Actor/time-based preview, immutable decision record, booking lock, idempotent cancellation, payment refund state, refund record, balanced protected-funds reversal, fee allocation, event, and party notifications. |
| Disputes | Local + backend | Participant case opening, booking dispute state, evidence context, admin permission gate, purpose/audit logging, reasoned resolution control, and finance follow-up data model. |
| Messages | Local + backend | Booking conversations, membership RLS, sender nonce, notification outbox, read state, private attachments, moderation fields, and purpose-gated audited admin access. |
| Reviews and badges | Local + backend | Completed-booking eligibility, double-blind publication window, rating aggregate update, moderation/report entities, versioned badge rules, awards, and seller UI. |
| Wallets, earnings, receipts, payouts | Local + backend | Immutable double-entry ledger, protected balance, simulated captures/refunds/releases, seller earnings and admin reconciliation views, receipt/statement bucket and records, payout/payout-item tables. Real payout onboarding is an external gate. |

## Supabase platform coverage

| Area | Status | Evidence |
|---|---|---|
| Database | Connected | The `Nanas` project (`dmyaqoiwjnjhxlzlxfga`) contains 112 public PRD tables and 28 applied migrations for identity, catalog, coverage, availability, requests/offers/quotes/bookings, sessions, conversations, money, reviews/badges, cases, moderation, notifications, privacy, risk, analytics, integrations, and audit. |
| RLS and least privilege | Connected | RLS is enabled on every public table; participant/owner/admin policies, column-scoped client grants, transactional state/money RPCs, wildcard-compatible admin permission checks, and audited sensitive reads were exercised live. Internal-only tables deliberately have RLS with no client policy, producing deny-by-default advisor notices. |
| Storage | Connected | Private buckets exist for seller documents, booking attachments, case evidence, receipts/statements, and exports, with owner/admin path policies. Cloudinary migration is intentionally deferred. |
| Edge Functions | Local + backend | Marketplace/admin routers, upload issuance, notification/maintenance workers, and verified webhook sources remain local and intentionally undeployed while the site stays local. Connected browser commands currently use equivalent database RPCs and Storage directly. |
| Notifications | Connected | Transactional outbox rows, templates/preferences, dedupe keys, party events, retry/dead-letter schema, and delivery-health UI are live. Email/SMS/push credentials and worker deployment are external/local-release gates. |
| Webhooks | Backend prepared | Signature verification, replay-safe event IDs, redacted payload storage, and payment/identity/delivery handlers. Processor/vendor-specific mappings are external gates. |
| Scheduled work | Backend prepared | Ten local worker definitions are registered with schedules and health state; credential expiry, quote/request expiry, notification processing, privacy/retention, badge/reconciliation hooks, job run/dead-letter records, and worker health UI remain intentionally undeployed. |

## Verified connected scenarios

All browser actions below were performed in the in-app browser, not a standalone Playwright runner.

1. Buyer, seller, and admin authenticated with separate live accounts; connected mode allowed only the role granted in `user_roles`.
2. Buyer posted a Bahamas senior-care request; the live request UUID, BSD budget, service, area, time, and safe summary were verified in Postgres.
3. Seller opened that opportunity and submitted a live server-priced quote; buyer accepted it and created a confirmed booking, conversation, captured simulated payment, and balanced protected-funds ledger transaction.
4. Buyer sent a booking-scoped secure message. RLS denied the initial missing-grant path; a least-privilege migration corrected it, and the live message then persisted successfully.
5. Buyer generated a short-lived six-digit visit code; seller signed into the seller account, verified the bcrypt-backed code, checked in, and checked out; buyer confirmed completion.
6. Completion released seller/platform simulated funds exactly once. The booking ledger netted to zero and seller completion count advanced once.
7. Buyer submitted a completed-booking review; the review was stored in the double-blind `pending_peer` state.
8. Buyer opened a live service dispute. Admin resolved it with a permission-gated RPC; the booking moved to resolved, one immutable audit row was added, and no duplicate release transaction was created.
9. Admin restricted and then restored the live buyer. The final account status is active and both actions remain in the audit log.
10. Admin accessed the live conversation only after selecting `dispute-review`; `admin_access_logs` records the purpose and exact fields accessed.
11. A live manual verification case was loaded into the admin KYC queue and approved; case, seller document, seller status, reviewer, decision time, notification, and audit state all updated.
12. A second live booking exercised cancellation: full refund `BSD 86.40`, payment status `refunded`, cancellation/refund records, and a zero-net double-entry ledger.
13. `npm test`/lint/production build and rendered-page/database/storage contracts pass with connected environment values. All UI actions were performed through the in-app browser, not a standalone Playwright runner.
14. A protected buyer privacy-export request passed the recent-token gate and stored its identity verification timestamp; a live buyer support case reached the admin operations queue.
15. Safety RLS accepted a booking participant's alert and rejected a non-participant insert. The checks were transactionally rolled back after validation.
16. The database advisor hardening migration added aggregate primary keys, indexed all 157 previously unindexed foreign keys, and removed all overlapping permissive-policy warnings. The remaining performance notices are unused-index statistics expected on this new test database.
17. In-app browser testing exposed and verified a repair for server/client hydration drift by replacing dynamic demo seed timestamps with a deterministic clock.
18. The browser-only cache was reset, then buyer, seller, and admin signed in again. Buyer recovered two requests, two bookings, the secure message, support case, and privacy export; seller recovered two historical quotes, two bookings, earnings, messages, and approved KYC; admin recovered all bookings and the support queue. Every dataset is now queried separately under its own RLS policy.
19. Seller request-history RLS now retains access after marketplace closure only when that seller submitted a quote or became the booked seller. This repaired refresh-safe quote history without exposing unrelated closed requests.
20. The final local suite now contains five passing rendered/application/database/storage contracts, including explicit coverage that connected portal hydration uses table-level RLS and no broad snapshot RPC.
21. Connected seller discovery now uses the public-safe `seller_directory`; an active buyer favorite persisted, and an ineligible Freeport on-demand request was hidden from the Nassau seller and rejected by the quote RPC.
22. A live moderation report was resolved through the admin UI with a proportionate moderation action and immutable audit row; the badge evaluator recorded six rule evaluations and awarded the eligible seller badge.
23. Admin support-case assignment and resolution and safety-incident acknowledgement and resolution were exercised in the in-app browser; owner admin, timestamps, final statuses, domain events, and four audit actions persisted.
24. Feature-flag editing initially exposed a missing table update grant. It was repaired with a permission-checked audited RPC; `cloudinary_uploads` was enabled, verified, then restored to disabled for the current Supabase Storage phase.
25. Admin created a temporary healthcare service and Bahamas coverage area, both appeared in the buyer request builder, and both were then retired through the same audited editors. The six launch services and three launch areas remain active.
26. Buyer created a private care recipient through the owner-scoped RPC. Seller weekly availability was rebuilt as Monday–Friday 08:00–17:00 through an owner-scoped transactional RPC; connected service/rate, profile, and coverage editors hydrate from the seller tables.
27. The final direction-aware ledger audit found four transactions and zero unbalanced transactions. The final security advisor found no exposed `SECURITY DEFINER` warnings after the self-service functions were moved behind public invoker wrappers.

## Remaining production gates

These are not silently represented as production-ready:

- Select a Bahamas-capable payment/platform-payout provider and configure only hosted/tokenized payment, refund, dispute, and seller payout flows. Current money movement is intentionally simulated.
- Configure approved email, SMS, and push vendors, domains, templates, opt-out policy, and sender credentials.
- Configure an approved identity/background-check provider and operational adjudication policy.
- In the Supabase Dashboard Auth settings, disable anonymous sign-ins and enable leaked-password protection. The connected database advisor flags both project-level settings; the plugin cannot change Auth configuration, and the in-app browser currently requires a Supabase Dashboard sign-in.
- Perform legal, safeguarding, healthcare-provider eligibility, insurance, tax, cancellation, retention, and emergency-copy review for The Bahamas.
- Complete production release testing: automated live RLS matrix, high-concurrency double-accept/refund/release tests, webhook signature/replay tests against selected vendors, accessibility audit, load test, backup/restore drill, and vendor-failure runbooks.
