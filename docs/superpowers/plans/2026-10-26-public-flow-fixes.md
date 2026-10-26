# Public flow fixes implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, then request one independent whole-branch review.

**Goal:** Fix the reviewed permission, routing failure, and shared-result bugs, then open a PR.
**Architecture:** Preserve existing RPC signatures and recommendation scoring. Add a migration restricting public response fields, use only verified routes, await shared publication, and synchronize confirmed pages with live results.
**Tech Stack:** Next.js 14, React 18, Jotai, TanStack Query, Supabase SQL/Deno, Node tests with tsx/React test renderer/PGlite.
**Spec:** The user's 2026-10-26 request in this chat authorizes the reviewed bug fixes and a PR, while deferring midpoint algorithm updates.

## Global constraints

- Do not change score weights, geographic candidate selection, cache duration, or routing provider.
- Do not deploy, merge, or modify production data.
- Keep creator-issued host tokens; exclude them from public reads.
- Never present invented routes as successful directions.
- Fix polyline type interoperability and align local/CI Deno checks.

## Review focus

- Public reads hide capabilities while genuine hosts retain management access.
- Empty, failed, and partial routes never fabricate times or misidentify participants.
- Repeated clicks and publication failures never navigate or generate duplicates.
- Confirmed links follow another participant's reset or new confirmation.
- Responses for another map never cause stale navigation.

### Task 1: Protect public RPC responses

**Files:** new permission migration, `src/services/search/types.ts`, `tests/public-rpc.test.ts`, test tooling.
**Interfaces:** Existing RPC signatures remain; public result/room JSON excludes host fields; creation retains host tokens.

- [x] Add PGlite tests executing every migration and asserting public token omission plus allowed/denied host actions.
- [x] Run app tests and observe failing disclosure assertions.
- [x] Add an additive migration with explicit public fields; correct the frontend response type.
- [x] Run tests and commit.

### Task 2: Report route failures honestly

**Files:** route API/scoring boundary, Deno regression tests, error copy, Deno tooling.
**Interfaces:** Only API/cache-backed routes enter results; a group candidate needs every participant's route. Transit requests allow all transit modes under a new cache namespace.

- [x] Test empty/error/partial routes, complete candidates, and transit request payloads; observe failures with the existing type check temporarily bypassed.
- [x] Remove fabricated routes, exclude incomplete candidates, fix polyline import, and clarify errors.
- [x] Run complete Deno type/tests and commit.

### Task 3: Synchronize shared result lifecycle

**Files:** create-result and confirmed-result hooks, query/service types, `tests/result-flows.test.tsx`.
**Interfaces:** Creation awaits preparation/generation/fetch/publication before navigation, with a pending guard for the whole lifecycle. Confirmation follows live map state.

- [x] Add actual React hook tests for preparation/publication failure, repeated clicks, reset, and new confirmation; observe failures.
- [x] Implement lifecycle fixes without altering the midpoint algorithm.
- [x] Run app tests, lint, build, complete harness; commit.

### Task 4: Review and open PR

- [ ] Request independent branch review, resolve substantive findings with regression tests.
- [ ] Verify final tree; push `codex/public-flow-fixes`; create and attach PR.
