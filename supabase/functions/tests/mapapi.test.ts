import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { callRouteItineraries } from '../lib/mapapi.ts';
import {
  buildStationItineraries,
  selectBestStationItineraries,
} from '../lib/location-points.ts';
import type {
  PopularMeetingLocation,
  RouteSegment,
  TravelMode,
} from '../lib/location-types.ts';

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
  handler: (
    payload: Record<string, unknown>,
    init: RequestInit | undefined,
  ) => Response,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalEnv = Deno.env.get;
  Deno.env.get = name =>
    name === 'GOOGLE_API_URL' ? 'https://test.invalid' : 'test-key';
  globalThis.fetch = async (input, init) =>
    String(input).includes('/local/')
      ? new Response(JSON.stringify({ meta: { total_count: 0 } }))
      : handler(init?.body ? JSON.parse(String(init.body)) : {}, init);
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

const googleSteps = [
  {
    travelMode: 'WALK',
    staticDuration: '60.2s',
    distanceMeters: 150,
    polyline: { encodedPolyline: '_f{cF_ucfWgEgE' },
  },
  {
    travelMode: 'TRANSIT',
    staticDuration: '600s',
    distanceMeters: 5000,
    polyline: { encodedPolyline: 'gl{cFg{cfW_XwcA' },
  },
  {
    travelMode: 'WALK',
    staticDuration: '120s',
    distanceMeters: 300,
    polyline: { encodedPolyline: 'ok|cFgfffWgEgE' },
  },
];
const segmentedGoogleRoute = {
  duration: '1800s',
  polyline: { encodedPolyline: '_f{cF_ucfWg^_jAoKoK' },
  legs: [{ steps: googleSteps.slice(0, 2) }, { steps: googleSteps.slice(2) }],
};
const googleSummary = {
  totalTime: 1800,
  transferCount: 0,
  walkingTime: 181,
  walkingDistance: 450,
  total_polyline: [
    { lat: 37.5, lng: 127 },
    { lat: 37.505, lng: 127.012 },
    { lat: 37.507, lng: 127.014 },
  ],
};
const googleSegments: RouteSegment[] = [
  {
    mode: 'walk',
    polyline: [
      { lat: 37.5, lng: 127 },
      { lat: 37.501, lng: 127.001 },
    ],
  },
  {
    mode: 'transit',
    polyline: [
      { lat: 37.501, lng: 127.001 },
      { lat: 37.505, lng: 127.012 },
    ],
  },
  {
    mode: 'walk',
    // Keep this provider gap: no connector should be inserted.
    polyline: [
      { lat: 37.506, lng: 127.013 },
      { lat: 37.507, lng: 127.014 },
    ],
  },
];

Deno.test(
  'Google transit requests step polylines without extra requests',
  async () => {
    const fieldMasks: Array<string | null> = [];
    await withApi(
      (_payload, init) => {
        fieldMasks.push(new Headers(init?.headers).get('X-Goog-FieldMask'));
        return response([segmentedGoogleRoute]);
      },
      async () => {
        await callRouteItineraries([participants[0]], [stations[0]]);
        assertEquals(fieldMasks.length, 1);
        assertEquals(
          new Set(fieldMasks[0]?.split(',')),
          new Set([
            'routes.duration',
            'routes.legs.steps.distanceMeters',
            'routes.legs.steps.staticDuration',
            'routes.legs.steps.travelMode',
            'routes.legs.steps.polyline.encodedPolyline',
            'routes.polyline.encodedPolyline',
          ]),
        );
      },
    );
  },
);

Deno.test(
  'Google transit preserves ordered walk/transit/walk segments and route totals',
  async () => {
    await withApi(
      () => response([segmentedGoogleRoute]),
      async () => {
        const result = await callRouteItineraries(
          [participants[0], { ...participants[0], name: 'Duplicate origin' }],
          [stations[0]],
        );
        const expected = { ...googleSummary, segments: googleSegments };
        assertEquals(result[0].itinerary.length, 2);
        for (const item of result[0].itinerary) {
          assertEquals(item.travel_mode, 'transit');
          assertEquals(item.itinerary, expected);
        }
      },
    );
  },
);

