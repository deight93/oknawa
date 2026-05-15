import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildStationInfoInserts,
  fetchCandidateMeetingLocations,
  getCandidatePoolSize,
  parseLocationPointsRequest,
  resolveRecommendType,
  selectBestStationItineraries,
} from '../lib/location-points.ts';
import { getScoredMeetingLocationCandidates } from '../lib/distance.ts';
import type {
  PopularLocationType,
  PopularMeetingLocation,
  RouteItinerary,
  StationItineraryResult,
} from '../lib/location-types.ts';
import { ExternalApiError, responseApiError, responseError } from '../lib/utils.ts';

const createParticipant = (fullAddress: string) => ({
  name: '테스터',
  region_name: '테스트역',
  full_address: fullAddress,
  start_x: 127.0276,
  start_y: 37.4979,
});

const CAR_CANDIDATE_MIGRATIONS = [
  'supabase/migrations/20260515140000_seed_car_meeting_candidates.sql',
  'supabase/migrations/20260515173000_refine_car_meeting_candidates.sql',
];

const createSupabaseMock = (
  dataByType: Record<string, unknown[]>,
  errorByType: Record<string, { message: string } | null> = {},
) => ({
  from: () => ({
    select: () => ({
      eq: (_column: string, type: string) => ({
        is: () =>
          Promise.resolve({
            data: dataByType[type] ?? [],
            error: errorByType[type] ?? null,
          }),
      }),
    }),
  }),
});

const createRoute = (
  totalTime: number,
  transferCount = 0,
  walkingTime = 0,
): RouteItinerary => ({
  name: '테스터',
  region_name: '테스트역',
  itinerary: {
    totalTime,
    transferCount,
    walkingTime,
    total_polyline: [],
  },
});

const createStationResult = (
  stationName: string,
  routes: RouteItinerary[],
): StationItineraryResult => ({
  station_name: stationName,
  address_name: `${stationName} 주소`,
  end_x: 127,
  end_y: 37,
  itinerary: routes,
});

async function loadCarCandidates(type: PopularLocationType) {
  const candidateMap = new Map<string, PopularMeetingLocation>();

  for (const path of CAR_CANDIDATE_MIGRATIONS) {
    const migration = await Deno.readTextFile(path);
    const rowPattern =
      /\('([^']+)',\s*'(local_area|city)',\s*'([^']+)',\s*'([^']+)',\s*([0-9.]+),\s*([0-9.]+)/g;

    for (const match of migration.matchAll(rowPattern)) {
      const [, name, candidateType, url, address, locationX, locationY] = match;

      if (candidateType !== type) continue;

      candidateMap.set(name, {
        name,
        type: candidateType,
        url,
        address,
        location_x: Number(locationX),
        location_y: Number(locationY),
      });
    }
  }

  return Array.from(candidateMap.values());
}

function getTopCandidateNames(
  candidates: PopularMeetingLocation[],
  participants: ReturnType<typeof createParticipant>[],
  limit: number,
) {
  const centerCoordinates: [number, number] = [
    participants.reduce((sum, participant) => sum + participant.start_x, 0) /
      participants.length,
    participants.reduce((sum, participant) => sum + participant.start_y, 0) /
      participants.length,
  ];

  return getScoredMeetingLocationCandidates(
    centerCoordinates,
    participants,
    candidates,
  )
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.maxParticipantDistanceMeters - b.maxParticipantDistanceMeters ||
        a.centerDistanceMeters - b.centerDistanceMeters ||
        a.station.name.localeCompare(b.station.name),
    )
    .slice(0, limit)
    .map(candidate => candidate.station.name);
}

Deno.test('responseApiError keeps a structured error payload', async () => {
  const response = responseApiError('invalid_request', '잘못된 요청입니다', 400, {
    field: 'participant',
  });
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.errorCode, 'invalid_request');
  assertEquals(body.message, '잘못된 요청입니다');
  assertEquals(body.error, '잘못된 요청입니다');
  assertEquals(body.detail.field, 'participant');
});

Deno.test('responseError maps external API failures to a stable error code', async () => {
  const response = responseError(
    new ExternalApiError('외부 API 실패', 503, 'https://example.com', 'down'),
  );
  const body = await response.json();

  assertEquals(response.status, 502);
  assertEquals(body.errorCode, 'external_api_error');
  assertEquals(body.message, '외부 API 실패');
  assertEquals(body.detail.status, 503);
});

