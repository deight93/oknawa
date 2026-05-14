import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const rlsMigration = await Deno.readTextFile(
  'supabase/migrations/20260514090000_enable_rls_for_public_flows.sql',
);
const togetherRoomSyncMigration = await Deno.readTextFile(
  'supabase/migrations/20260514123000_sync_together_room_result_flow.sql',
);
const confirmCancelResetMigration = await Deno.readTextFile(
  'supabase/migrations/20260514144500_make_confirm_cancel_reset_votes.sql',
);
const publicGrantSql = `${rlsMigration}\n${togetherRoomSyncMigration}`;

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
  'location_room_recommend_start(uuid, text, text)',
  'location_room_recommend_complete(uuid, text, uuid)',
  'location_room_recommend_fail(uuid, text)',
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

Deno.test('public user flow exposes the expected security definer RPCs', () => {
  for (const signature of requiredAnonFunctions) {
    assert(
      publicGrantSql.includes(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO anon;`,
      ),
      `${signature} must be executable by anon`,
    );
    assert(
      publicGrantSql.includes(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC;`,
      ),
      `${signature} must be revoked from public before explicit anon grant`,
    );
  }
});

Deno.test('together rooms store recommendation status and result map id', () => {
  assert(
    togetherRoomSyncMigration.includes('ADD COLUMN IF NOT EXISTS result_map_id'),
    'location_room must store the generated result map id',
  );
  assert(
    togetherRoomSyncMigration.includes(
      "recommendation_status IN ('idle', 'generating', 'completed', 'failed')",
    ),
    'location_room must keep a bounded recommendation status',
  );
  assert(
    togetherRoomSyncMigration.includes(
      "SET recommendation_status = 'generating'",
    ),
    'room recommendation start must publish loading state',
  );
  assert(
    togetherRoomSyncMigration.includes("SET recommendation_status = 'completed'"),
    'room recommendation complete must publish result state',
  );
});

Deno.test('confirm cancel restarts station voting', () => {
  assert(
    confirmCancelResetMigration.includes(
      'vote_round = location_result.vote_round + 1',
    ),
    'confirm cancel must advance the vote round',
  );
  assert(
    confirmCancelResetMigration.includes('SET vote = 0'),
    'confirm cancel must reset station vote counts',
  );
  assert(
    confirmCancelResetMigration.includes('SET confirmed_share_key = null'),
    'confirm cancel must clear together room confirmed state',
  );
});
