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
pnpm test:app
pnpm lint
pnpm build
pnpm dlx deno@2.9.6 check --no-lock --config supabase/functions/location-points/deno.json \
  supabase/functions/location-points/index.ts \
  supabase/functions/location-meeting/index.ts \
  supabase/functions/location-meeting-terminal/index.ts \
  supabase/functions/location-point-place/index.ts
pnpm dlx deno@2.9.6 test --no-lock --allow-read=supabase/migrations \
  --config supabase/functions/location-points/deno.json \
  supabase/functions/tests/*.test.ts
```

Current automated coverage includes:

- Frontend lint and production build
- Edge Function type checks
- Location recommendation fallback and scoring tests
- RLS/RPC public flow contract tests

## Midpoint recommendations

Each participant chooses public transport, car or walking in the existing departure
form. The result layout, comparison, voting and confirmation flow stay the same.
Old requests without individual modes use the group mode, then public transport.

For time-based recommendations, the server:

1. Combines station and local-area candidates for Seoul, Gyeonggi and Incheon,
   includes candidates near walkers, and spreads the route-query budget across
   neighborhoods. This is a bounded search over existing candidate data, not a
   guarantee of the globally best meeting point.
2. Gets a route for every participant using their selected mode. Missing or invalid
   routes exclude that candidate; times are never invented or modes substituted.
3. Removes candidates that are no faster for anyone and slower for at least one
   person. Of the remaining candidates within five minutes of the shortest maximum
   journey, it prefers the smallest difference between individual times.
4. Breaks ties by maximum time, average time, transfers, walking and place quality.
   The five-minute allowance is an initial product policy to evaluate with usage.

The distance-based option keeps its existing distance scoring. Result ranks use
the existing `recommend_score` field, with lower values ranking first. The default
route-query pool remains 8 candidates (maximum 12), or 16 for car-only time searches
(maximum 20), with four concurrent requests and duplicate requests shared within
one search. Transit requests use one common departure time. The legacy 30-day
route cache is no longer used for these estimates.

### Providers and rollout

- Public transport: [Google Routes transit](https://developers.google.com/maps/documentation/routes/transit-route),
  including supported bus and rail modes.
- Car: [Kakao Mobility directions](https://developers.kakaomobility.com/guide/navi-api/directions.html).
- Walking: [Kakao Map walking routes](https://developers.kakao.com/docs/ko/kakaomap/rest-api).
- Place search and the existing map continue to use Kakao.

Apply `20261027090000_participant_travel_modes.sql` before releasing the new input
flow. It adds a nullable mode and defaulted RPC arguments, so older clients still
work. Kakao routes use the existing `KAKAO_REST_API_KEY`; verify that both routing
APIs are enabled for that app and check its quotas before rollout. This change does
not enable paid services. Automated provider tests use documented response fixtures;
production credentials and live provider coverage are not validated by those tests.

The existing Google route display on a Kakao map and stored-result retention need a
separate provider-policy review. This change preserves that map as requested and
does not resolve those existing issues.
