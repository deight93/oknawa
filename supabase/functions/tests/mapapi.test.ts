import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { callRouteItineraries } from '../lib/mapapi.ts';
import {
  buildStationItineraries,
  selectBestStationItineraries,
} from '../lib/location-points.ts';
import type { PopularMeetingLocation } from '../lib/location-types.ts';
import type { TravelMode } from '../lib/location-types.ts';

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
    String(input).includes('/local/')
      ? new Response(JSON.stringify({ meta: { total_count: 0 } }))
      : handler(init?.body ? JSON.parse(String(init.body)) : {});
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.get = originalEnv;
  }
}
const response = (routes: unknown[]) =>
  new Response(JSON.stringify({ routes }));

const carResponse = {
  routes: [
    {
      result_code: 0,
      summary: { duration: 1500, distance: 7000 },
      sections: [{ roads: [{ vertexes: [127.04, 37.5, 127.02, 37.5] }] }],
    },
  ],
};
const walkResponse = {
  status: 'OK',
  route: {
    properties: { totalTime: 900, totalDistance: 1000 },
    legs: [
      {
        steps: [
          {
            path: {
              points: [
                [127.06, 37.5],
                [127.02, 37.5],
              ],
            },
          },
        ],
      },
    ],
  },
};

Deno.test(
  'Kakao walk status rejects a failed route and recognizes an identical endpoint',
  async () => {
    const originalFetch = globalThis.fetch,
      originalEnv = Deno.env.get;
    Deno.env.get = () => 'test-key';
    try {
      globalThis.fetch = async () =>
        Response.json({ ...walkResponse, status: 'ROUTE_RESULT_NOT_FOUND' });
      const failed = await callRouteItineraries(
        [{ ...participants[0], travel_mode: 'walk' }],
        [stations[0]],
      );
      assertEquals(failed[0].itinerary, []);
      globalThis.fetch = async () => Response.json({ status: 'SAME_POINT' });
      const same = await callRouteItineraries(
        [{ ...participants[0], start_x: 127.02, travel_mode: 'walk' }],
        [stations[0]],
      );
      assertEquals(same[0].itinerary[0].itinerary.totalTime, 0);
    } finally {
      globalThis.fetch = originalFetch;
      Deno.env.get = originalEnv;
    }
  },
);

Deno.test(
  'mixed modes query the correct providers and preserve person, time, and coordinate order',
  async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = Deno.env.get;
    const calls: URL[] = [];
    Deno.env.get = name =>
      name === 'GOOGLE_API_URL' ? 'https://google.invalid' : 'test-key';
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      calls.push(url);
      assertEquals(
        new Headers(init?.headers).get(
          url.hostname === 'google.invalid'
            ? 'X-Goog-Api-Key'
            : 'Authorization',
        ),
        url.hostname === 'google.invalid' ? 'test-key' : 'KakaoAK test-key',
      );
      return Response.json(
        url.hostname === 'google.invalid'
          ? { routes: [route] }
          : url.pathname === '/v1/directions'
            ? carResponse
            : walkResponse,
      );
    };
    try {
      const people = [
        { ...participants[0], travel_mode: 'transit' as const },
        { ...participants[1], travel_mode: 'car' as const },
        {
          ...participants[0],
          name: 'C',
          start_x: 127.06,
          travel_mode: 'walk' as const,
        },
      ];
      const result = await callRouteItineraries(people, [stations[0]], 'mixed');
      assertEquals(
        result[0].itinerary.map(r => [
          r.name,
          r.travel_mode,
          r.itinerary.totalTime,
        ]),
        [
          ['A', 'transit', 1800],
          ['B', 'car', 1500],
          ['C', 'walk', 900],
        ],
      );
      assertEquals(result[0].itinerary[1].itinerary.total_polyline[0], {
        lng: 127.04,
        lat: 37.5,
      });
      assertEquals(result[0].itinerary[2].itinerary.walkingTime, 900);
      assertEquals(result[0].itinerary[2].itinerary.walkingDistance, 1000);
      assertEquals(
        calls
          .find(u => u.pathname === '/v1/directions')
          ?.searchParams.get('origin'),
        '127.04,37.5',
      );
      assertEquals(
        calls
          .find(u => u.pathname === '/v2/routing/walk')
          ?.searchParams.get('end_x'),
        '127.02',
      );
    } finally {
      globalThis.fetch = originalFetch;
      Deno.env.get = originalEnv;
    }
  },
);

Deno.test(
  'identical departures share one in-flight request without dropping duplicate names',
  async () => {
    let calls = 0;
    await withApi(
      () => {
        calls++;
        return response([route]);
      },
      async () => {
        const result = await callRouteItineraries(
          [participants[0], { ...participants[0] }],
          [stations[0]],
        );
        assertEquals(calls, 1);
        assertEquals(
          result[0].itinerary.map(r => r.name),
          ['A', 'A'],
        );
      },
    );
  },
);

Deno.test(
  'invalid provider durations never create a complete candidate',
  async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = Deno.env.get;
    Deno.env.get = name =>
      name === 'GOOGLE_API_URL' ? 'https://google.invalid' : 'test-key';
    try {
      for (const mode of ['transit', 'car', 'walk'] satisfies TravelMode[]) {
        globalThis.fetch = async () =>
          Response.json(
            mode === 'transit'
              ? { routes: [{ ...route, duration: 'bad' }] }
              : mode === 'car'
                ? { routes: [{ result_code: 0, summary: { duration: -1 } }] }
                : { route: { properties: { totalTime: '900' } } },
          );
        const result = await callRouteItineraries(
          [{ ...participants[0], travel_mode: mode }],
          [stations[0]],
        );
        assertEquals(result[0].itinerary, []);
      }
    } finally {
      globalThis.fetch = originalFetch;
      Deno.env.get = originalEnv;
    }
  },
);

Deno.test('route requests keep a concurrency ceiling of four', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = Deno.env.get;
  Deno.env.get = name =>
    name === 'GOOGLE_API_URL' ? 'https://google.invalid' : 'test-key';
  let active = 0,
    peak = 0;
  globalThis.fetch = async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return response([route]);
  };
  try {
    const result = await callRouteItineraries(
      Array.from({ length: 8 }, (_, i) => ({
        ...participants[0],
        start_x: 127 + i * 0.001,
      })),
      stations,
    );
    assertEquals(
      result.map(s => s.itinerary.length),
      [8, 8],
    );
    assert(peak <= 4);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.get = originalEnv;
  }
});

Deno.test('empty routes never become invented travel times', async () => {
  await withApi(
    () => response([]),
    async () => {
      const results = await callRouteItineraries(participants, stations);
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
        const results = await callRouteItineraries(
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
        const results = await callRouteItineraries(participants, stations);
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
  'transit requests allow buses and trains, share a departure time, and fetch current estimates',
  async () => {
    const payloads: Record<string, unknown>[] = [];
    await withApi(
      payload => {
        payloads.push(payload);
        return response([route]);
      },
      async () => {
        await callRouteItineraries(participants, [stations[0]]);
        await callRouteItineraries(participants, [stations[0]]);
        assertEquals(payloads.length, 4);
        assertEquals(payloads[0].departureTime, payloads[1].departureTime);
        for (const payload of payloads) {
          assertEquals(payload.travelMode, 'TRANSIT');
          assertEquals(payload.transitPreferences, undefined);
          assertEquals(typeof payload.departureTime, 'string');
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