Deno.test('parseLocationPointsRequest validates JSON and participants', async () => {
  const invalidJson = await parseLocationPointsRequest(
    new Request('https://example.com/functions/v1/location-points', {
      method: 'POST',
      body: '{',
    }),
  );

  assert(!invalidJson.ok);
  assertEquals(invalidJson.response.status, 400);
  assertEquals((await invalidJson.response.json()).errorCode, 'invalid_json_body');

  const valid = await parseLocationPointsRequest(
    new Request('https://example.com/functions/v1/location-points?priority=99', {
      method: 'POST',
      body: JSON.stringify({
        participant: [
          createParticipant('서울특별시 강남구'),
          createParticipant('경기도 성남시'),
        ],
        meetingPurpose: 'cafe',
        travelMode: 'car',
        midpointBasis: 'distance',
      }),
    }),
  );

  assert(valid.ok);
  assertEquals(valid.data.priority, 10);
  assertEquals(valid.data.meetingPurpose, 'cafe');
  assertEquals(valid.data.recommendationOptions.travelMode, 'car');
  assertEquals(valid.data.recommendationOptions.midpointBasis, 'distance');
  assertEquals(valid.data.participants.length, 2);
});

Deno.test('parseLocationPointsRequest falls back to default recommendation options', async () => {
  const valid = await parseLocationPointsRequest(
    new Request('https://example.com/functions/v1/location-points', {
      method: 'POST',
      body: JSON.stringify({
        participant: [
          createParticipant('서울특별시 강남구'),
          createParticipant('경기도 성남시'),
        ],
        travelMode: 'bike',
        midpointBasis: 'price',
      }),
    }),
  );

  assert(valid.ok);
  assertEquals(valid.data.recommendationOptions.travelMode, 'transit');
  assertEquals(valid.data.recommendationOptions.midpointBasis, 'time');
});

Deno.test('resolveRecommendType uses stations for Seoul/Gyeonggi and terminals otherwise', () => {
  assertEquals(
    resolveRecommendType([
      createParticipant('서울특별시 강남구'),
      createParticipant('경기도 성남시'),
    ]),
    'station',
  );
  assertEquals(
    resolveRecommendType([
      createParticipant('서울특별시 강남구'),
      createParticipant('부산광역시 해운대구'),
    ]),
    'terminal',
  );
});

Deno.test('resolveRecommendType uses area and city candidates for car recommendations', () => {
  assertEquals(
    resolveRecommendType(
      [
        createParticipant('서울특별시 강남구'),
        createParticipant('경기도 성남시'),
      ],
      { travelMode: 'car', midpointBasis: 'time' },
    ),
    'local_area',
  );
  assertEquals(
    resolveRecommendType(
      [
        createParticipant('서울특별시 강남구'),
        createParticipant('부산광역시 해운대구'),
      ],
      { travelMode: 'car', midpointBasis: 'distance' },
    ),
    'city',
  );
});

Deno.test('car recommendation QA keeps a wider candidate pool for drive-time ranking', () => {
  assertEquals(
    getCandidatePoolSize(4, 50, { travelMode: 'transit', midpointBasis: 'time' }),
    8,
  );
  assertEquals(
    getCandidatePoolSize(4, 50, { travelMode: 'car', midpointBasis: 'distance' }),
    8,
  );
  assertEquals(
    getCandidatePoolSize(4, 50, { travelMode: 'car', midpointBasis: 'time' }),
    16,
  );
});

Deno.test('car recommendation QA covers Seoul/Gyeonggi area candidates', async () => {
  const localAreaCandidates = await loadCarCandidates('local_area');
  const topCandidateNames = getTopCandidateNames(
    localAreaCandidates,
    [
      {
        ...createParticipant('서울특별시 강남구 역삼동'),
        start_x: 127.0276,
        start_y: 37.4979,
      },
      {
        ...createParticipant('경기도 수원시 팔달구 매산로1가'),
        start_x: 127.0002,
        start_y: 37.2656,
      },
    ],
    getCandidatePoolSize(4, localAreaCandidates.length, {
      travelMode: 'car',
      midpointBasis: 'time',
    }),
  );

  assert(localAreaCandidates.length >= 45);
  assert(
    topCandidateNames.some(name =>
      ['판교 상권', '정자 상권', '사당 상권', '교대 상권'].includes(name),
    ),
  );
});

Deno.test('car recommendation QA covers external city hub candidates', async () => {
  const cityCandidates = await loadCarCandidates('city');
  const topCandidateNames = getTopCandidateNames(
    cityCandidates,
    [
      {
        ...createParticipant('서울특별시 중구 봉래동2가'),
        start_x: 126.9707,
        start_y: 37.5547,
      },
      {
        ...createParticipant('부산광역시 동구 초량동'),
        start_x: 129.0397,
        start_y: 35.1151,
      },
    ],
    getCandidatePoolSize(4, cityCandidates.length, {
      travelMode: 'car',
      midpointBasis: 'time',
    }),
  );

  assert(cityCandidates.length >= 35);
  assert(
    topCandidateNames.some(name =>
      ['대전광역시', '대구광역시', '청주시', '천안시'].includes(name),
    ),
  );
});

Deno.test('fetchCandidateMeetingLocations falls back to the other candidate type', async () => {
  const supabase = createSupabaseMock({
    terminal: [],
    station: [
      {
        name: '강남역',
        type: 'station',
        url: 'https://place.map.kakao.com/1',
        address: '서울 강남구',
        location_x: 127.0276,
        location_y: 37.4979,
      },
    ],
  });

  const result = await fetchCandidateMeetingLocations(
    supabase as never,
    'terminal',
  );

  assert(result.ok);
  assertEquals(result.data[0].name, '강남역');
});

