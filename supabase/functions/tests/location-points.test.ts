import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  fetchCandidateMeetingLocations,
  parseLocationPointsRequest,
  resolveRecommendType,
  selectBestStationItineraries,
} from '../lib/location-points.ts';
import type {
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
