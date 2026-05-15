#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const isQuick = args.has('--quick');
const isFull = args.has('--full') || !isQuick;

const files = new Map();

const read = path => {
  if (!files.has(path)) {
    const absolutePath = resolve(ROOT, path);
    files.set(
      path,
      existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : null,
    );
  }

  return files.get(path);
};

const requireFile = path => {
  const content = read(path);
  assert(content !== null, `${path} must exist`);
  return content;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertIncludes = (path, pattern, message) => {
  const content = requireFile(path);
  assert(content.includes(pattern), `${path}: ${message}`);
};

const assertNotIncludes = (path, pattern, message) => {
  const content = requireFile(path);
  assert(!content.includes(pattern), `${path}: ${message}`);
};

const staticContracts = [
  {
    name: 'individual search sends full address and meeting purpose',
    run: () => {
      assertIncludes(
        'src/model/search/SearchForm.ts',
        'full_address: fullAddress',
        'individual search must include full_address',
      );
      assertIncludes(
        'src/model/search/SearchForm.ts',
        'meetingPurpose',
        'individual search must pass meeting purpose',
      );
      assertIncludes(
        'src/model/search/SearchForm.ts',
        'travelMode: recommendationOptions.travelMode',
        'individual search must pass travel mode',
      );
      assertIncludes(
        'src/model/search/SearchForm.ts',
        'midpointBasis: recommendationOptions.midpointBasis',
        'individual search must pass midpoint basis',
      );
    },
  },
  {
    name: 'together search persists full address before recommendation',
    run: () => {
      assertIncludes(
        'src/model/search-together/SearchFormWithTogether.ts',
        'full_address: searchForm.address.fullAddress',
        'host room creation must include full_address',
      );
      assertIncludes(
        'src/services/search/SearchService.ts',
        'p_full_address',
        'participant join RPC must receive full_address',
      );
    },
  },
  {
    name: 'recommendation options reach the location scoring engine',
    run: () => {
      assertIncludes(
        'src/views/search/components/RecommendationOptionSelector.tsx',
        '이동 방식',
        'search UI must expose travel mode selection',
      );
      assertIncludes(
        'src/types/recommendationOptions.ts',
        "{ value: 'distance', label: '위치 기준' }",
        'distance midpoint option should use a clearer user-facing label',
      );
      assertIncludes(
        'supabase/functions/lib/location-points.ts',
        'recommendationOptions.travelMode',
        'location-points must use travel mode when building routes',
      );
      assertIncludes(
        'supabase/functions/lib/location-points.ts',
        'recommendationOptions.midpointBasis',
        'location-points must use midpoint basis when ranking candidates',
      );
      assertIncludes(
        'supabase/functions/lib/mapapi.ts',
        "travelMode === 'DRIVE' ? 'DRIVE' : 'TRANSIT'",
        'Google route requests must support car routes',
      );
      assertIncludes(
        'supabase/functions/tests/location-points.test.ts',
        'can rank by distance score',
        'distance basis ranking must have a regression test',
      );
    },
  },
  {
    name: 'car recommendation scoring is separated from transit scoring',
    run: () => {
      assertIncludes(
        'supabase/functions/lib/location-points.ts',
        "recommendationOptions.travelMode === 'car'",
        'car recommendations must use a separate scoring path',
      );
      assertIncludes(
        'supabase/functions/lib/location-points.ts',
        'CAR_DISTANCE_TIME_SPREAD_PENALTY_METERS_PER_SECOND',
        'car distance ranking must lightly penalize severe time imbalance',
      );
      assertIncludes(
        'supabase/functions/tests/location-points.test.ts',
        'ranks car time by drive travel time without transit penalties',
        'car time scoring must have a regression test',
      );
      assertIncludes(
        'supabase/functions/tests/location-points.test.ts',
        'lightly penalizes severe time imbalance',
        'car distance scoring must have a regression test',
      );
    },
  },
  {
    name: 'car recommendation results avoid transit-only presentation',
    run: () => {
      assertIncludes(
        'src/utils/recommendationDisplay.ts',
        "recommendationOptions?.travelMode === 'car'",
        'result display helpers must detect car recommendations',
      );
      assertIncludes(
        'src/utils/recommendationDisplay.ts',
        "'위치가 좋은 지역'",
        'car distance recommendations should use area-oriented copy',
      );
      assertIncludes(
        'src/utils/recommendationDisplay.ts',
        "option.value !== 'transfer' && option.value !== 'walking'",
        'car results must hide transit-only sort options',
      );
      assertIncludes(
        'src/views/result-confirm/ResultConfirmBody.tsx',
        'shouldShowHotPlaceButton',
        'confirmed car results must not show the hot place prompt',
      );
    },
  },
  {
    name: 'recommendation result type controls result presentation',
    run: () => {
      assertIncludes(
        'supabase/functions/lib/location-types.ts',
        "resultType?: PopularLocationType",
        'location-points request info must carry the result type',
      );
      assertIncludes(
        'supabase/functions/lib/mapapi.ts',
        'result_type: station.type',
        'route results must preserve the candidate location type',
      );
      assertIncludes(
        'src/types/location.ts',
        'ResultLocationType',
        'frontend result types must model the candidate location type',
      );
      assertIncludes(
        'src/hooks/result/useResultSummary.ts',
        'request_info?.resultType',
        'result page summaries must read the persisted result type',
      );
      assertIncludes(
        'src/hooks/result/useConfirmedResult.ts',
        'request_info?.resultType',
        'confirmed result page must read the persisted result type',
      );
      assertIncludes(
        'src/utils/recommendationDisplay.ts',
        "'중간 도시'",
        'external car results must use city-oriented copy',
      );
      assertIncludes(
        'supabase/functions/tests/location-points.test.ts',
        'preserves recommendation result type in request info',
        'result type persistence must have a regression test',
      );
    },
  },
  {
    name: 'search loading copy follows recommendation options',
    run: () => {
      assertIncludes(
        'src/views/search/components/SearchLoading.tsx',
        '만나기 좋은 지역을 고르는 중',
        'car search loading must avoid station-only copy',
      );
      assertIncludes(
        'src/views/search/components/SearchLoading.tsx',
        '자동차 이동 시간을 계산 중',
        'car search loading must mention car travel time',
      );
      assertIncludes(
        'src/views/search/SearchCompleteListWithTogether.tsx',
        'roomRecommendationOptions',
        'together participants must use room recommendation options for loading',
      );
      assertIncludes(
        'supabase/migrations/20260515152000_store_room_recommendation_options.sql',
        'recommendation_options JSONB',
        'room recommendation options must be persisted',
      );
    },
  },
  {
    name: 'room recommendation state syncs participants to result pages',
    run: () => {
      assertIncludes(
        'src/views/search/SearchCompleteListWithTogether.tsx',
        'recommendation_status',
        'together list must observe recommendation status',
      );
      assertIncludes(
        'src/views/search/SearchCompleteListWithTogether.tsx',
        'router.replace(`/result?mapId=${resultMapId}`)',
        'participants must auto-navigate to result map',
      );
      assertIncludes(
        'src/views/result/ResultBody.tsx',
        'router.replace(`/result/confirm?sharekey=${confirmedShareKey}`)',
        'participants must auto-navigate to confirmed result',
      );
    },
  },
  {
    name: 'retrying a confirmed result restarts voting instead of only canceling',
    run: () => {
      assertIncludes(
        'src/views/result-confirm/components/DistanceSummary.tsx',
        'requestResetVote',
        'confirmed result retry button must reset votes',
      );
      assertNotIncludes(
        'src/views/result-confirm/components/DistanceSummary.tsx',
        'requestCancelConfirm',
        'confirmed result page must not use cancel-only flow',
      );
      assertIncludes(
        'supabase/migrations/20260514144500_make_confirm_cancel_reset_votes.sql',
        'vote_round = location_result.vote_round + 1',
        'legacy confirm cancel RPC must advance vote round',
      );
      assertIncludes(
        'supabase/migrations/20260514144500_make_confirm_cancel_reset_votes.sql',
        'SET vote = 0',
        'legacy confirm cancel RPC must clear vote counts',
      );
    },
  },
  {
    name: 'recommendation region split stays explicit',
    run: () => {
      assertIncludes(
        'supabase/functions/lib/location-points.ts',
        "return hasNonSeoulGyeonggi ? 'city' : 'local_area';",
        'car recommendations must use area/city candidates',
      );
      assertIncludes(
        'supabase/migrations/20260515140000_seed_car_meeting_candidates.sql',
        "'local_area'",
        'car recommendations must have local area candidate seeds',
      );
      assertIncludes(
        'supabase/migrations/20260515140000_seed_car_meeting_candidates.sql',
        "'city'",
        'car recommendations must have city candidate seeds',
      );
      assertIncludes(
        'supabase/functions/lib/location-points.ts',
        "return hasNonSeoulGyeonggi ? 'terminal' : 'station';",
        'transit recommendations must keep station/terminal candidates',
      );
      assertIncludes(
        'supabase/functions/tests/location-points.test.ts',
        'resolveRecommendType uses stations for Seoul/Gyeonggi and terminals otherwise',
        'region split must have a unit test',
      );
    },
  },
  {
    name: 'public RPC and RLS contracts stay covered',
    run: () => {
      assertIncludes(
        'supabase/functions/tests/public-flow-contract.test.ts',
        'public user flow exposes the expected security definer RPCs',
        'public RPC contract test must exist',
      );
      assertIncludes(
        'supabase/functions/tests/public-flow-contract.test.ts',
        'confirm cancel restarts station voting',
        'retry voting regression test must exist',
      );
    },
  },
];

const commands = isFull
  ? [
      ['pnpm', ['lint']],
      ['pnpm', ['build']],
      [
        'pnpm',
        [
          'dlx',
          'deno',
          'check',
          '--config',
          'supabase/functions/location-points/deno.json',
          'supabase/functions/location-points/index.ts',
          'supabase/functions/location-meeting/index.ts',
          'supabase/functions/location-meeting-terminal/index.ts',
          'supabase/functions/location-point-place/index.ts',
          'supabase/functions/tests/*.test.ts',
        ],
      ],
      [
        'pnpm',
        [
          'dlx',
          'deno',
          'test',
          '--allow-read=supabase/migrations',
          '--config',
          'supabase/functions/location-points/deno.json',
          'supabase/functions/tests/*.test.ts',
        ],
      ],
    ]
  : [];

const runCommand = ([command, commandArgs]) => {
  const label = [command, ...commandArgs].join(' ');
  console.log(`\n$ ${label}`);
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
};

const runStaticContracts = () => {
  console.log('Agent harness static contracts');

  for (const contract of staticContracts) {
    contract.run();
    console.log(`  OK ${contract.name}`);
  }
};

try {
  runStaticContracts();

  if (isQuick) {
    console.log('\nQuick harness passed.');
    process.exit(0);
  }

  for (const command of commands) {
    runCommand(command);
  }

  console.log('\nAgent harness passed.');
} catch (error) {
  console.error('\nAgent harness failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
