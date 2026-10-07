# Nanas mobile

Native client and care-provider application for Nanas, built with Expo SDK 57, React Native 0.86, React 19.2, TypeScript and Expo Router.

The mobile app uses the existing Nanas Supabase project and its row-level security policies. It intentionally contains no administrator workspace; administration stays in the existing web panel.

## Exact mobile scope

Client sections mirror the web workspace:

- Overview
- Find care
- Care requests
- Quotes
- Bookings
- Messages
- Payments & wallet
- Reviews
- Favorites / My Nanas
- Care recipients
- Notifications
- Safety & support
- Account & privacy

Provider sections mirror the web workspace:

- Overview
- Care requests
- My quotes
- Bookings
- Messages
- Availability
- Services & rates
- Earnings
- Profile & coverage
- Verification
- Badges & reviews
- Notifications
- Safety & support
- Account & privacy

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the existing Supabase public URL and publishable key. Never add a secret or service-role key to the mobile app.
3. Run `npm start` and scan the QR code with Expo Go.

Useful checks:

```bash
npm run typecheck
npm run lint
npm run doctor
```

## Architecture

- `src/app` contains only Expo Router routes.
- `src/contexts/session.tsx` owns Supabase session and buyer/provider role selection.
- `src/lib/section-data.ts` maps every mobile section to the existing database/RPC surface.
- `src/components/section-screen.tsx` provides the shared native shell, menus, bottom navigation, loading, error and empty states.

The application does not embed server credentials. Supabase RLS remains the security boundary, matching the web application.
