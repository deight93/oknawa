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
  RouteStep,
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
const googleGuidance = [
  { mode: 'walk', durationSeconds: 61, distanceMeters: 150 },
  { mode: 'transit', durationSeconds: 600, distanceMeters: 5000 },
  { mode: 'walk', durationSeconds: 120, distanceMeters: 300 },
] satisfies RouteStep[];
const transitDetails = {
  stopDetails: {
    departureStop: {
      name: ' 강남역 ',
      location: { latLng: { latitude: 37.501, longitude: 127.001 } },
    },
    arrivalStop: {
      name: '역삼역',
      location: { latLng: { latitude: 37.505, longitude: 127.012 } },
    },
  },
  transitLine: {
    nameShort: ' 2호선 ',
    name: '서울 지하철 2호선',
    vehicle: { type: 'SUBWAY' },
  },
  headsign: ' 성수 방면 ',
  stopCount: 4,
};
const transitGuidance = {
  lineName: '2호선',
  vehicleType: 'SUBWAY',
  headsign: '성수 방면',
  departureStop: { name: '강남역', location: { lat: 37.501, lng: 127.001 } },
  arrivalStop: { name: '역삼역', location: { lat: 37.505, lng: 127.012 } },
  stopCount: 4,
};

Deno.test(
  'Google transit requests step polylines and only required guidance fields without extra requests',
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
            'routes.legs.steps.transitDetails.stopDetails.departureStop.name',
            'routes.legs.steps.transitDetails.stopDetails.departureStop.location.latLng',
            'routes.legs.steps.transitDetails.stopDetails.arrivalStop.name',
            'routes.legs.steps.transitDetails.stopDetails.arrivalStop.location.latLng',
            'routes.legs.steps.transitDetails.transitLine.nameShort',
            'routes.legs.steps.transitDetails.transitLine.name',
            'routes.legs.steps.transitDetails.transitLine.vehicle.type',
            'routes.legs.steps.transitDetails.headsign',
            'routes.legs.steps.transitDetails.stopCount',
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
        const expected = {
          ...googleSummary,
          segments: googleSegments,
          steps: googleGuidance,
        };
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
          steps: [
            googleGuidance[0],
            googleGuidance[1],
            googleGuidance[1],
            googleGuidance[2],
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
            const knownMode =
              typeof step === 'object' &&
              step !== null &&
              'travelMode' in step &&
              step.travelMode === 'WALK';
            assertEquals<unknown>(result[0].itinerary[0].itinerary, {
              ...googleSummary,
              ...(knownMode
                ? { steps: [...googleGuidance, { mode: 'walk' }] }
                : {}),
            });
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
              steps: googleGuidance,
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
  'Google guidance preserves stops and ordered modes independently of step geometry',
  async t => {
    for (const fixture of [
      { name: 'complete geometry', polyline: googleSteps[0].polyline },
      { name: 'missing walking geometry', polyline: undefined },
      {
        name: 'malformed walking geometry',
        polyline: { encodedPolyline: '???' },
      },
    ]) {
      await t.step(fixture.name, async () => {
        await withApi(
          () =>
            response([
              {
                ...segmentedGoogleRoute,
                legs: [
                  {
                    steps: [
                      { ...googleSteps[0], polyline: fixture.polyline },
                      { ...googleSteps[1], transitDetails },
                    ],
                  },
                  { steps: [googleSteps[2]] },
                ],
              },
            ]),
          async () => {
            const result = await callRouteItineraries(
              [participants[0]],
              [stations[0]],
            );
            assertEquals<unknown>(result[0].itinerary[0].itinerary, {
              ...googleSummary,
              ...(fixture.name === 'complete geometry'
                ? { segments: googleSegments }
                : {}),
              steps: [
                googleGuidance[0],
                { ...googleGuidance[1], transit: transitGuidance },
                googleGuidance[2],
              ],
            });
          },
        );
      });
    }
  },
);

Deno.test(
  'Google guidance validates partial transit metadata without inventing stop names or coordinates',
  async t => {
    const cases: Array<{ name: string; details: unknown; expected?: unknown }> =
      [
        {
          name: 'all metadata with no geometry',
          details: transitDetails,
          expected: transitGuidance,
        },
        { name: 'missing details', details: undefined },
        { name: 'null details', details: null },
        { name: 'string details', details: '2호선' },
        { name: 'array details', details: [] },
        {
          name: 'empty objects',
          details: {
            transitLine: { vehicle: {} },
            stopDetails: { departureStop: {}, arrivalStop: {} },
          },
        },
        {
          name: 'fallback line name and zero count',
          details: {
            transitLine: { nameShort: '  ', name: ' 서울 지하철 2호선 ' },
            stopCount: 0,
          },
          expected: { lineName: '서울 지하철 2호선', stopCount: 0 },
        },
        {
          name: 'stop name without any location',
          details: { stopDetails: { departureStop: { name: ' 강남역 ' } } },
          expected: { departureStop: { name: '강남역' } },
        },
        {
          name: 'zero coordinates without a name',
          details: {
            stopDetails: {
              arrivalStop: {
                location: { latLng: { latitude: 0, longitude: 0 } },
              },
            },
          },
          expected: { arrivalStop: { location: { lat: 0, lng: 0 } } },
        },
        {
          name: 'coordinate limits',
          details: {
            stopDetails: {
              departureStop: {
                location: { latLng: { latitude: -90, longitude: -180 } },
              },
              arrivalStop: {
                location: { latLng: { latitude: 90, longitude: 180 } },
              },
            },
          },
          expected: {
            departureStop: { location: { lat: -90, lng: -180 } },
            arrivalStop: { location: { lat: 90, lng: 180 } },
          },
        },
        {
          name: 'non-string text and malformed nested records',
          details: {
            transitLine: {
              nameShort: 2,
              name: ['2호선'],
              vehicle: { type: {} },
            },
            headsign: false,
            stopDetails: { departureStop: '강남역', arrivalStop: [] },
            stopCount: '4',
          },
        },
        {
          name: 'control characters are not display text',
          details: {
            transitLine: {
              nameShort: '2\u0000호선',
              name: '2호선',
              vehicle: { type: 'SUB\u007fWAY' },
            },
            headsign: '성수\n방면',
            stopDetails: { departureStop: { name: '강남\u0085역' } },
          },
          expected: { lineName: '2호선' },
        },
        {
          name: 'blank strings',
          details: {
            transitLine: { nameShort: '', name: ' ', vehicle: { type: '\t' } },
            headsign: ' ',
            stopDetails: { departureStop: { name: ' ' } },
          },
        },
        ...[
          ['string latitude', { latitude: '37.5', longitude: 127 }],
          ['string longitude', { latitude: 37.5, longitude: '127' }],
          ['missing longitude', { latitude: 37.5 }],
          ['latitude above range', { latitude: 90.1, longitude: 127 }],
          ['latitude below range', { latitude: -90.1, longitude: 127 }],
          ['longitude above range', { latitude: 37.5, longitude: 180.1 }],
          ['longitude below range', { latitude: 37.5, longitude: -180.1 }],
          ['null coordinate', { latitude: null, longitude: 127 }],
          ['array coordinate', [37.5, 127]],
        ].map(([name, latLng]) => ({
          name: String(name),
          details: {
            stopDetails: {
              departureStop: { name: '강남역', location: { latLng } },
            },
          },
          expected: { departureStop: { name: '강남역' } },
        })),
        {
          name: 'no inferred coordinates from other provider fields',
          details: {
            stopDetails: {
              departureStop: { latLng: { latitude: 37.5, longitude: 127 } },
              arrivalStop: { location: { latitude: 37.5, longitude: 127 } },
            },
          },
        },
        ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(stopCount => ({
          name: `invalid stop count ${stopCount}`,
          details: { stopCount, headsign: '성수 방면' },
          expected: { headsign: '성수 방면' },
        })),
      ];
    for (const fixture of cases) {
      await t.step(fixture.name, async () => {
        await withApi(
          () =>
            response([
              {
                duration: '1800s',
                legs: [
                  {
                    steps: [
                      {
                        travelMode: 'TRANSIT',
                        staticDuration: '0s',
                        distanceMeters: 0,
                        transitDetails: fixture.details,
                      },
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
            assertEquals<unknown>(result[0].itinerary[0].itinerary, {
              totalTime: 1800,
              transferCount: 0,
              walkingTime: 0,
              walkingDistance: 0,
              total_polyline: [],
              steps: [
                {
                  mode: 'transit',
                  durationSeconds: 0,
                  distanceMeters: 0,
                  ...(fixture.expected ? { transit: fixture.expected } : {}),
                },
              ],
            });
          },
        );
      });
    }
  },
);

Deno.test(
  'Google guidance keeps zero metrics and omits unsafe optional durations and distances',
  async t => {
    const cases = [
      {
        name: 'zero',
        staticDuration: '0s',
        distanceMeters: 0,
        expected: { durationSeconds: 0, distanceMeters: 0 },
      },
      {
        name: 'fractional seconds',
        staticDuration: '0.2s',
        distanceMeters: 1.5,
        expected: { durationSeconds: 1, distanceMeters: 1.5 },
      },
      {
        name: 'missing',
        staticDuration: undefined,
        distanceMeters: undefined,
        expected: {},
      },
      {
        name: 'null',
        staticDuration: null,
        distanceMeters: null,
        expected: {},
      },
      {
        name: 'wrong types',
        staticDuration: 20,
        distanceMeters: '15',
        expected: {},
      },
      {
        name: 'negative',
        staticDuration: '-1s',
        distanceMeters: -1,
        expected: {},
      },
      {
        name: 'malformed',
        staticDuration: '10seconds',
        distanceMeters: {},
        expected: {},
      },
      {
        name: 'unsafe range',
        staticDuration: '9007199254740992s',
        distanceMeters: Number.MAX_SAFE_INTEGER + 1,
        expected: {},
      },
      {
        name: 'nonfinite',
        staticDuration: '9'.repeat(400) + 's',
        distanceMeters: Infinity,
        expected: {},
      },
    ];
    for (const fixture of cases) {
      await t.step(fixture.name, async () => {
        await withApi(
          () =>
            response([
              {
                duration: '1800s',
                legs: [
                  {
                    steps: [
                      {
                        travelMode: 'TRANSIT',
                        staticDuration: fixture.staticDuration,
                        distanceMeters: fixture.distanceMeters,
                      },
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
            const itinerary = result[0].itinerary[0].itinerary;
            assert('steps' in itinerary);
            assertEquals(itinerary.steps, [
              { mode: 'transit', ...fixture.expected },
            ]);
          },
        );
      });
    }
  },
);

Deno.test(
  'Google guidance is absent for empty legs or an unknown mode anywhere in the journey',
  async t => {
    const validLeg = { steps: [{ ...googleSteps[1], transitDetails }] };
    const cases: Array<[string, unknown]> = [
      ['missing legs', undefined],
      ['null legs', null],
      ['empty legs', []],
      ['non-array legs', {}],
      ['empty leg', [validLeg, { steps: [] }]],
      ['missing leg steps', [validLeg, {}]],
      ['null leg', [validLeg, null]],
      ['unknown mode', [validLeg, { steps: [{ travelMode: 'DRIVE' }] }]],
      ['missing mode', [validLeg, { steps: [{ transitDetails }] }]],
      ['null step', [validLeg, { steps: [null] }]],
    ];
    for (const [name, legs] of cases) {
      await t.step(name, async () => {
        await withApi(
          () => response([{ ...segmentedGoogleRoute, legs }]),
          async () => {
            const result = await callRouteItineraries(
              [participants[0]],
              [stations[0]],
            );
            assertEquals(result[0].itinerary.length, 1);
            assert(!('steps' in result[0].itinerary[0].itinerary));
          },
        );
      });
    }
  },
);

Deno.test(
  'Kakao guidance retains single-mode summaries when geometry is missing',
  async t => {
    for (const mode of ['walk', 'car'] satisfies TravelMode[]) {
      for (const value of [0, 120]) {
        await t.step(`${mode}: ${value}`, async () => {
          await withApi(
            () =>
              Response.json(
                mode === 'car'
                  ? {
                      routes: [
                        {
                          result_code: 0,
                          summary: { duration: value, distance: value },
                        },
                      ],
                    }
                  : {
                      status: 'OK',
                      route: {
                        properties: { totalTime: value, totalDistance: value },
                      },
                    },
              ),
            async () => {
              const result = await callRouteItineraries(
                [{ ...participants[0], travel_mode: mode }],
                [stations[0]],
              );
              const itinerary = result[0].itinerary[0].itinerary;
              assert('steps' in itinerary);
              assertEquals(itinerary.steps, [
                { mode, durationSeconds: value, distanceMeters: value },
              ]);
              assertEquals(itinerary.total_polyline, []);
              assert(!('segments' in itinerary));
            },
          );
        });
      }
    }
  },
);

Deno.test(
  'Kakao car guidance omits unknown or invalid summary distances',
  async t => {
    for (const distance of [
      undefined,
      null,
      '7000',
      -1,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await t.step(String(distance), async () => {
        await withApi(
          () =>
            Response.json({
              routes: [{ result_code: 0, summary: { duration: 0, distance } }],
            }),
          async () => {
            const result = await callRouteItineraries(
              [{ ...participants[0], travel_mode: 'car' }],
              [stations[0]],
            );
            const itinerary = result[0].itinerary[0].itinerary;
            assert('steps' in itinerary);
            assertEquals(itinerary.steps, [
              { mode: 'car', durationSeconds: 0 },
            ]);
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
              steps: [
                {
                  mode,
                  durationSeconds: mode === 'car' ? 1500 : 900,
                  distanceMeters: mode === 'car' ? 7000 : 1000,
                },
              ],
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
                steps: [
                  {
                    mode,
                    durationSeconds: mode === 'car' ? 1500 : 900,
                    distanceMeters: mode === 'car' ? 7000 : 1000,
                  },
                ],
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
      const itinerary = same[0].itinerary[0].itinerary;
      assert('steps' in itinerary);
      assertEquals(itinerary.steps, [
        { mode: 'walk', durationSeconds: 0, distanceMeters: 0 },
      ]);
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
