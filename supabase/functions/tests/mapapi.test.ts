import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { callGoogleMapItineraries } from '../lib/mapapi.ts';
import {
  buildStationItineraries,
  selectBestStationItineraries,
} from '../lib/location-points.ts';
import type { PopularMeetingLocation } from '../lib/location-types.ts';

const participants = [
  {
    name: 'A',
    region_name: 'A역',
    full_address: '서울',
    start_x: 127,
    start_y: 37.5,
  },
  {
    name: 'B',
    region_name: 'B역',
    full_address: '서울',
    start_x: 127.04,
    start_y: 37.5,
  },
];
const stations: PopularMeetingLocation[] = [
  {
    name: '후보 A',
    type: 'station',
    address: '서울',
    location_x: 127.02,
    location_y: 37.5,
  },
  {
    name: '후보 B',
    type: 'station',
    address: '서울',
    location_x: 127.03,
    location_y: 37.5,
  },
];
const route = {
  duration: '1800s',
  polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
  legs: [{ steps: [{ travelMode: 'TRANSIT', staticDuration: '1800s' }] }],
};
const cache = {
  from: () => ({
    select: () => ({
      in: () => ({ gt: async () => ({ data: [], error: null }) }),
    }),
    upsert: async () => ({ error: null }),
  }),
};

async function withApi(
  handler: (payload: Record<string, unknown>) => Response,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalEnv = Deno.env.get;
  Deno.env.get = name =>
    name === 'GOOGLE_API_URL' ? 'https://test.invalid' : 'test-key';
  globalThis.fetch = async (input, init) =>
    String(input).includes('kakao.com')
      ? new Response(JSON.stringify({ meta: { total_count: 0 } }))
      : handler(JSON.parse(String(init?.body)));
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.get = originalEnv;
  }
}
const response = (routes: unknown[]) =>
  new Response(JSON.stringify({ routes }));

Deno.test('empty routes never become invented travel times', async () => {
  await withApi(
    () => response([]),
    async () => {
      const results = await callGoogleMapItineraries(
        cache as never,
        participants,
        stations,
      );
      assertEquals(
        results.map(station => station.itinerary.length),
        [0, 0],
      );
    },
  );
});

Deno.test(
  'an unavailable routing provider yields no usable group recommendation',
  async () => {
    await withApi(
      () => new Response('unavailable', { status: 503 }),
      async () => {
        const results = await callGoogleMapItineraries(
          cache as never,
          participants,
          stations,
          'car',
        );
        assertEquals(selectBestStationItineraries(results, 2, 4), []);
      },
    );
  },
);

Deno.test(
  'a partial candidate is excluded and complete participant routes keep their names',
  async () => {
    await withApi(
      payload => {
        const origin = payload.origin as {
          location: { latLng: { longitude: number } };
        };
        const destination = payload.destination as {
          location: { latLng: { longitude: number } };
        };
        return response(
          destination.location.latLng.longitude === 127.02 &&
            origin.location.latLng.longitude === 127
            ? []
            : [route],
        );
      },
      async () => {
        const results = await callGoogleMapItineraries(
          cache as never,
          participants,
          stations,
        );
        const selected = selectBestStationItineraries(results, 2, 4);
        assertEquals(
          selected.map(station => station.station_name),
          ['후보 B'],
        );
        assertEquals(
          selected[0].itinerary.map(item => item.name),
          ['A', 'B'],
        );
        assertEquals(selected[0].itinerary[0].itinerary.totalTime, 1800);
        assertEquals(
          selected[0].itinerary[0].itinerary.total_polyline.length,
          3,
        );
      },
    );
  },
);

Deno.test(
  'transit requests allow buses and trains and do not reuse subway-only cache keys',
  async () => {
    const keys: string[] = [];
    const payloads: Record<string, unknown>[] = [];
    const freshCache = {
      from: () => ({
        select: () => ({
          in: (_field: string, requested: string[]) => {
            keys.push(...requested);
            return { gt: async () => ({ data: [], error: null }) };
          },
        }),
        upsert: async () => ({ error: null }),
      }),
    };
    await withApi(
      payload => {
        payloads.push(payload);
        return response([route]);
      },
      async () => {
        await callGoogleMapItineraries(freshCache as never, participants, [
          stations[0],
        ]);
        assert(keys.every(key => key.includes(':transit:')));
        assertEquals(keys.length, 2);
        assertEquals(payloads.length, 2);
        for (const payload of payloads) {
          assertEquals(payload.travelMode, 'TRANSIT');
          assertEquals(payload.transitPreferences, undefined);
        }
      },
    );
  },
);

Deno.test(
  'no complete group routes returns the explicit no_route_result error',
  async () => {
    await withApi(
      () => response([]),
      async () => {
        const result = await buildStationItineraries(
          cache as never,
          participants,
          stations,
          4,
        );
        assert(!result.ok);
        assertEquals(result.response.status, 503);
        assertEquals(
          (await result.response.json()).errorCode,
          'no_route_result',
        );
      },
    );
  },
);