Deno.test(
  'Google transit retains transfers and separate adjacent transit segments',
  async () => {
    await withApi(
      () =>
        response([
          {
            ...segmentedGoogleRoute,
            legs: [
              {
                steps: [
                  googleSteps[0],
                  googleSteps[1],
                  googleSteps[1],
                  googleSteps[2],
                ],
              },
            ],
          },
        ]),
      async () => {
        const result = await callRouteItineraries(
          [participants[0]],
          [stations[0]],
        );
        const expected = {
          ...googleSummary,
          transferCount: 1,
          segments: [
            googleSegments[0],
            googleSegments[1],
            googleSegments[1],
            googleSegments[2],
          ],
        };
        assertEquals(result[0].itinerary[0].itinerary, expected);
      },
    );
  },
);

Deno.test(
  'Google transit omits all segments for an unknown, missing, or invalid step without losing the route',
  async t => {
    const invalidSteps: Array<[string, unknown]> = [
      [
        'unknown mode',
        { travelMode: 'DRIVE', polyline: googleSteps[0].polyline },
      ],
      ['missing mode', { polyline: googleSteps[0].polyline }],
      ['null step', null],
      ['missing polyline', { travelMode: 'WALK' }],
      ['null polyline', { travelMode: 'WALK', polyline: null }],
      ...[
        ['missing encoding', undefined],
        ['non-string encoding', 123],
        ['empty encoding', ''],
        ['one point', '_f{cF_ucfW'],
        ['truncated encoding', '_f{cF_ucfWgEg'],
        ['invalid characters', '_f{cF_ucfW!!'],
        ['overflowing encoding', '~'.repeat(220) + '???'],
        ['latitude above range', '_f{cF_ucfW_fpeI?fzneIovA'],
        ['longitude above range', '_f{cF_ucfWg^_{qhIoKncohI'],
        ['latitude below range', '_f{cF_ucfW~shoW?w_joWovA'],
        ['longitude below range', '_f{cF_ucfWg^~f{vy@oKo~}vy@'],
      ].map(([name, encodedPolyline]): [string, unknown] => [
        String(name),
        {
          travelMode: 'WALK',
          polyline: { encodedPolyline },
        },
      ]),
    ];
    for (const [name, step] of invalidSteps) {
      await t.step(name, async () => {
        await withApi(
          () =>
            response([
              {
                ...segmentedGoogleRoute,
                legs: [...segmentedGoogleRoute.legs, { steps: [step] }],
              },
            ]),
          async () => {
            const result = await callRouteItineraries(
              [participants[0]],
              [stations[0]],
            );
            assertEquals(result[0].itinerary.length, 1);
            assertEquals(result[0].itinerary[0].itinerary, googleSummary);
          },
        );
      });
    }
  },
);

Deno.test(
  'Google transit requires steps in every leg before publishing segments',
  async t => {
    for (const leg of [
      null,
      {},
      { steps: [] },
      { steps: null },
      { steps: {} },
    ]) {
      await t.step(JSON.stringify(leg), async () => {
        await withApi(
          () =>
            response([
              {
                ...segmentedGoogleRoute,
                legs: [...segmentedGoogleRoute.legs, leg],
              },
            ]),
          async () => {
            const result = await callRouteItineraries(
              [participants[0]],
              [stations[0]],
            );
            assertEquals(result[0].itinerary.length, 1);
            assertEquals(result[0].itinerary[0].itinerary, googleSummary);
          },
        );
      });
    }
  },
);

Deno.test(
  'Google transit keeps valid steps and totals when the overall polyline is missing or malformed',
  async t => {
    for (const overall of [
      undefined,
      null,
      {},
      { encodedPolyline: 123 },
      { encodedPolyline: { length: 1 } },
      { encodedPolyline: '???' },
      { encodedPolyline: '~'.repeat(220) + '???' },
    ]) {
      await t.step(String(JSON.stringify(overall)), async () => {
        await withApi(
          () => response([{ ...segmentedGoogleRoute, polyline: overall }]),
          async () => {
            const result = await callRouteItineraries(
              [participants[0]],
              [stations[0]],
            );
            const expected = {
              ...googleSummary,
              total_polyline: [],
              segments: googleSegments,
            };
            assertEquals(result[0].itinerary.length, 1);
            assertEquals(result[0].itinerary[0].itinerary, expected);
          },
        );
      });
    }
  },
);

