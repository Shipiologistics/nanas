# Nanas mobile app mockup pack

These boards translate the current Nanas web product into a native mobile information architecture for clients, care providers, and administrators. They are visual direction and flow references for the Expo/React Native build; they are not implementation screenshots.

## Boards

1. `01-discovery-onboarding.png` — splash, home, categories, search, provider profile, care request, sign in, role selection
2. `02-client-experience.png` — client dashboard, requests, quotes, bookings, My Nanas, household, emergency contacts, account
3. `03-provider-experience.png` — provider dashboard, request feed/detail, quote creation, bookings, visit updates, profile studio, earnings
4. `04-match-trust-payments.png` — Nanas Match, Care Advisor, post request review, recurring care, locked messaging, simulated checkout, notifications, Gift of Care
5. `05-admin-operations.png` — admin overview, verification queue/review, users, bookings, disputes, finance, system health
6. `06-support-safety-onboarding.png` — How It Works, safety, service guides, provider onboarding, identity check, reviews, help, settings

## Planned navigation

### Client tabs

- Home
- Search
- Requests
- Bookings
- Saved / My Nanas

Messages, notifications, wallet/payments, household, emergency contacts, gifts, help, and account open from the header or contextual actions.

### Provider tabs

- Dashboard
- Requests
- Bookings
- Messages
- Profile

Earnings, verification, credentials, availability, service areas, payouts, reviews, and settings live under the relevant tab or profile menu.

### Admin tabs

- Overview
- Providers
- Bookings
- Finance
- More

More includes users, marketplace/services, disputes, reviews, message audit, reports, notification operations, worker health, and feature flags.

## Screen inventory for implementation

The six boards visualize 48 representative screens. During implementation, several boards expand into detail and state variants:

- Public/auth: splash, home, category index, service guide, provider search, filters, provider profile, request intake, sign in, sign up, password recovery, role choice, How It Works, safety, help.
- Client: dashboard, requests, request detail, post-request wizard, quote comparison/detail, bookings, booking detail, recurring schedule, visit updates, messages, messaging paywall, notifications, My Nanas, household, emergency contacts, payment method, secure checkout, wallet/gift balance, Gift of Care, reviews, account, settings.
- Provider: dashboard, request feed/detail, quote composer, bookings/detail, visit check-in/update/check-out, messages, notifications, profile studio/preview, services and pricing, availability, service areas, onboarding, identity and credentials, earnings, payouts, reviews, account, settings.
- Admin: overview, verification queue/detail, users/detail, providers, marketplace/services, bookings/detail, disputes/detail, reviews/moderation, message audit, finance summary, payments, refunds, payouts, ledger, reports, notifications/dead letters, worker health, feature flags, settings.
- Shared states: loading, empty, offline, validation, permission denied, destructive confirmation, payment success/failure, notification deep links, and accessibility variants.

## Implementation note

Before starting development, confirm the current Expo SDK and React Native versions from the official Expo compatibility matrix, then pin those versions in the project. The build should target the current App Store-supported iOS toolchain and include Android from the same codebase.

## Visual-generation record

- Tool mode: generated from text prompts with local Nanas QA screenshots supplied as style references.
- Intent: preserve the current Nanas brand while translating web layouts into native mobile patterns.
- Shared prompt direction: deep forest teal, sea-glass accents, warm ivory, editorial serif headings, accessible sans-serif UI, rounded cards, Bahamas context, native iOS proportions.
