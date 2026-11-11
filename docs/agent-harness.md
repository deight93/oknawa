# Agent Harness

The agent harness is the baseline check to run before and after feature work.
It keeps the current public user flows from regressing while the product adds
transport and recommendation options.

## Commands

```bash
pnpm agent:harness:quick
pnpm agent:harness
```

Use `pnpm agent:harness:quick` while designing or editing small pieces. It runs
static contract checks only.

Use `pnpm agent:harness` before committing feature work. It runs the static
contracts, dependency security audit at the CI threshold, executable React/SQL
regression tests, frontend lint/build, and Supabase Edge Function type/test checks.

## Covered Flows

The current harness guards these flows:

- Individual search sends participant `full_address` and meeting purpose to the
  recommendation function.
- Together search stores host and participant `full_address` before generating
  recommendations.
- Together rooms publish recommendation status and auto-route participants to
  the result page.
- Confirmed result retry restarts voting instead of only clearing the confirmed
  station.
- Seoul/Gyeonggi recommendations use station candidates, while any non
  Seoul/Gyeonggi participant switches to terminal candidates.
- Public RLS and `SECURITY DEFINER` RPC contracts stay covered by Deno tests.

## Manual Smoke Checklist

Run these manually when UI or routing changes:

1. Create an individual search with two Seoul/Gyeonggi participants.
2. Like one candidate, confirm it, then use `다시 고르기`.
3. Verify the result page returns with votes reset to `0표`.
4. Create a together room in one browser and join it in another.
5. Start recommendation as host and verify the participant sees loading.
6. Verify both browsers move to the result page and then the confirmed page.
7. Confirm mobile layout does not cover the main map controls or action buttons.
8. Search for a lot address such as `봉천동 1511-6` and select it as a departure.
9. Before recommending, edit one direct-entry participant's name, address and
   travel mode; verify the other participants remain unchanged.
10. In a new together room, verify each browser can edit only its own entries,
    including after a reload. The host must not be able to edit a guest's entry.
11. At 320px width and in landscape, scroll the expanded result panel to the
    preference results, like and confirm buttons. Verify the station title wraps
    normally and every action remains reachable.

## Walking route lines

For newly calculated routes, the map uses the ordered geometry of each walking
and transit step. Walking uses a short dashed line; transit and car use solid
lines. Participant colors and marker selection apply to all of that person's
segments. The same map is used for midpoint candidates, confirmed results and
fixed destinations.

Saved results without segment data keep their whole-route geometry. An explicitly
walking-only route can be dashed from its known travel mode; a legacy transit
route stays solid because its walking sections cannot be inferred from the total
walking time. Missing or invalid segment geometry falls back to the whole route,
and empty or single-point paths do not draw a line.

Additional smoke checks for issue #21:

1. Calculate a transit journey with walking at the start and end. Check that only
   those portions are dashed, without a solid line showing through the gaps.
2. Mix transit, walking and car participants. Keep each participant's color and
   marker number when another participant's route is unavailable.
3. Select a participant marker. Every segment in that route should become thicker
   without changing its line style or creating extra lines.
4. Check both themes, 320px width, landscape and desktop. The overview must include
   all segment detours, and existing map controls must remain reachable.
5. Open an existing saved result without segment data and a response with missing
   step geometry. Show the original full path instead of guessed walking sections.

Deploy the Edge Functions that import `lib/route-providers.ts` to return segment
data for new calculations. Existing saved result JSON is not backfilled, and no
database migration is required. Provider fixtures and mock map renderers do not
verify live route-provider coverage or actual Kakao map tiles.

## Departure editing rollout

Apply `supabase/migrations/20261103090000_participant_edit.sql` before deploying
the frontend that uses `location_update_participant`. The migration preserves
the existing create/join response fields and adds a private edit capability for
each new registration. The capability table is not publicly readable.

Existing together-room entries have no edit capability and remain uneditable;
there is no claim-by-name fallback. To use editing, create a new room and register
with the updated frontend. A participant must use the browser that registered
their entry; clearing its storage removes that browser's edit capability.
Direct-entry lists remain editable locally without a participant capability.

