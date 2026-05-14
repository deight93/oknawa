import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  fetchCandidateMeetingLocations,
  parseLocationPointsRequest,
  resolveRecommendType,
} from '../lib/location-points.ts';
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
      }),
    }),
  );

  assert(valid.ok);
  assertEquals(valid.data.priority, 10);
  assertEquals(valid.data.meetingPurpose, 'cafe');
  assertEquals(valid.data.participants.length, 2);
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
