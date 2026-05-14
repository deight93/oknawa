import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const rlsMigration = await Deno.readTextFile(
  'supabase/migrations/20260514090000_enable_rls_for_public_flows.sql',
);

const requiredPublicTables = [
  'location_result',
  'station_info',
  'location_room',
  'participant',
  'popular_meeting_location',
  'route_itinerary_cache',
  'station_place_quality_cache',
  'location_vote',
];

const requiredAnonFunctions = [
  'location_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION)',
  'location_result_by_map_id(uuid)',
  'location_station_by_share_key(text)',
  'location_room_status(uuid)',
  'location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION)',
  'location_station_confirm(uuid, text, text)',
  'location_points_vote(uuid, text, integer, text)',
  'location_confirm_cancel(uuid, text)',
  'location_vote_reset(uuid, text)',
];

Deno.test('public tables keep RLS enabled and direct anon access revoked', () => {
  for (const table of requiredPublicTables) {
    assert(
      rlsMigration.includes(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      ),
      `${table} must enable RLS`,
    );
    assert(
      rlsMigration.includes(`REVOKE SELECT ON public.${table} FROM anon;`),
      `${table} must revoke anon select`,
    );
    assert(
      rlsMigration.includes(
        `REVOKE INSERT, UPDATE, DELETE ON public.${table} FROM anon;`,
      ),
      `${table} must revoke anon writes`,
    );
  }
});

Deno.test('public user flow only exposes expected security definer RPCs', () => {
  const securityDefinerCount = (rlsMigration.match(/SECURITY DEFINER/g) ?? [])
    .length;

  assertEquals(securityDefinerCount, 9);

  for (const signature of requiredAnonFunctions) {
    assert(
      rlsMigration.includes(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO anon;`,
      ),
      `${signature} must be executable by anon`,
    );
    assert(
      rlsMigration.includes(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC;`,
      ),
      `${signature} must be revoked from public before explicit anon grant`,
    );
  }
});