Deno.test('fetchCandidateMeetingLocations falls back from car area to station candidates', async () => {
  const supabase = createSupabaseMock({
    local_area: [],
    station: [
      {
        name: '강남역',
        type: 'station',
        url: 'https://place.map.kakao.com/1',
        address: '서울 강남구',
        location_x: 127.0276,
        location_y: 37.4979,
      },
    ],
  });

  const result = await fetchCandidateMeetingLocations(
    supabase as never,
    'local_area',
  );

  assert(result.ok);
  assertEquals(result.data[0].name, '강남역');
});

Deno.test('buildStationInfoInserts preserves recommendation result type in request info', () => {
  const inserts = buildStationInfoInserts(
    '00000000-0000-0000-0000-000000000000',
    [
      createParticipant('서울특별시 강남구'),
      createParticipant('경기도 성남시'),
    ],
    [
      {
        ...createStationResult('판교 상권', [
          createRoute(1200, 0, 0),
          createRoute(1300, 0, 0),
        ]),
        result_type: 'local_area',
      },
    ],
    undefined,
    { travelMode: 'car', midpointBasis: 'time' },
  );

  assertEquals(inserts[0].request_info.resultType, 'local_area');
  assertEquals(inserts[0].request_info.recommendationOptions?.travelMode, 'car');
});

Deno.test('selectBestStationItineraries rewards fewer transfers and shorter walking time', () => {
  const result = selectBestStationItineraries(
    [
      createStationResult('빠르지만 번거로운 역', [
        createRoute(1200, 1, 120),
        createRoute(1200, 1, 120),
      ]),
      createStationResult('조금 느려도 편한 역', [
        createRoute(1250, 0, 80),
        createRoute(1250, 0, 80),
      ]),
    ],
    2,
    2,
  );

  assertEquals(result[0].station_name, '조금 느려도 편한 역');
});

Deno.test('selectBestStationItineraries penalizes candidates missing participant routes', () => {
  const result = selectBestStationItineraries(
    [
      createStationResult('일부만 빠른 역', [createRoute(300, 0, 20)]),
      createStationResult('모두 갈 수 있는 역', [
        createRoute(1200, 0, 80),
        createRoute(1200, 0, 80),
      ]),
    ],
    2,
    2,
  );

  assertEquals(result[0].station_name, '모두 갈 수 있는 역');
});

Deno.test('selectBestStationItineraries can rank by distance score', () => {
  const nearButSlower = {
    ...createStationResult('거리상 가까운 역', [
      createRoute(1800, 0, 80),
      createRoute(1800, 0, 80),
    ]),
    distance_score: 100,
  };
  const farButFaster = {
    ...createStationResult('시간상 빠른 역', [
      createRoute(600, 0, 20),
      createRoute(600, 0, 20),
    ]),
    distance_score: 1000,
  };

  const result = selectBestStationItineraries(
    [farButFaster, nearButSlower],
    2,
    2,
    undefined,
    { travelMode: 'transit', midpointBasis: 'distance' },
  );

  assertEquals(result[0].station_name, '거리상 가까운 역');
});

Deno.test('selectBestStationItineraries ranks car time by drive travel time without transit penalties', () => {
  const fasterWithTransitNoise = createStationResult('자동차로 빠른 지역', [
    createRoute(900, 5, 2000),
    createRoute(900, 5, 2000),
  ]);
  const slowerWithoutTransitNoise = createStationResult('자동차로 느린 지역', [
    createRoute(1200, 0, 0),
    createRoute(1200, 0, 0),
  ]);

  const result = selectBestStationItineraries(
    [slowerWithoutTransitNoise, fasterWithTransitNoise],
    2,
    2,
    undefined,
    { travelMode: 'car', midpointBasis: 'time' },
  );

  assertEquals(result[0].station_name, '자동차로 빠른 지역');
});

Deno.test('selectBestStationItineraries keeps car distance ranking but lightly penalizes severe time imbalance', () => {
  const balancedLocation = {
    ...createStationResult('조금 멀어도 균형 좋은 지역', [
      createRoute(1000, 0, 0),
      createRoute(1000, 0, 0),
    ]),
    distance_score: 5000,
  };
  const imbalancedLocation = {
    ...createStationResult('가깝지만 치우친 지역', [
      createRoute(100, 0, 0),
      createRoute(2000, 0, 0),
    ]),
    distance_score: 1000,
  };

  const result = selectBestStationItineraries(
    [imbalancedLocation, balancedLocation],
    2,
    2,
    undefined,
    { travelMode: 'car', midpointBasis: 'distance' },
  );

  assertEquals(result[0].station_name, '조금 멀어도 균형 좋은 지역');
});
