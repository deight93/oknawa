# OKNAWA

OKNAWA is a midpoint finder built with Next.js, Vercel, and Supabase.

## Structure

```txt
.
├── src/                 # Next.js app source
├── public/              # Frontend static assets
├── supabase/
│   ├── functions/       # Supabase Edge Functions
│   └── migrations/      # Database migrations and RLS/RPC contracts
└── .github/workflows/   # CI and Supabase deployment
```

## Frontend

```bash
pnpm install
pnpm dev
pnpm build
```

The Vercel project uses the repository root as its root directory.

Required Vercel environment variables:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_KAKAOMAP_APP_KEY
NEXT_PUBLIC_BASE_URL
```

`NEXT_PUBLIC_BASE_URL` should point to the production origin, for example
`https://www.oknawa.com`.

## Supabase

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy --project-ref <project-ref>
```

Required Edge Function secrets:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
KAKAO_REST_API_KEY
GOOGLE_API_KEY
GOOGLE_API_URL
OPEN_DATA_API_URL
BUS_TERMINAL_DATA_API_URL
```

The app exposes public user flows through `SECURITY DEFINER` RPCs. Direct anon
table access is revoked by the RLS migration in `supabase/migrations`.

## Deployment

Pushing to `main` triggers:

- Vercel production deployment for the frontend
- GitHub Actions CI
- Supabase migrations and Edge Function deployment when `supabase/**` changes

GitHub Actions production secrets:

```txt
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_REF
```

## Checks

Run these before pushing meaningful changes:

```bash
pnpm agent:harness
```

For a faster static contract pass while editing:

```bash
pnpm agent:harness:quick
```

The harness is documented in `docs/agent-harness.md`.

The underlying checks are:

```bash
pnpm lint
pnpm build
pnpm dlx deno check --config supabase/functions/location-points/deno.json \
  supabase/functions/location-points/index.ts \
  supabase/functions/location-meeting/index.ts \
  supabase/functions/location-meeting-terminal/index.ts \
  supabase/functions/location-point-place/index.ts
pnpm dlx deno test --allow-read=supabase/migrations \
  --config supabase/functions/location-points/deno.json \
  supabase/functions/tests/*.test.ts
```

Current automated coverage includes:

- Frontend lint and production build
- Edge Function type checks
- Location recommendation fallback and scoring tests
- RLS/RPC public flow contract tests