## When To Extend

Add a new static contract or Deno test whenever a feature changes one of these
contracts:

- Request body shape sent to `location-points`.
- Candidate type or region routing rules.
- Voting, confirmation, or retry semantics.
- Room status and participant navigation behavior.
- Public RPC grants, RLS policy assumptions, or migration contracts.

## Regression tests

`pnpm test:app` exercises public RPC permissions with all migrations in PGlite and
shared-result hooks with real React, Jotai, and Query providers. External HTTP
responses are controlled by an Axios adapter. Deno tests additionally cover empty
routes, provider failures, incomplete group routes, and transit request options.
Local and CI Edge Function checks use Deno 2.9.6.

After the production build, `node scripts/check-seo.mjs` verifies the rendered
home metadata/content, noindex on input and shared-result pages, and the public
robots.txt/sitemap.xml. See [search registration and measurement](seo.md) for
the separate post-deployment account steps.

## Walking and transit journey details

In recommendation, confirmed and fixed-destination results, open
`이동 구간·환승 안내` and select a participant. Check that walking, boarding,
numbered transfers and alighting appear in order, with stop/line/direction,
duration, distance and stop count only when provided. The same numbered
transfers must appear on the map for the selected participant, using that
participant's color. Origin-marker selection must update the participant selector.

Exercise two transit legs separated by walking, adjacent transit legs, a direct
transit journey, walking/car-only journeys, duplicate participant names, an
unavailable first route, old saved results without steps and a transfer without
stop coordinates. Missing geometry must not erase otherwise available guidance;
missing stop coordinates must not produce a fabricated marker. Change candidate
and destination and reopen a shared/confirmed result to check for stale markers.

Repeat disclosure, participant selection and keyboard navigation at 320px,
390px, landscape and desktop widths in both themes. Long stop/line names must
wrap. Confirm that the surrounding vote, confirm, retry, sharing and external
directions controls remain reachable. New optional step metadata requires the
Edge Function deployment; saved results are not rewritten. Fixture/provider
tests do not verify live timetable coverage or current service conditions.

## Fixed meeting destinations

The home entry `정해진 장소로 모이기` uses dedicated `/meeting` routes for
place selection and direct input. Together rooms retain the existing invitation
URL and authoritative room status. Fixed results skip candidate voting and keep
one indexed route outcome for every participant, including unavailable routes.

Additional smoke checks:

1. Select a place from the home entry and enter one direct departure. Reload the
   list, add another departure with the same name and a different travel mode,
   and verify both origins/directions remain distinct in the result.
2. Create a fixed-destination room and follow its invitation in another browser.
   Verify the same destination appears before registration and after reload.
   Only the host sees destination editing; origin editing remains own-only.
3. Start calculation as host. Both browsers reach the same result, with no voting
   or confirmation actions. Unavailable estimates still offer Kakao directions.
4. Change the destination from the host's result and recalculate. The old result
   is marked outdated, and the new result uses the new destination. Exercise
   retry after an API failure and reject late results from an older run.
5. Repeat input, destination editing, result sharing and directions at 320px,
   landscape and desktop widths in both themes. Test actual installed-app and
   missing-app handoff separately from browser fixtures.
6. Verify the fixed-destination map is visible immediately without a toggle.
   Successful routes use the existing participant colors. With an unavailable or
   empty first route, later routes keep their original colors and marker numbers;
   missing routes do not create straight lines. Check marker selection and that
   overview bounds include the whole route.

Apply `20261104090000_fixed_meeting_destination.sql`, then deploy the
`location-destination` Edge Function before using the new frontend entry.
The existing production workflow applies migrations before deploying functions;
Vercel and Supabase workflows run independently, so verify both deployments after
merge. No new provider secrets are required. The existing five-minute room lease
and participant edit capabilities remain in force. Route computations accept at
most 50 participants and use at most four provider requests concurrently.
