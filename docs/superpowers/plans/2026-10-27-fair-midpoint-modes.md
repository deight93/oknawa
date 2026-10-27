# Fair Midpoint and Individual Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Preserve the result UI while recommending fairer meeting places using each participant's transport choice.
**Architecture:** Keep the existing result contract and flow. Normalize individual modes at request boundaries, dispatch provider calls per participant, and replace time ranking with a deterministic bounded-minimax comparison. Persist room choices with backward-compatible RPC arguments.
**Tech Stack:** Next.js/React/TypeScript, Deno Supabase functions, PostgreSQL RPCs, Google Routes, Kakao routing.
**Spec:** `docs/superpowers/specs/2026-10-27-fair-midpoint-modes-design.md`

## Global Constraints

- Result layout, map, comparison, voting and confirmation flow remain intact.
- Travel modes: transit/car/walk. Missing mode uses legacy group option then transit.
- Time fairness window is 300 seconds. Retain distance-basis behavior.
- Keep current route-query bounds: 8/12 for transit/mixed, 16/20 for car-only.
- No new provider/dependency; no paid setting changes, production deploy or merge.
- Provider display/retention-policy redesign stays a separate task.

## Review Focus

- Old rooms/clients omit modes: optional RPC parameters and request fallback still work (Tasks 2, 3).
- Reordered/duplicate participant names: route association and ranking remain stable (Tasks 1, 2).
- Equal/lower times for everyone: never reward slowing every participant (Task 1).
- Provider returns empty/invalid/partial routes: no fabricated usable candidate, modes never silently switch (Task 2).
- New mode survives form reset, room polling and request serialization; existing result rank remains visible (Task 3).

### Task 1: Fair ranking and candidate selection

**Files:** `supabase/functions/lib/location-points.ts`, `distance.ts`, `location-types.ts`, `supabase/functions/tests/location-points.test.ts`, `scripts/agent-harness.mjs`.
**Interfaces:** Keep `selectBestStationItineraries(stations, participantCount, priority, purpose?, options?)`; add `selectRouteCandidates(participants, locations, limit, options)` and resolved per-person modes.

- [x] Add failing tests: prefer [42,42,42] over [10,10,70]; reject dominated candidates; respect inclusive 300-second boundary; keep order independent of input; exclude nonfinite/missing times; include Incheon; include walking-origin and spatially distinct candidates without exceeding existing call bounds.
- [x] Run `deno test --no-lock --allow-read=supabase/migrations --config supabase/functions/location-points/deno.json supabase/functions/tests/location-points.test.ts`. Expected: new behavioral assertions fail.
- [x] Implement normalized modes, mixed-aware candidate category, finite coordinate filtering/deduplication and bounded diverse candidates. Use ordinal recommend_score after sorting for existing UI compatibility.
- [x] Replace obsolete weighted-time/static-source assertions with the new ranking contract; keep distance behavior covered.
- [x] Run the same tests. Expected: all pass. Commit this task.

### Task 2: Per-person route providers

**Files:** `supabase/functions/lib/mapapi.ts`, new `route-providers.ts`, `location-points.ts`, `supabase/functions/tests/mapapi.test.ts`.
**Interfaces:** `callRouteItineraries(participants, locations, fallbackMode)` returns the existing station results; `fetchRouteItinerary(participant, location, mode, departureTime)` returns valid itinerary or null.

- [x] Add failing integration tests at fetch boundary for mixed Google/Kakao car/walk, documented response shapes, exact x/y mapping, invalid durations, unavailable routes, same-origin deduplication, concurrency and mode propagation.
- [x] Run the Edge tests; verify failures are the absent mixed-provider behavior.
- [x] Dispatch by effective individual mode, share one current departure time, deduplicate only within this request and retain concurrency 4. Do not reuse 30-day cross-request cache. Keep actual provider path geometry in existing response shape.
- [x] Run all Edge tests and Deno checks. Expected: pass. Commit this task.

### Task 3: Input selection and room persistence

**Files:** `src/types/*`, `src/jotai/global/store.ts`, search models/hooks/views/services; new mode selector, migration, `tests/travel-modes.test.tsx`, `tests/public-rpc.test.ts`, existing harness/readme.
**Interfaces:** SearchState.travelMode, Participant.travel_mode and RouteItinerary.travel_mode; optional travel_mode/p_travel_mode RPC inputs. Preserve omitted-mode legacy semantics. Group metadata may be mixed; no mixed option in individual selector.

- [x] Add failing tests that submit individual and room choices, preserve choices through serializers/polling, exercise new/legacy/invalid SQL RPC calls and preserve stored recommendation ordering in the existing summary hook.
- [x] Run `pnpm test:app`. Expected: new tests fail.
- [x] Add a compact labeled selector to existing input/card; remove redundant group-mode controls. Persist mode in room creation/join, preserve it in snapshots and payloads, and only adapt existing result text where per-person modes require it.
- [x] Add migration with nullable constrained participant.travel_mode, new defaulted RPC argument, existing privilege protection, and legacy call compatibility.
- [x] Run `pnpm test:app`, `pnpm agent:harness:quick`, `pnpm lint`, `pnpm build`, all Edge tests/checks. Expected: pass.
- [x] Inspect the running input flow at mobile width with isolated fixture data; verify result layout files remain unchanged apart from text/metadata use. Commit this task.
- [ ] Request whole-branch review, address substantive findings with regression tests, push feature branch, create and attach PR. Report checks and remaining external-service limitations.
