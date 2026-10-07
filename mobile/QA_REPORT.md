# Nanas mobile connected QA

Last full local pass: 2026-10-07

## Verified

- Buyer and provider authentication, role isolation and workspace routing
- Every buyer and provider section query under Supabase RLS
- Provider discovery, request posting, recurring schedule persistence, quotes and simulated booking payment
- Messaging anti-bypass lock, simulated unlock, send/read state and outsider denial
- Booking emergency contacts, visit codes, check-in, visit updates, checkout, completion, cancellation, refund and dispute
- Favorites, reviews, support, safety, notification preferences, privacy export, wallet, receipts, ledger and earnings
- Provider availability, services/rates, public profile, coverage, publication and verification records
- Signed Cloudinary profile uploads, protected verification uploads, verification and cleanup
- Phone layouts at 320x568 and 390x844, tablet at 768x1024 and desktop web at 1440x900 with no horizontal overflow
- Production bundle exports for iOS, Android and web
- Expo SDK 57 dependency compatibility (`expo-doctor` 21/21 checks)

## Passing commands

From the repository root:

```bash
node scripts/mobile-connected-qa.mjs
node scripts/mobile-cloudinary-qa.mjs
npm test
```

From `mobile/`:

```bash
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform ios --output-dir <temporary-directory>
npx expo export --platform android --output-dir <temporary-directory>
npx expo export --platform web --output-dir <temporary-directory>
```

The connected suites use isolated fictional QA accounts and simulated payments only. They rotate those QA passwords on every run and do not place a service-role key or Cloudinary secret in the mobile bundle.
