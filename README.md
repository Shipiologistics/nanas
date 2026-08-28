# Nanas healthcare marketplace

Buyer, individual healthcare seller, and operations portals for Nanas in The
Bahamas. The application uses native Next.js App Router and Supabase.

## Local development

Requirements:

- Node.js 22
- npm
- A Supabase project when testing connected mode

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The complete local demo remains available by adding `?demo=1` to a portal URL,
for example `/app/buyer/overview?demo=1`.

## Environment variables

Configure these for Development, Preview, and Production in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_PRESET`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_DEFAULT_CURRENCY`
- `NEXT_PUBLIC_DEFAULT_TIMEZONE`

Only the Supabase publishable key belongs in browser configuration. Do not add
a Supabase secret or service-role key with a `NEXT_PUBLIC_` prefix. Connected
browser requests remain scoped by Supabase Auth and Row Level Security.

Cloudinary image uploads are signed by authenticated Nanas API routes and sent
directly from the browser to Cloudinary. `CLOUDINARY_API_SECRET` must remain a
server-only Vercel secret. The cloud name is intentionally duplicated in
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` for optimized public image delivery. The
configured upload preset must be signed; profile images are public and
verification images use Cloudinary's authenticated delivery type. Verification
PDFs continue to use the private Supabase document bucket.

Use the canonical production origin for `NEXT_PUBLIC_APP_URL`, such as
`https://nanas.example`, so canonical and social-preview metadata are trusted
and stable. Preview projects may override it with their preview origin when
metadata validation is required.

## Verification

```bash
npm test
```

This runs ESLint, a native Next.js production build, starts the production
server on a test port, and executes the rendered route contracts.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Set the Root Directory to `web` if the repository root is the parent folder.
3. Keep the detected Framework Preset as Next.js and leave the output directory
   unset.
4. Add the environment variables above for the required environments.
5. Deploy, then add the final production URL to the Supabase Auth URL
   configuration and allowed redirect URLs.
6. Apply the checked-in Supabase migrations so seller profile RPC validation
   accepts owner-scoped Cloudinary asset references.

Vercel uses `npm ci` and `npm run build`; `vercel.json` explicitly confirms the
Next.js framework preset.

# nanas