Deno.test(
  'Kakao walking and car routes publish one segment from the complete provider path',
  async t => {
    for (const mode of ['walk', 'car'] satisfies TravelMode[]) {
      await t.step(mode, async () => {
        let calls = 0;
        await withApi(
          () => {
            calls++;
            return Response.json(mode === 'car' ? carResponse : walkResponse);
          },
          async () => {
            const result = await callRouteItineraries(
              [{ ...participants[0], travel_mode: mode }],
              [stations[0]],
            );
            const points = [
              { lat: 37.5, lng: mode === 'car' ? 127.04 : 127.06 },
              { lat: 37.5, lng: 127.02 },
            ];
            const expected = {
              totalTime: mode === 'car' ? 1500 : 900,
              transferCount: 0,
              walkingTime: mode === 'car' ? 0 : 900,
              walkingDistance: mode === 'car' ? 0 : 1000,
              total_polyline: points,
              segments: [{ mode, polyline: points }],
            };
            assertEquals(calls, 1);
            assertEquals(result[0].itinerary[0].itinerary, expected);
          },
        );
      });
    }
  },
);

Deno.test(
  'Kakao omits segments for incomplete or invalid paths while retaining available geometry and totals',
  async t => {
    const cases = [
      { name: 'empty', points: [], expected: [] },
      {
        name: 'one point',
        points: [[127.04, 37.5]],
        expected: [{ lat: 37.5, lng: 127.04 }],
      },
      {
        name: 'out of range',
        points: [
          [127.04, 37.5],
          [181, 37.5],
          [127.02, 37.5],
        ],
        expected: [
          { lat: 37.5, lng: 127.04 },
          { lat: 37.5, lng: 127.02 },
        ],
      },
      {
        name: 'null coordinate',
        points: [
          [127.04, 37.5],
          [127, null],
          [127.02, 37.5],
        ],
        expected: [
          { lat: 37.5, lng: 127.04 },
          { lat: 37.5, lng: 127.02 },
        ],
      },
      {
        name: 'incomplete pair',
        points: [[127.04, 37.5], [127.02, 37.5], [127]],
        expected: [
          { lat: 37.5, lng: 127.04 },
          { lat: 37.5, lng: 127.02 },
        ],
      },
    ];
    for (const mode of ['walk', 'car'] satisfies TravelMode[]) {
      for (const fixture of cases) {
        await t.step(`${mode}: ${fixture.name}`, async () => {
          await withApi(
            () =>
              Response.json(
                mode === 'car'
                  ? {
                      routes: [
                        {
                          ...carResponse.routes[0],
                          sections: [
                            { roads: [{ vertexes: fixture.points.flat() }] },
                          ],
                        },
                      ],
                    }
                  : {
                      ...walkResponse,
                      route: {
                        ...walkResponse.route,
                        legs: [
                          { steps: [{ path: { points: fixture.points } }] },
                        ],
                      },
                    },
              ),
            async () => {
              const result = await callRouteItineraries(
                [{ ...participants[0], travel_mode: mode }],
                [stations[0]],
              );
              const expected = {
                totalTime: mode === 'car' ? 1500 : 900,
                transferCount: 0,
                walkingTime: mode === 'car' ? 0 : 900,
                walkingDistance: mode === 'car' ? 0 : 1000,
                total_polyline: fixture.expected,
              };
              assertEquals(result[0].itinerary[0].itinerary, expected);
            },
          );
        });
      }
      await t.step(`${mode}: missing path part`, async () => {
        await withApi(
          () =>
            Response.json(
              mode === 'car'
                ? {
                    routes: [
                      {
                        ...carResponse.routes[0],
                        sections: [...carResponse.routes[0].sections, {}],
                      },
                    ],
                  }
                : {
                    ...walkResponse,
                    route: {
                      ...walkResponse.route,
                      legs: [...walkResponse.route.legs, {}],
                    },
                  },
            ),
          async () => {
            const result = await callRouteItineraries(
              [{ ...participants[0], travel_mode: mode }],
              [stations[0]],
            );
            assertEquals(result[0].itinerary.length, 1);
            const itinerary = result[0].itinerary[0].itinerary;
            assert(!('segments' in itinerary));
            assertEquals(itinerary.total_polyline.length, 2);
            assertEquals(itinerary.totalTime, mode === 'car' ? 1500 : 900);
          },
        );
      });
    }
  },
);

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
      assertEquals(same[0].itinerary[0].itinerary.total_polyline, [
        { lat: 37.5, lng: 127.02 },
      ]);
      assert(!('segments' in same[0].itinerary[0].itinerary));
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
