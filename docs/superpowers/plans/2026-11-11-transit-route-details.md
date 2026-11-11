# Transit route details implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement and verify this plan. Backend normalization and frontend presentation have disjoint write sets and may run in parallel.

**Goal:** Complete #21 with numbered transfer locations and ordered walking/transit guidance in recommendation, confirmed, and fixed-destination results.

**Architecture:** Keep `segments` for the existing map geometry. Add optional `steps` for provider-supplied journey information independently of geometry, so a missing walking polyline does not erase valid stop information. A shared route detail disclosure and controlled participant selection connect the three result views to `MeetingMap`.

**Tech Stack:** Existing Next.js/React/TypeScript, styled-components, Kakao Maps, Google Routes API, Deno, Node 20 and pnpm 10.32.1.

**Spec:** The design and acceptance criteria below implement the user's request to finish #21 and open a PR. Merge is not part of this request.

## Design and constraints

- Retain walking dashes, participant colors, voting, sharing, confirmation and missing-route index slots.
- A transfer is boarding each transit step after the first transit step, including adjacent transit steps and transfers separated by walking. Number from one. The marker uses the new vehicle's provider-supplied departure-stop coordinate. Do not guess coordinates or draw connectors.
- `RouteStep` has optional `durationSeconds` and `distanceMeters`, and a discriminated mode: walk/car, or transit with optional `transit` information. Transit information includes `lineName`, `vehicleType`, `headsign`, `stopCount`, `departureStop`, and `arrivalStop`. Stops have optional `name` and `location: PolylinePoint`.
- Preserve validated partial metadata, including zero durations/distances. Invalid optional metadata is omitted. Unknown/missing step modes make the entire guidance unavailable rather than implying a complete journey.
- Keep `steps?: RouteStep[]` optional in both runtime types. Old saved routes retain their lines and show a clear unavailable-detail message; null fixed-destination routes retain their original participant index. No migration, dependency, provider request or credential is added.
- Show transport type, line, direction, boarding/alighting names, step time/distance and stop count when supplied. Render strings as text. Explain that route estimates can change and total time may include waiting.
- Reuse existing result panels with one shared collapsed disclosure. Participant options include ordinal numbers so duplicate names are unambiguous. Selecting a map origin or a route option synchronizes the selected participant. Map transfers belong only to that participant.
- Considered alternatives: deriving transfer metadata from segment coordinates would invent stop/line information; adding a separate floating dialog would compete with current map/result controls. Provider metadata plus the existing panels is the chosen implementation approach.

## Review focus

- Missing/invalid walking geometry must not erase valid transit guidance.
- Missing transit stop coordinates must not produce fabricated map markers.
- Duplicate names and unavailable route slots must retain participant identity.
- A candidate, destination or confirmed-result change must not keep stale steps/markers.
- Long Korean stop/line names must wrap at 320px; keyboard controls and both themes must work.

## Tasks

- [x] Normalize Google transit step metadata and Kakao single-mode summaries; test partial/invalid fields and geometry independence in `supabase/functions/tests/mapapi.test.ts`.
- [x] Add matching optional frontend types, shared journey utilities and `RouteDetails`; test transfer numbering, partial/legacy data, participant selection and text rendering.
- [x] Add selected-participant transfer overlays to `MeetingMap`, update the three result callers/panels, and test colors, bounds, missing routes and selection.
- [x] Update static contracts and manual smoke coverage, then run quick and full harness under Node 20.
- [x] Exercise the running UI at mobile/desktop widths in both themes with controlled provider fixtures and independently review the diff.

Publication: open a PR with `Closes #21`; leave merging to the user.

## Verification record

- Node 20, pnpm 10.32.1: full `pnpm agent:harness` passed after the review correction. All 305 application/SQL tests, lint, production build, SEO checks, Deno 2.9.6 checks and 70 Deno tests with 99 subcases passed. Audit retained the documented low-severity dependency advisory and no moderate-or-higher findings.
- Quick harness: all 16 static contracts passed. `git diff --check` passed.
- Browser fixtures used the real three result views and shared components with local API responses and a replacement map renderer. Checked 320px, 390px, landscape and desktop layouts, light/dark themes, long Korean stop/line names, keyboard disclosure, missing/legacy routes, duplicate names, participant selection from both map and selector, and candidate changes. No horizontal overflow or browser console errors observed.
- Independent review found that expanding confirmed-route guidance resizes the map container. Added a ResizeObserver that calls Kakao relayout before updating bounds, plus a failing-then-passing cleanup/resize regression test. Browser instrumentation confirmed relayout on expansion and collapse. Re-review found no remaining actionable issues.
- Live Google/Kakao responses, real Kakao tile layout, physical devices and production deployment were not validated by these fixture checks. Optional step metadata appears on newly calculated routes after the frontend and Edge Functions are deployed; existing saved results remain readable.
