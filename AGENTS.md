# Repository guide

These are the shared instructions for coding agents working on OKNAWA.
Keep common guidance here; `CLAUDE.md` imports this file.

## Project map

OKNAWA finds meeting points for participants using Next.js, Vercel and Supabase.
Read [README.md](README.md) for setup, environment variables and deployment details.

- `src/app/`: Next.js routes and providers.
- `src/views/` and `src/components/`: page content and shared UI.
- `src/hooks/`, `src/services/` and `src/jotai/`: flows, API calls and client state.
- `supabase/functions/`: Deno Edge Functions and shared recommendation logic.
- `supabase/migrations/`: database schema, RLS policies and public RPC contracts.
- `tests/` and `supabase/functions/tests/`: application, SQL and function tests.
- `scripts/agent-harness.mjs`: static contracts and the combined verification runner.

## Local development

Use Node.js 20 to match CI and the pnpm version pinned in `package.json`.
Use pnpm for dependencies and keep `pnpm-lock.yaml` consistent with package changes.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm build
```

## Verification

- Run `pnpm agent:harness:quick` while editing for static contract checks.
- Before committing feature changes, run `pnpm agent:harness`. It includes the
  dependency audit, application/SQL tests, lint, build and Deno checks/tests.
- For documentation-only changes, check referenced paths and commands and run
  `git diff --check`; a full application build is not required.
- For UI or routing changes, also follow the manual smoke checklist in
  [docs/agent-harness.md](docs/agent-harness.md).
- Report which checks ran and any failures or skipped checks. Fixture-based
  provider tests do not verify live credentials, provider coverage or deployment.

## Public flow contracts

- Preserve participant `full_address`, meeting purpose and individual travel modes
  through both individual and together search flows.
- Keep voting, confirmation, retry and room navigation consistent. Retrying a
  confirmed result restarts voting; room recommendation status drives participants
  to the result page. See [room reliability](docs/room-recommendation-reliability.md).
- Preserve public RPC and RLS boundaries, including host controls and each
  participant's private edit capability. Do not restore direct anon table access.
- Add database changes as new migrations. When request shapes, permissions or flow
  behavior change, update the relevant harness contracts and regression tests.

## Deployment and configuration

- A push to `main` triggers production frontend deployment. Changes under
  `supabase/` or to its deployment workflow also trigger production Supabase
  migrations and function deployment when pushed to `main`.
- Keep the Supabase CLI versions in the CI and deployment workflows aligned.
  Follow the CLI upgrade notes in the README when changing that version.
- Keep service-role keys and provider secrets in server-side configuration; never
  expose them through `NEXT_PUBLIC_*` variables or committed files.
