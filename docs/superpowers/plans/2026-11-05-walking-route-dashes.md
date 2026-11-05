# Walking route dashes implementation plan

**Goal:** Show walking sections as dashed lines on the meeting map while keeping transit and car sections solid and preserving participant colors.

**Spec:** Issue #21 and the user's choice to show walking with a dashed line. This change covers line styling and the required segment geometry, without adding transfer markers or step-by-step directions.

**Architecture:** Extend itinerary JSON with optional `segments: { mode: TravelMode; polyline: PolylinePoint[] }[]`. Google transit responses supply ordered step geometry; walking and car responses use their existing geometry. The shared `MeetingMap` renders segments independently, retaining the participant index for color and selection. Stored legacy routes remain readable.

**Tech stack:** Next.js/React, TypeScript, styled-components, Kakao Maps, Supabase Edge Functions/Deno. Use Node.js 20 and pinned pnpm. No new dependencies, external API requests, or schema migrations are required by the implementation.

## Behavior and review focus

- Use Kakao `strokeStyle="shortdash"` only for known walking geometry; use `solid` for transit and car geometry.
- Preserve original geometry order, participant color/index, route bounds and marker selection for all segments.
- An incomplete, unknown-mode or invalid segment set falls back to the whole route as a solid line, except an explicitly walking-only route is dashed. Do not synthesize geometry or draw a solid base under walking segments.
- Missing routes leave gaps. One-point or empty geometry is not a drawable line. Existing saved routes without segments stay usable.
- Route duration, transfer/walking totals, ranking, request count, permissions and persistence behavior remain unchanged.

## Task 1: Provider geometry and backend contract

Files: `supabase/functions/lib/location-types.ts`, `supabase/functions/lib/route-providers.ts`, `supabase/functions/tests/mapapi.test.ts`.

- [x] Add failing provider tests for ordered walk/transit/walk geometry, requested step polylines, intact route totals, missing/invalid/unknown step fallback, and walking/car routes.
- [x] Run the targeted Deno tests and observe the new assertions fail.
- [x] Add the optional segment contract and normalization. Include Google `routes.legs.steps.polyline.encodedPolyline` in the field mask. Publish segments only when all steps have supported modes and valid drawable geometry.
- [x] Re-run targeted tests and Deno type checks.

## Task 2: Map rendering and frontend contract

Files: `src/types/location.ts`, `src/components/MeetingMap/index.tsx`, `tests/meeting-map.test.tsx`.

- [x] Add failing map tests for mixed segment styles, legacy/walking fallback, no double-painted routes, stable participant indexes, full selected-route emphasis, and overview bounds.
- [x] Run the targeted Node tests and observe the new assertions fail.
- [x] Add the matching optional contract and render one line per segment, falling back conservatively when segment geometry is unusable.
- [x] Re-run targeted tests and check types.

## Task 3: Integration and verification

Files: `scripts/agent-harness.mjs`, `docs/agent-harness.md`.

- [x] Add a static contract for provider and map regression coverage; document old-result fallback and new-result smoke checks.
- [x] Run `pnpm agent:harness` and `git diff --check`.
- [x] Exercise the actual map component with a controlled map renderer in a browser at mobile/desktop sizes and both themes. Verify mixed, walking-only, legacy and missing routes, selection and no duplicated solid line.
- [x] Review the final diff independently; report any unavailable live SDK/provider validation.

## Progress

- Implemented in `codex/walking-route-dashes`. The dashed-walking direction comes from the user; the optional data contract and conservative legacy fallback are implementation decisions.
- Frontend red/green: five original map tests passed and nine new cases failed before implementation; all fourteen map tests now pass.
- Backend red/green: seven new cases failed before implementation; targeted suite passes eighteen tests and forty-two substeps.
- Full Node.js 20 harness: 274 application/SQL tests, 64 Deno tests with 42 substeps, 15 static contracts, lint, build and the dependency audit threshold passed. One documented low-severity dependency advisory remains.
- Production frontend with controlled SDK/API responses: 320px, 390px, landscape 844px and desktop 1440px; both themes; walking-only legacy fallback, mixed step geometry, missing participant routes, direct/shared fixed destinations, destination changes, midpoint voting/confirmation/reset.
- Native Kakao SDK verification: the public meeting entry loaded the real SDK and rendered `shortdash` as a `12px, 12px` SVG dash pattern, while `solid` had no dash pattern. The check used temporary browser-only geometry and blocked service write requests.
- Live route-provider responses and production deployment were not tested before PR creation. The frequency of incomplete provider geometry remains unverified; those responses retain the existing whole-route fallback.
- Independent review found no actionable issues in rendering, fallback geometry, participant identity, bounds or provider normalization.
- A separate premerge review confirmed the provider field mask, optional JSON persistence and backward compatibility. The full harness passed again before committing.

## API references

- [Google transit step fields](https://developers.google.com/maps/documentation/routes/transit-route)
- [Kakao Maps polyline styling](https://apis.map.kakao.com/web/documentation/#Polyline)
