import {
  assert,
  assertEquals,
  assertMatch,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'jsr:@supabase/supabase-js';
import { handleLocationDestinationRequest } from '../lib/location-destination.ts';
import type { RouteParticipant } from '../lib/location-types.ts';

const destination = {
  name: '약속 카페',
  address: '서울 강남구 테헤란로 1',
  x: 127.02,
  y: 37.5,
};
const participant: RouteParticipant = {
  name: '동명이인',
  region_name: '출발역',
  full_address: '서울 강남구 출발로 1',
  start_x: 127,
  start_y: 37.5,
  travel_mode: 'transit',
};
const roomContext = {
  roomId: '11111111-1111-4111-8111-111111111111',
  hostId: '22222222-2222-4222-8222-222222222222',
  runId: '33333333-3333-4333-8333-333333333333',
};
const direct = {
  participant: [participant],
  meetingDestination: destination,
};
const transitResponse = {
  routes: [{ duration: '1800s', legs: [{ steps: [] }] }],
};
const carResponse = {
  routes: [{ result_code: 0, summary: { duration: 1500 }, sections: [] }],
};
const walkResponse = {
  status: 'OK',
  route: {
    properties: { totalTime: 900, totalDistance: 1000 },
    legs: [],
  },
};

function post(body: unknown): Request {
  return new Request('https://edge.invalid/location-destination', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function object(value: unknown): Record<string, unknown> {
  assert(typeof value === 'object' && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}

interface BackendOptions {
  snapshot?: unknown;
  snapshotFailure?: 'error' | 'throw';
  snapshotErrorCode?: string;
  insertFailure?: 'error' | 'empty' | 'throw';
  route?: (url: URL, init?: RequestInit) => Response | Promise<Response>;
}

async function withBackend(
  options: BackendOptions,
  run: (backend: {
    handle: (body: unknown) => Promise<Response>;
    inserts: Record<string, unknown>[];
    rpcCalls: Record<string, unknown>[];
    routeCalls: { url: URL; init?: RequestInit }[];
  }) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalEnv = Deno.env.get;
  const inserts: Record<string, unknown>[] = [];
  const rpcCalls: Record<string, unknown>[] = [];
  const routeCalls: { url: URL; init?: RequestInit }[] = [];
  const unexpected: string[] = [];
  Deno.env.get = name =>
    name === 'GOOGLE_API_URL' ? 'https://google.invalid' : 'test-key';
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'db.invalid') {
      assertEquals(init?.method, 'POST');
      const body = object(JSON.parse(String(init?.body)));
      if (url.pathname === '/rest/v1/rpc/location_destination_run_input') {
        rpcCalls.push(body);
        if (options.snapshotFailure === 'throw') throw new Error('RPC offline');
        if (options.snapshotFailure === 'error') {
          return Response.json(
            {
              code: options.snapshotErrorCode ?? 'P0001',
              message: `invalid capability ${roomContext.hostId}`,
            },
            { status: 400 },
          );
        }
        return Response.json(options.snapshot ?? null);
      }
      if (url.pathname === '/rest/v1/location_result') {
        assertEquals(url.searchParams.get('select'), 'map_id,map_host_id');
        inserts.push(body);
        if (options.insertFailure === 'throw') throw new Error('DB offline');
        if (options.insertFailure === 'error') {
          return Response.json(
            { code: '23514', message: `private failure ${roomContext.hostId}` },
            { status: 400 },
          );
        }
        if (options.insertFailure === 'empty') return Response.json(null);
        return Response.json({
          map_id: body.map_id,
          map_host_id: body.map_host_id,
        });
      }
    } else if (
      url.hostname === 'google.invalid' ||
      url.hostname === 'apis-navi.kakaomobility.com' ||
      url.hostname === 'dapi.kakao.com'
    ) {
      routeCalls.push({ url, init });
      if (options.route) return await options.route(url, init);
      return Response.json(
        url.hostname === 'google.invalid'
          ? transitResponse
          : url.hostname === 'apis-navi.kakaomobility.com'
            ? carResponse
            : walkResponse,
      );
    }
    unexpected.push(url.href);
    throw new Error(`Unexpected fetch ${url.href}`);
  };
  const createSupabase = () =>
    createClient('https://db.invalid', 'test-service-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  try {
    await run({
      handle: body =>
        handleLocationDestinationRequest(post(body), createSupabase),
      inserts,
      rpcCalls,
      routeCalls,
    });
    assertEquals(unexpected, []);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.get = originalEnv;
  }
}

Deno.test(
  'destination HTTP methods and malformed JSON never open a DB client',
  async () => {
    let clientCalls = 0;
    const createSupabase = () => {
      clientCalls++;
      throw new Error('client must not be created');
    };
    const options = await handleLocationDestinationRequest(
      new Request('https://edge.invalid', { method: 'OPTIONS' }),
      createSupabase,
    );
    assertEquals(options.status, 200);
    assertEquals(options.headers.get('Access-Control-Allow-Origin'), '*');
    await options.text();
    const get = await handleLocationDestinationRequest(
      new Request('https://edge.invalid'),
      createSupabase,
    );
    assertEquals(get.status, 405);
    assertEquals((await get.json()).errorCode, 'method_not_allowed');
    const badJson = await handleLocationDestinationRequest(
      new Request('https://edge.invalid', { method: 'POST', body: '{' }),
      createSupabase,
    );
    assertEquals(badJson.status, 400);
    assertEquals((await badJson.json()).errorCode, 'invalid_json_body');
    assertEquals(clientCalls, 0);
  },
);

Deno.test(
  'destination rejects malformed bodies, destinations, participants and room capabilities',
  async () => {
    const cases: { body: unknown; code: string }[] = [
      ...[null, [], 'invalid', 1].map(body => ({
        body,
        code: 'invalid_request_body',
      })),
      ...[
        undefined,
        null,
        {},
        { ...destination, name: ' ' },
        { ...destination, address: '' },
        { ...destination, x: '127' },
        { ...destination, x: 181 },
        { ...destination, y: -91 },
        { ...destination, y: Infinity },
      ].map(meetingDestination => ({
        body: { ...direct, meetingDestination },
        code: 'invalid_meeting_destination',
      })),
      ...[
        undefined,
        null,
        [],
        {},
        [null],
        [{ ...participant, start_x: '127' }],
        [{ ...participant, start_y: 91 }],
        [{ ...participant, full_address: null }],
        [{ ...participant, name: ' ' }],
        [{ ...participant, travel_mode: 'bicycle' }],
      ].map(participant => ({
        body: { ...direct, participant },
        code: 'invalid_participant',
      })),
      ...[
        null,
        {},
        [],
        { ...roomContext, roomId: 'not-a-uuid' },
        { ...roomContext, hostId: '' },
        { ...roomContext, hostId: 123 },
        { ...roomContext, runId: 'stale' },
      ].map(roomContext => ({
        body: { ...direct, roomContext },
        code: 'invalid_room_context',
      })),
    ];
    let clientCalls = 0;
    for (const { body, code } of cases) {
      const response = await handleLocationDestinationRequest(
        post(body),
        () => {
          clientCalls++;
          throw new Error('invalid input must not reach DB');
        },
      );
      assertEquals(response.status, 400, JSON.stringify(body));
      assertEquals((await response.json()).errorCode, code);
    }
    assertEquals(clientCalls, 0);
  },
);

for (const shared of [false, true]) {
  Deno.test(
    `${shared ? 'shared' : 'direct'} destination rejects over fifty origins before provider calls`,
    async () => {
      const participants = Array.from({ length: 51 }, () => participant);
      await withBackend(
        {
          snapshot: {
            participant: participants,
            meeting_destination: destination,
          },
        },
        async ({ handle, inserts, routeCalls, rpcCalls }) => {
          const response = await handle(
            shared
              ? { ...direct, roomContext }
              : { ...direct, participant: participants },
          );
          assertEquals(response.status, 400);
          assertEquals(await response.json(), {
            error: '한 번에 출발지 50곳까지 조회할 수 있어요.',
            errorCode: 'too_many_participants',
            message: '한 번에 출발지 50곳까지 조회할 수 있어요.',
          });
          assertEquals(routeCalls, []);
          assertEquals(inserts, []);
          assertEquals(rpcCalls.length, shared ? 1 : 0);
        },
      );
    },
  );
}

Deno.test(
  'shared destination accepts fifty authoritative origins despite oversized client input',
  async () => {
    const participants = Array.from({ length: 50 }, (_, index) => ({
      ...participant,
      start_x: 127 + index / 1000,
    }));
    await withBackend(
      {
        snapshot: {
          participant: participants,
          meeting_destination: destination,
        },
      },
      async ({ handle, inserts, routeCalls }) => {
        const response = await handle({
          ...direct,
          roomContext,
          participant: Array.from({ length: 51 }, () => participant),
        });
        assertEquals(response.status, 200);
        await response.json();
        assertEquals(routeCalls.length, 50);
        assertEquals(inserts.length, 1);
        const info = object(inserts[0].request_info);
        assertEquals(info.participant, participants);
        const routes = info.destinationRoutes;
        assert(Array.isArray(routes));
        assertEquals(routes.length, 50);
      },
    );
  },
);

Deno.test(
  'destination accepts a single origin and stores only the public request contract',
  async () => {
    await withBackend({}, async ({ handle, inserts, rpcCalls }) => {
      const response = await handle({
        ...direct,
        participant: [
          { ...participant, private_edit_token: 'secret', hostId: 'secret' },
        ],
        meetingDestination: { ...destination, hostId: 'secret' },
        destinationRoom: roomContext,
        destinationRoutes: [
          { participantIndex: 0, status: 'ok', route: 'forged' },
        ],
      });
      assertEquals(response.status, 200);
      assertEquals(rpcCalls, []);
      assertEquals(inserts.length, 1);
      const row = inserts[0];
      assertEquals(Object.keys(row).sort(), [
        'confirmed',
        'map_host_id',
        'map_id',
        'request_info',
      ]);
      assertEquals(row.confirmed, null);
      assertMatch(String(row.map_id), /^[0-9a-f-]{36}$/);
      assertMatch(String(row.map_host_id), /^[0-9a-f-]{36}$/);
      assert(row.map_id !== row.map_host_id);
      assertEquals(await response.json(), {
        map_id: row.map_id,
        map_host_id: row.map_host_id,
      });
      assertEquals(row.request_info, {
        participant: [participant],
        meetingDestination: destination,
        destinationRoutes: [
          {
            participantIndex: 0,
            status: 'ok',
            route: {
              name: participant.name,
              region_name: participant.region_name,
              travel_mode: 'transit',
              itinerary: {
                totalTime: 1800,
                transferCount: 0,
                walkingTime: 0,
                walkingDistance: 0,
                total_polyline: [],
              },
            },
          },
        ],
      });
    });
  },
);

Deno.test(
  'destination keeps mixed modes and duplicate-name indexes across a partial route failure',
  async () => {
    const participants = [
      participant,
      { ...participant, start_x: 127.01, travel_mode: 'walk' },
      { ...participant, start_x: 127.03, travel_mode: 'car' },
    ];
    await withBackend(
      {
        route: url =>
          Response.json(
            url.hostname === 'google.invalid'
              ? transitResponse
              : url.hostname === 'apis-navi.kakaomobility.com'
                ? carResponse
                : { status: 'NO_ROUTE' },
          ),
      },
      async ({ handle, inserts, routeCalls }) => {
        const response = await handle({ ...direct, participant: participants });
        assertEquals(response.status, 200);
        await response.json();
        assertEquals(object(inserts[0].request_info), {
          participant: participants,
          meetingDestination: destination,
          destinationRoutes: [
            {
              participantIndex: 0,
              status: 'ok',
              route: {
                name: participant.name,
                region_name: participant.region_name,
                travel_mode: 'transit',
                itinerary: {
                  totalTime: 1800,
                  transferCount: 0,
                  walkingTime: 0,
                  walkingDistance: 0,
                  total_polyline: [],
                },
              },
            },
            { participantIndex: 1, status: 'unavailable' },
            {
              participantIndex: 2,
              status: 'ok',
              route: {
                name: participant.name,
                region_name: participant.region_name,
                travel_mode: 'car',
                itinerary: {
                  totalTime: 1500,
                  transferCount: 0,
                  walkingTime: 0,
                  walkingDistance: 0,
                  total_polyline: [],
                },
              },
            },
          ],
        });
        assertEquals(routeCalls.length, 3);
        const walk = routeCalls.find(
          call => call.url.hostname === 'dapi.kakao.com',
        );
        assert(walk);
        assertEquals(walk.url.searchParams.get('start_x'), '127.01');
        assertEquals(walk.url.searchParams.get('end_x'), '127.02');
        const car = routeCalls.find(
          call => call.url.hostname === 'apis-navi.kakaomobility.com',
        );
        assert(car);
        assertEquals(car.url.searchParams.get('origin'), '127.03,37.5');
        assertEquals(car.url.searchParams.get('destination'), '127.02,37.5');
      },
    );
  },
);

Deno.test(
  'destination stores all unavailable indexes without invented times or mode substitution',
  async () => {
    await withBackend(
      {
        route: url =>
          Response.json(
            url.hostname === 'google.invalid'
              ? { routes: [] }
              : url.hostname === 'apis-navi.kakaomobility.com'
                ? { routes: [{ result_code: 0, summary: { duration: -1 } }] }
                : { status: 'NO_ROUTE' },
          ),
      },
      async ({ handle, inserts, routeCalls }) => {
        const participants = ['transit', 'car', 'walk'].map(travel_mode => ({
          ...participant,
          travel_mode,
        }));
        const response = await handle({ ...direct, participant: participants });
        assertEquals(response.status, 200);
        await response.json();
        assertEquals(object(inserts[0].request_info).destinationRoutes, [
          { participantIndex: 0, status: 'unavailable' },
          { participantIndex: 1, status: 'unavailable' },
          { participantIndex: 2, status: 'unavailable' },
        ]);
        assertEquals(routeCalls.length, 3);
      },
    );
  },
);

Deno.test(
  'destination deduplicates identical routes without sharing participant identity or modes',
  async () => {
    const participants = [
      participant,
      { ...participant, name: '다른 사람', region_name: '다른 출발지 표기' },
      { ...participant, travel_mode: 'car' },
      { ...participant, travel_mode: 'walk' },
    ];
    await withBackend({}, async ({ handle, inserts, routeCalls }) => {
      const response = await handle({ ...direct, participant: participants });
      assertEquals(response.status, 200);
      await response.json();
      assertEquals(routeCalls.length, 3);
      const routes = object(inserts[0].request_info).destinationRoutes;
      assert(Array.isArray(routes));
      assertEquals(
        routes.map(item => ({
          index: item.participantIndex,
          name: item.route.name,
          region: item.route.region_name,
          mode: item.route.travel_mode,
          time: item.route.itinerary.totalTime,
        })),
        [
          {
            index: 0,
            name: '동명이인',
            region: '출발역',
            mode: 'transit',
            time: 1800,
          },
          {
            index: 1,
            name: '다른 사람',
            region: '다른 출발지 표기',
            mode: 'transit',
            time: 1800,
          },
          {
            index: 2,
            name: '동명이인',
            region: '출발역',
            mode: 'car',
            time: 1500,
          },
          {
            index: 3,
            name: '동명이인',
            region: '출발역',
            mode: 'walk',
            time: 900,
          },
        ],
      );
      const next = await handle({ ...direct, participant: participants });
      await next.json();
      assertEquals(
        routeCalls.length,
        6,
        'dedupe must not reuse old estimates between searches',
      );
    });
  },
);

Deno.test(
  'destination routes fifty origins with at most four requests and one departure time',
  async () => {
    let active = 0;
    let peak = 0;
    await withBackend(
      {
        route: async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise(resolve => setTimeout(resolve, 2));
          active--;
          return Response.json(transitResponse);
        },
      },
      async ({ handle, inserts, routeCalls }) => {
        const participants = Array.from({ length: 50 }, (_, index) => ({
          ...participant,
          start_x: 127 + index / 1000,
        }));
        const response = await handle({ ...direct, participant: participants });
        assertEquals(response.status, 200);
        await response.json();
        assert(peak > 1 && peak <= 4, `peak concurrency ${peak}`);
        assertEquals(routeCalls.length, 50);
        const payloads = routeCalls.map(call =>
          object(JSON.parse(String(call.init?.body))),
        );
        assertEquals(
          new Set(payloads.map(payload => payload.departureTime)).size,
          1,
        );
        assert(Number.isFinite(Date.parse(String(payloads[0].departureTime))));
        assertEquals(payloads[0].destination, {
          location: { latLng: { latitude: 37.5, longitude: 127.02 } },
        });
        const routes = object(inserts[0].request_info).destinationRoutes;
        assert(Array.isArray(routes));
        assertEquals(
          routes.map(route => route.participantIndex),
          Array.from({ length: 50 }, (_, index) => index),
        );
      },
    );
  },
);

Deno.test(
  'shared destination ignores tampering and persists the authoritative snapshot order and nullable mode',
  async () => {
    const participants = [
      { ...participant, name: 'Z', travel_mode: null },
      { ...participant, name: 'A', start_x: 127.01, travel_mode: 'walk' },
    ];
    await withBackend(
      {
        snapshot: {
          participant: participants,
          meeting_destination: destination,
        },
      },
      async ({ handle, inserts, rpcCalls, routeCalls }) => {
        const response = await handle({
          roomContext,
          participant: 'ignore invalid client origins',
          meetingDestination: { ...destination, x: 0, name: 'forged' },
          destinationRoutes: [
            { participantIndex: 0, status: 'ok', route: 'forged' },
          ],
          destinationRoom: { roomId: 'forged', runId: 'forged' },
        });
        assertEquals(response.status, 200);
        await response.json();
        assertEquals(rpcCalls, [
          {
            p_room_id: roomContext.roomId,
            p_room_host_id: roomContext.hostId,
            p_recommendation_run_id: roomContext.runId,
          },
        ]);
        const info = object(inserts[0].request_info);
        assertEquals(Object.keys(info).sort(), [
          'destinationRoom',
          'destinationRoutes',
          'meetingDestination',
          'participant',
        ]);
        assertEquals(info.participant, participants);
        assertEquals(info.meetingDestination, destination);
        assertEquals(info.destinationRoom, {
          roomId: roomContext.roomId,
          runId: roomContext.runId,
        });
        assert(!JSON.stringify(inserts).includes(roomContext.hostId));
        const routes = info.destinationRoutes;
        assert(Array.isArray(routes));
        assertEquals(
          routes.map(item => [
            item.participantIndex,
            item.route.name,
            item.route.travel_mode,
          ]),
          [
            [0, 'Z', 'transit'],
            [1, 'A', 'walk'],
          ],
        );
        const google = routeCalls.find(
          call => call.url.hostname === 'google.invalid',
        );
        assert(google);
        const payload = object(JSON.parse(String(google.init?.body)));
        assertEquals(payload.origin, {
          location: { latLng: { latitude: 37.5, longitude: 127 } },
        });
        assertEquals(payload.destination, {
          location: { latLng: { latitude: 37.5, longitude: 127.02 } },
        });
      },
    );
  },
);

Deno.test(
  'shared snapshot errors or malformed snapshots never fall back to client input',
  async () => {
    const cases: BackendOptions[] = [
      { snapshotFailure: 'error' },
      { snapshotFailure: 'throw' },
      { snapshot: null },
      { snapshot: {} },
      { snapshot: { participant: [], meeting_destination: destination } },
      {
        snapshot: {
          participant: [participant],
          meeting_destination: { ...destination, x: 181 },
        },
      },
    ];
    for (const options of cases) {
      await withBackend(
        options,
        async ({ handle, inserts, routeCalls, rpcCalls }) => {
          const response = await handle({ ...direct, roomContext });
          assert(response.status >= 400);
          const payload = await response.json();
          assertEquals(payload.errorCode, 'destination_snapshot_failed');
          assert(!JSON.stringify(payload).includes(roomContext.hostId));
          assertEquals(inserts, []);
          assertEquals(routeCalls, []);
          assertEquals(rpcCalls.length, 1);
        },
      );
    }
  },
);

Deno.test(
  'destination insert errors and missing rows never report successful result ids',
  async () => {
    for (const insertFailure of ['error', 'empty', 'throw'] as const) {
      await withBackend({ insertFailure }, async ({ handle, inserts }) => {
        const response = await handle(direct);
        assertEquals(response.status, 500);
        const payload = await response.json();
        assertEquals(payload.errorCode, 'location_result_insert_failed');
        assertEquals(payload.map_id, undefined);
        assert(!JSON.stringify(payload).includes(roomContext.hostId));
        assertEquals(inserts.length, 1);
      });
    }
  },
);

Deno.test(
  'destination unexpected setup failures return a safe structured error',
  async () => {
    const response = await handleLocationDestinationRequest(
      post(direct),
      () => {
        throw new Error(`private failure ${roomContext.hostId}`);
      },
    );
    assertEquals(response.status, 500);
    const body = await response.json();
    assertEquals(body.errorCode, 'internal_error');
    assert(!JSON.stringify(body).includes(roomContext.hostId));
  },
);

Deno.test(
  'shared destination reports capability and expired-run errors without exposing RPC details',
  async () => {
    for (const [snapshotErrorCode, status] of [
      ['42501', 403],
      ['55000', 409],
      ['22023', 400],
      ['XX000', 500],
    ] as const) {
      await withBackend(
        { snapshotFailure: 'error', snapshotErrorCode },
        async ({ handle, inserts, routeCalls }) => {
          const response = await handle({ roomContext });
          assertEquals(response.status, status, snapshotErrorCode);
          const payload = await response.json();
          assertEquals(payload.errorCode, 'destination_snapshot_failed');
          assert(!JSON.stringify(payload).includes(roomContext.hostId));
          assertEquals(inserts, []);
          assertEquals(routeCalls, []);
        },
      );
    }
  },
);
