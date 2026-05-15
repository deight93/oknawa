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
contracts, frontend lint/build, and Supabase Edge Function type/test checks.

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

## When To Extend

Add a new static contract or Deno test whenever a feature changes one of these
contracts:

- Request body shape sent to `location-points`.
- Candidate type or region routing rules.
- Voting, confirmation, or retry semantics.
- Room status and participant navigation behavior.
- Public RPC grants, RLS policy assumptions, or migration contracts.
