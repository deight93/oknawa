# OKNAWA

Next.js frontend and Supabase backend configuration for OKNAWA.

## Structure

```txt
.
├── src/          # Next.js app source
├── public/       # Frontend static assets
└── supabase/     # Supabase CLI config, migrations, and Edge Functions
```

## Frontend

```bash
pnpm install
pnpm dev
pnpm build
```

The Vercel project can keep using the repository root as its root directory.

## Supabase

```bash
supabase link --project-ref <project-ref>
supabase functions deploy --project-ref <project-ref>
```

Migrations and Edge Functions live under `supabase/`.
