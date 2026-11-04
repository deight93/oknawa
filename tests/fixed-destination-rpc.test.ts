import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type {
  RouteParticipant,
  RouteItinerary,
} from '../supabase/functions/lib/location-types';

const db = new PGlite();
const migration = '20261104090000_fixed_meeting_destination.sql';
const destination = {
  name: '서울역',
  address: '서울 용산구 한강대로 405',
  x: 126.972,
  y: 37.554,
};
const changedDestination = {
  name: '시청',
  address: '서울 중구 세종대로 110',
  x: 126.978,
  y: 37.566,
};
const hostDeparture: RouteParticipant = {
  name: '방장',
  region_name: '강남역',
  full_address: '서울 강남구 강남대로 396',
  start_x: 127.028,
  start_y: 37.498,
  travel_mode: 'car',
};
const guestDeparture: RouteParticipant = {
  name: '친구',
  region_name: '홍대입구역',
  full_address: '서울 마포구 양화로 160',
  start_x: 126.924,
  start_y: 37.557,
  travel_mode: 'walk',
};
interface Registration {
  participant_id: number;
  participant_token: string;
}
interface Room extends Registration {
  room_id: string;
  room_host_id: string;
}
interface Run {
  recommendation_run_id: string;
  meeting_destination: typeof destination | null;
  participant: RouteParticipant[];
}
interface Status {
  meeting_destination: typeof destination | null;
  recommendation_status: string;
  result_map_id: string | null;
  confirmed_share_key: string | null;
  participant: Array<RouteParticipant & { id: number; room_id: string }>;
}
interface Input {
  participant: RouteParticipant[];
  meeting_destination: typeof destination;
}
let legacyRoom: Room;

async function applyMigrations(database: PGlite, files: string[]) {
  for (const file of files) {
    await database.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
}
before(async () => {
  await db.exec(
    'CREATE ROLE anon; CREATE ROLE public_only; GRANT USAGE ON SCHEMA public TO anon, public_only;',
  );
  const files = (await readdir('supabase/migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort();
  await applyMigrations(
    db,
    files.filter(f => f < migration),
  );
  await db.exec('SET ROLE anon');
  legacyRoom = await createMidpointRoom();
  await db.exec('RESET ROLE');
  // Existing SQL suites have no service_role; applying this migration must still work.
  await applyMigrations(
    db,
    files.filter(f => f >= migration),
  );
  await db.exec('SET ROLE anon');
});
after(async () => {
  await db.close();
});

async function asOwner<T>(operation: () => Promise<T>): Promise<T> {
  await db.exec('RESET ROLE');
  try {
    return await operation();
  } finally {
    await db.exec('SET ROLE anon');
  }
}
async function createMidpointRoom() {
  const { rows } = await db.query<{ room: Room }>(
    'SELECT location_together($1, $2, $3, $4, $5) AS room',
    ['기존 방장', '서울', '서울 강남구', 127, 37.5],
  );
  return rows[0].room;
}
function departureArgs(participant: RouteParticipant) {
  return [
    participant.name,
    participant.region_name,
    participant.full_address,
    participant.start_x,
    participant.start_y,
    participant.travel_mode,
  ];
}
async function createRoom(meetingDestination: unknown = destination) {
  const { rows } = await db.query<{ room: Room }>(
    `SELECT location_destination_together(name => $1, region_name => $2, full_address => $3,
      start_x => $4, start_y => $5, travel_mode => $6, meeting_destination => $7) AS room`,
    [
      ...departureArgs(hostDeparture),
      meetingDestination === null ? null : JSON.stringify(meetingDestination),
    ],
  );
  return rows[0].room;
}
async function joinRoom(room: Room, travelMode: string | null = 'walk') {
  const { rows } = await db.query<{ registration: Registration }>(
    'SELECT location_join_room($1, $2, $3, $4, $5, $6, $7) AS registration',
    [
      room.room_id,
      guestDeparture.name,
      guestDeparture.region_name,
      guestDeparture.full_address,
      guestDeparture.start_x,
      guestDeparture.start_y,
      travelMode,
    ],
  );
  return rows[0].registration;
}
async function status(room: Room) {
  const { rows } = await db.query<{ status: Status }>(
    'SELECT location_room_status($1) AS status',
    [room.room_id],
  );
  return rows[0].status;
}
async function start(room: Room) {
  const { rows } = await db.query<{ run: Run }>(
    'SELECT location_room_recommend_start($1, $2) AS run',
    [room.room_id, room.room_host_id],
  );
  return rows[0].run;
}
async function input(
  room: Room,
  runId: string | null,
  hostId: string | null = room.room_host_id,
  database = db,
) {
  const { rows } = await database.query<{ input: Input }>(
    'SELECT location_destination_run_input(p_room_id => $1, p_room_host_id => $2, p_recommendation_run_id => $3) AS input',
    [room.room_id, hostId, runId],
  );
  return rows[0].input;
}
async function update(
  room: Room,
  value: unknown = changedDestination,
  hostId: string | null = room.room_host_id,
  expectedMapId?: string | null,
) {
  const args = [
    room.room_id,
    hostId,
    value === null ? null : JSON.stringify(value),
  ];
  if (expectedMapId !== undefined) {
    return db.query(
      'SELECT location_room_destination_update(p_room_id => $1, p_room_host_id => $2, p_meeting_destination => $3, p_expected_map_id => $4)',
      [...args, expectedMapId],
    );
  }
  // Keep exercising the legacy positional call with the optional argument omitted.
  return db.query('SELECT location_room_destination_update($1, $2, $3)', args);
}
async function storedRoom(room: Room) {
  return asOwner(async () => {
    const { rows } = await db.query<{ room: Record<string, unknown> }>(
      'SELECT to_jsonb(room.*) AS room FROM location_room AS room WHERE room_id = $1',
      [room.room_id],
    );
    return rows[0].room;
  });
}
async function expire(room: Room, missingRunId = false) {
  await asOwner(() =>
    db.query(
      `UPDATE location_room SET updated_at = CASE WHEN $2 THEN now() ELSE now() - interval '6 minutes' END,
      recommendation_run_id = CASE WHEN $2 THEN NULL ELSE recommendation_run_id END WHERE room_id = $1`,
      [room.room_id, missingRunId],
    ),
  );
}
function requestInfo(room: Room, run: Run, participants = [hostDeparture]) {
  const route: RouteItinerary = {
    name: '방장',
    region_name: '강남역',
    travel_mode: 'car',
    itinerary: { totalTime: 1800, total_polyline: [] },
  };
  return {
    participant: participants,
    meetingDestination: destination,
    destinationRoutes: participants.map((_, participantIndex) =>
      participantIndex === 0
        ? { participantIndex, status: 'ok', route }
        : { participantIndex, status: 'unavailable' },
    ),
    destinationRoom: { roomId: room.room_id, runId: run.recommendation_run_id },
  };
}
async function result(request: unknown, withStation = false) {
  const mapId = randomUUID();
  await asOwner(async () => {
    await db.query(
      'INSERT INTO location_result(map_id, map_host_id, request_info) VALUES ($1, $2, $3)',
      [mapId, 'private-map-host', request],
    );
    if (withStation)
      await db.query(
        'INSERT INTO station_info(map_id, share_key) VALUES ($1, $2)',
        [mapId, randomUUID()],
      );
  });
  return mapId;
}
async function complete(
  room: Room,
  runId: string | null,
  mapId: string,
  hostId = room.room_host_id,
) {
  return db.query('SELECT location_room_recommend_complete($1, $2, $3, $4)', [
    room.room_id,
    hostId,
    mapId,
    runId,
  ]);
}
function noCapabilities(value: unknown, tokens: string[]) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /room_host_id|map_host_id|hostId|participant_token|participant_edit_capability/,
  );
  for (const token of tokens) assert.equal(serialized.includes(token), false);
}
async function counts() {
  return asOwner(
    async () =>
      (
        await db.query(`SELECT
    (SELECT count(*) FROM location_room) AS rooms,
    (SELECT count(*) FROM participant) AS participants,
    (SELECT count(*) FROM participant_edit_capability) AS capabilities`)
      ).rows,
  );
}

test('atomic fixed-room creation returns private creator capabilities and persists destination in public snapshots', async () => {
  const room = await createRoom();
  assert.deepEqual(Object.keys(room).sort(), [
    'participant_id',
    'participant_token',
    'room_host_id',
    'room_id',
  ]);
  assert.ok(room.participant_id > 0);
  assert.ok(room.room_host_id);
  assert.ok(room.participant_token);
  assert.notEqual(room.room_host_id, room.participant_token);
  const snapshot = await status(room);
  assert.deepEqual(snapshot.meeting_destination, destination);
  assert.deepEqual(snapshot.participant, [
    { ...hostDeparture, id: room.participant_id, room_id: room.room_id },
  ]);
  assert.equal(snapshot.recommendation_status, 'idle');
  const run = await start(room);
  assert.deepEqual(run.meeting_destination, destination);
  assert.deepEqual(run.participant, snapshot.participant);
  assert.ok(run.recommendation_run_id);
  const publicSnapshot = await status(room);
  noCapabilities(publicSnapshot, [
    room.room_host_id,
    room.participant_token,
    run.recommendation_run_id,
  ]);
  noCapabilities(run, [room.room_host_id, room.participant_token]);
});

test('named creation can omit travel mode but never destination', async () => {
  const { rows } = await db.query<{ room: Room }>(
    `SELECT location_destination_together(
    name => '방장', region_name => '서울', full_address => '서울 강남구', start_x => 127, start_y => 37.5,
    meeting_destination => $1) AS room`,
    [destination],
  );
  assert.equal((await status(rows[0].room)).participant[0].travel_mode, null);
  const before = await counts();
  await assert.rejects(
    db.query(
      "SELECT location_destination_together('방장', '서울', '서울 강남구', 127, 37.5)",
    ),
    { code: '22023' },
  );
  assert.deepEqual(await counts(), before);
});

test('invalid destination shapes and nonfinite/out-of-range coordinates cannot create or update a room', async () => {
  const room = await createRoom();
  const before = await status(room);
  const beforeCounts = await counts();
  const invalid: unknown[] = [
    null,
    [],
    {},
    'destination',
    { ...destination, name: null },
    { ...destination, name: 1 },
    { ...destination, name: ' \t\n' },
    { ...destination, address: '' },
    { ...destination, address: {} },
    { name: '서울', address: '서울', x: 127 },
    { ...destination, x: null },
    { ...destination, y: null },
    { ...destination, x: '127' },
    { ...destination, y: true },
    { ...destination, x: 180.01 },
    { ...destination, x: -180.01 },
    { ...destination, y: 90.01 },
    { ...destination, y: -90.01 },
    { ...destination, x: 'NaN' },
    { ...destination, y: 'Infinity' },
    { ...destination, x: '-Infinity' },
  ];
  for (const value of invalid) {
    await assert.rejects(
      createRoom(value),
      { code: '22023' },
      JSON.stringify(value),
    );
    await assert.rejects(
      update(room, value),
      { code: '22023' },
      JSON.stringify(value),
    );
  }
  // Construct NaN in SQL too: JSON.stringify(NaN) would only test null.
  await assert.rejects(
    db.query(
      `SELECT location_room_destination_update($1, $2,
    jsonb_build_object('name', '서울', 'address', '서울', 'x', 'NaN'::float8, 'y', 37))`,
      [room.room_id, room.room_host_id],
    ),
    { code: '22023' },
  );
  assert.deepEqual(await status(room), before);
  assert.deepEqual(await counts(), beforeCounts);
});

test('destination save failure rolls back room, participant and edit capability creation', async () => {
  const before = await counts();
  await asOwner(() =>
    db.exec(`ALTER TABLE location_room ADD CONSTRAINT test_destination_save_failure
    CHECK (meeting_destination->>'name' IS DISTINCT FROM 'rollback')`),
  );
  try {
    await assert.rejects(createRoom({ ...destination, name: 'rollback' }), {
      code: '23514',
    });
    assert.deepEqual(await counts(), before);
  } finally {
    await asOwner(() =>
      db.exec(
        'ALTER TABLE location_room DROP CONSTRAINT test_destination_save_failure',
      ),
    );
  }
});

test('fixed creation rejects invalid host origins and travel modes without partial writes', async () => {
  const before = await counts();
  for (const [x, y, mode] of [
    [null, 37, 'car'],
    [181, 37, 'car'],
    [127, 91, 'car'],
    ['NaN', 37, 'car'],
    [127, 37, 'bike'],
  ]) {
    await assert.rejects(
      db.query(
        "SELECT location_destination_together('방장', '서울', '서울 강남구', $1, $2, $3, $4)",
        [x, y, mode, destination],
      ),
      { code: '22023' },
    );
  }
  assert.deepEqual(await counts(), before);
});

test('only the room host may change the destination; participant capabilities and other hosts are rejected', async () => {
  const room = await createRoom();
  const guest = await joinRoom(room);
  const other = await createRoom();
  const before = await status(room);
  for (const token of [
    null,
    '',
    'wrong',
    room.participant_token,
    guest.participant_token,
    other.room_host_id,
  ]) {
    await assert.rejects(update(room, changedDestination, token), {
      code: '42501',
    });
  }
  assert.deepEqual(await status(room), before);
  await update(room);
  assert.deepEqual(
    (await status(room)).meeting_destination,
    changedDestination,
  );
  assert.deepEqual((await status(room)).participant, before.participant);
});

test('run input uses ordered authoritative participants, including nullable legacy mode, and exposes no capabilities', async () => {
  const room = await createRoom();
  const guest = await joinRoom(room, null);
  // An update can change heap order; contract order must still be participant.id.
  await db.query(
    'SELECT location_update_participant($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [
      room.room_id,
      room.participant_id,
      room.participant_token,
      ...departureArgs(hostDeparture),
    ],
  );
  const run = await start(room);
  const snapshot = await input(room, run.recommendation_run_id);
  assert.deepEqual(snapshot, {
    participant: [hostDeparture, { ...guestDeparture, travel_mode: null }],
    meeting_destination: destination,
  });
  noCapabilities(snapshot, [
    room.room_host_id,
    room.participant_token,
    guest.participant_token,
    run.recommendation_run_id,
  ]);
  for (const token of [null, '', 'wrong', guest.participant_token]) {
    await assert.rejects(input(room, run.recommendation_run_id, token), {
      code: '42501',
    });
  }
  for (const runId of [null, randomUUID()])
    await assert.rejects(input(room, runId), { code: '55000' });
  await expire(room);
  await assert.rejects(input(room, run.recommendation_run_id), {
    code: '55000',
  });
});

test('fixed recommendation requires at least one participant and blocks joins and edits during an active run', async () => {
  const room = await createRoom();
  const run = await start(room);
  assert.equal(
    (await input(room, run.recommendation_run_id)).participant.length,
    1,
  );
  await assert.rejects(start(room), { code: '55000' });
  await assert.rejects(joinRoom(room), { code: '55000' });
  await assert.rejects(update(room), { code: '55000' });
  await assert.rejects(
    db.query(
      'SELECT location_update_participant($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        room.room_id,
        room.participant_id,
        room.participant_token,
        ...departureArgs(guestDeparture),
      ],
    ),
    { code: '55000' },
  );
  assert.deepEqual(await input(room, run.recommendation_run_id), {
    participant: [hostDeparture],
    meeting_destination: destination,
  });
  const empty = await createRoom();
  await asOwner(() =>
    db.query('DELETE FROM participant WHERE room_id = $1', [empty.room_id]),
  );
  await assert.rejects(start(empty), { code: '22023' });
  assert.equal((await status(empty)).recommendation_status, 'idle');
});

test('matching fixed results publish with no ranked stations or host tokens in the public result', async () => {
  const room = await createRoom();
  const guest = await joinRoom(room);
  const run = await start(room);
  const request = requestInfo(room, run, [hostDeparture, guestDeparture]);
  const mapId = await result(request);
  await complete(room, run.recommendation_run_id, mapId);
  assert.equal((await status(room)).result_map_id, mapId);
  assert.equal((await status(room)).recommendation_status, 'completed');
  const { rows } = await db.query<{
    result: { station_info: unknown[]; request_info: unknown };
  }>('SELECT location_result_by_map_id($1) AS result', [mapId]);
  assert.deepEqual(rows[0].result.station_info, []);
  assert.deepEqual(rows[0].result.request_info, request);
  noCapabilities(rows[0].result, [
    room.room_host_id,
    room.participant_token,
    guest.participant_token,
    'private-map-host',
  ]);
  await assert.rejects(input(room, run.recommendation_run_id), {
    code: '55000',
  });
  await assert.rejects(complete(room, run.recommendation_run_id, mapId), {
    code: '55000',
  });
});

test('midpoint, direct, wrong-room, wrong-run and changed-input results cannot publish to a fixed room', async () => {
  const room = await createRoom();
  await joinRoom(room);
  const run = await start(room);
  const valid = requestInfo(room, run, [hostDeparture, guestDeparture]);
  const { destinationRoom: _context, ...direct } = valid;
  const invalid = [
    null,
    { participant: valid.participant },
    direct,
    { ...valid, destinationRoom: null },
    {
      ...valid,
      destinationRoom: { ...valid.destinationRoom, roomId: randomUUID() },
    },
    {
      ...valid,
      destinationRoom: { ...valid.destinationRoom, runId: randomUUID() },
    },
    {
      ...valid,
      destinationRoom: { ...valid.destinationRoom, hostId: room.room_host_id },
    },
    { ...valid, meetingDestination: changedDestination },
    { ...valid, meetingDestination: null },
    { ...valid, participant: [hostDeparture] },
    { ...valid, participant: [guestDeparture, hostDeparture] },
    {
      ...valid,
      participant: [hostDeparture, { ...guestDeparture, start_x: 127 }],
    },
    {
      ...valid,
      participant: [
        hostDeparture,
        { ...guestDeparture, full_address: '변조 주소' },
      ],
    },
    {
      ...valid,
      participant: [hostDeparture, { ...guestDeparture, travel_mode: 'car' }],
    },
    {
      ...valid,
      participant: [hostDeparture, { ...guestDeparture, name: '변조 이름' }],
    },
    {
      ...valid,
      participant: [
        hostDeparture,
        { ...guestDeparture, region_name: '변조 지역' },
      ],
    },
  ];
  for (const request of invalid) {
    await assert.rejects(
      complete(room, run.recommendation_run_id, await result(request)),
      { code: '22023' },
    );
    assert.equal((await status(room)).recommendation_status, 'generating');
    assert.equal((await status(room)).result_map_id, null);
  }
  await assert.rejects(
    complete(room, run.recommendation_run_id, await result(valid, true)),
    { code: '22023' },
  );
  await complete(room, run.recommendation_run_id, await result(valid));
});

test('publication rejects missing or duplicate participant route entries and invalid route statuses', async () => {
  const room = await createRoom();
  await joinRoom(room);
  const run = await start(room);
  const valid = requestInfo(room, run, [hostDeparture, guestDeparture]);
  for (const routes of [
    null,
    {},
    [],
    [valid.destinationRoutes[0]],
    [valid.destinationRoutes[0], valid.destinationRoutes[0]],
    [
      valid.destinationRoutes[0],
      { participantIndex: 2, status: 'unavailable' },
    ],
    [
      valid.destinationRoutes[0],
      { participantIndex: '1', status: 'unavailable' },
    ],
    [valid.destinationRoutes[0], { participantIndex: 1, status: 'estimated' }],
    [
      valid.destinationRoutes[0],
      { participantIndex: 1, status: 'ok', route: null },
    ],
  ])
    await assert.rejects(
      complete(
        room,
        run.recommendation_run_id,
        await result({ ...valid, destinationRoutes: routes }),
      ),
      { code: '22023' },
    );
  await complete(room, run.recommendation_run_id, await result(valid));
});

test('expired and stale callbacks cannot replace a newer fixed run or its completed result', async () => {
  const room = await createRoom();
  const first = await start(room);
  const oldMap = await result(requestInfo(room, first));
  await expire(room);
  await assert.rejects(complete(room, first.recommendation_run_id, oldMap), {
    code: '55000',
  });
  const retry = await start(room);
  assert.notEqual(retry.recommendation_run_id, first.recommendation_run_id);
  const newMap = await result(requestInfo(room, retry));
  for (const runId of [null, first.recommendation_run_id]) {
    await assert.rejects(complete(room, runId, oldMap), { code: '55000' });
    await assert.rejects(
      db.query('SELECT location_room_recommend_fail($1, $2, $3)', [
        room.room_id,
        room.room_host_id,
        runId,
      ]),
      { code: '55000' },
    );
  }
  await assert.rejects(complete(room, retry.recommendation_run_id, oldMap), {
    code: '22023',
  });
  await assert.rejects(
    complete(room, retry.recommendation_run_id, newMap, 'wrong-host'),
    { code: '55000' },
  );
  await complete(room, retry.recommendation_run_id, newMap);
  await assert.rejects(
    db.query('SELECT location_room_recommend_fail($1, $2, $3)', [
      room.room_id,
      room.room_host_id,
      first.recommendation_run_id,
    ]),
    { code: '55000' },
  );
  assert.equal((await status(room)).result_map_id, newMap);
});

test('destination changes reopen completed rooms and clear result, run and confirmation without changing origins', async () => {
  const room = await createRoom();
  await joinRoom(room);
  const before = await status(room);
  const run = await start(room);
  const mapId = await result(
    requestInfo(room, run, [hostDeparture, guestDeparture]),
  );
  await complete(room, run.recommendation_run_id, mapId);
  await asOwner(() =>
    db.query(
      "UPDATE location_room SET confirmed_share_key = 'legacy-confirmed' WHERE room_id = $1",
      [room.room_id],
    ),
  );
  await update(room, changedDestination, room.room_host_id, mapId);
  const snapshot = await status(room);
  assert.equal(snapshot.recommendation_status, 'idle');
  assert.equal(snapshot.result_map_id, null);
  assert.equal(snapshot.confirmed_share_key, null);
  assert.deepEqual(snapshot.meeting_destination, changedDestination);
  assert.deepEqual(snapshot.participant, before.participant);
  const stored = await asOwner(() =>
    db.query<{ recommendation_run_id: string | null }>(
      'SELECT recommendation_run_id FROM location_room WHERE room_id = $1',
      [room.room_id],
    ),
  );
  assert.equal(stored.rows[0].recommendation_run_id, null);
  await joinRoom(room);
  const retry = await start(room);
  assert.deepEqual(
    (await input(room, retry.recommendation_run_id)).meeting_destination,
    changedDestination,
  );
  await assert.rejects(complete(room, retry.recommendation_run_id, mapId), {
    code: '22023',
  });
});

test('a stale list editor cannot clear a completed result by omitting or nulling the expected map', async () => {
  const room = await createRoom();
  // This list view was loaded before another tab completed the result.
  assert.equal((await status(room)).result_map_id, null);
  const run = await start(room);
  const mapId = await result(requestInfo(room, run));
  await complete(room, run.recommendation_run_id, mapId);
  const before = await storedRoom(room);

  await assert.rejects(update(room), { code: '55000' });
  assert.deepEqual(await storedRoom(room), before);
  await assert.rejects(
    update(room, changedDestination, room.room_host_id, null),
    { code: '55000' },
  );
  assert.deepEqual(await storedRoom(room), before);
  await update(room, changedDestination, room.room_host_id, mapId);
  assert.equal((await status(room)).recommendation_status, 'idle');
});

test('repeated old-result destination changes cannot overwrite a reopened room or its newer completed result', async () => {
  const room = await createRoom();
  const firstRun = await start(room);
  const oldMapId = await result(requestInfo(room, firstRun));
  await complete(room, firstRun.recommendation_run_id, oldMapId);
  assert.equal((await status(room)).result_map_id, oldMapId);

  await update(room, changedDestination, room.room_host_id, oldMapId);
  const reopened = await storedRoom(room);
  await assert.rejects(update(room, destination, room.room_host_id, oldMapId), {
    code: '55000',
  });
  assert.deepEqual(await storedRoom(room), reopened);

  const nextRun = await start(room);
  const newMapId = await result({
    ...requestInfo(room, nextRun),
    meetingDestination: changedDestination,
  });
  await complete(room, nextRun.recommendation_run_id, newMapId);
  const newerResult = await storedRoom(room);
  // Both requests carry the map ID read before the other tab changed the room.
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(
      update(room, destination, room.room_host_id, oldMapId),
      { code: '55000' },
    );
    assert.deepEqual(await storedRoom(room), newerResult);
  }
  await assert.rejects(update(room, destination, 'wrong-host', newMapId), {
    code: '42501',
  });
  assert.deepEqual(await storedRoom(room), newerResult);
  await update(room, destination, room.room_host_id, newMapId);
  assert.equal((await status(room)).result_map_id, null);
  assert.deepEqual((await status(room)).meeting_destination, destination);
});

test('an explicit null expected map permits list edits only while no result exists', async () => {
  const room = await createRoom();
  await update(room, changedDestination, room.room_host_id, null);
  assert.deepEqual(
    (await status(room)).meeting_destination,
    changedDestination,
  );
  await update(room, destination);
  assert.deepEqual((await status(room)).meeting_destination, destination);
});

test('destination updates recover expired and unidentified runs without requiring a status poll', async () => {
  for (const missingRunId of [false, true]) {
    const room = await createRoom();
    const oldRun = await start(room);
    await expire(room, missingRunId);
    await update(room);
    assert.equal((await status(room)).recommendation_status, 'idle');
    assert.deepEqual(
      (await status(room)).meeting_destination,
      changedDestination,
    );
    await assert.rejects(input(room, oldRun.recommendation_run_id), {
      code: '55000',
    });
    assert.notEqual(
      (await start(room)).recommendation_run_id,
      oldRun.recommendation_run_id,
    );
  }
});

test('public polling recovers an expired fixed run while preserving its destination', async () => {
  const room = await createRoom();
  await start(room);
  await expire(room);
  const snapshot = await status(room);
  assert.equal(snapshot.recommendation_status, 'failed');
  assert.deepEqual(snapshot.meeting_destination, destination);
  await joinRoom(room);
  assert.equal((await start(room)).participant.length, 2);
});

test('fixed-room host cannot overwrite a guest origin using either host capability', async () => {
  const room = await createRoom();
  const guest = await joinRoom(room);
  const before = await status(room);
  for (const token of [room.room_host_id, room.participant_token]) {
    await assert.rejects(
      db.query(
        'SELECT location_update_participant($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          room.room_id,
          guest.participant_id,
          token,
          ...departureArgs(hostDeparture),
        ],
      ),
      { code: '42501' },
    );
  }
  await assert.rejects(
    db.query('SELECT location_together_room_id($1, $2, $3)', [
      room.room_id,
      room.room_host_id,
      [hostDeparture],
    ]),
    { code: '42501' },
  );
  assert.deepEqual(await status(room), before);
  await db.query(
    'SELECT location_update_participant($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [
      room.room_id,
      guest.participant_id,
      guest.participant_token,
      ...departureArgs(hostDeparture),
    ],
  );
  assert.equal(
    (await status(room)).participant[1].start_x,
    hostDeparture.start_x,
  );
});

test('pre-existing and new midpoint rooms retain their lifecycle and cannot be converted through destination update', async () => {
  for (const room of [legacyRoom, await createMidpointRoom()]) {
    assert.equal((await status(room)).meeting_destination, null);
    await assert.rejects(update(room), { code: '22023' });
    const run = await start(room);
    assert.equal(run.meeting_destination, null);
    await assert.rejects(input(room, run.recommendation_run_id), {
      code: '22023',
    });
    const mapId = await result({ participant: run.participant }, true);
    await complete(room, run.recommendation_run_id, mapId);
    assert.equal((await status(room)).result_map_id, mapId);
    assert.equal((await status(room)).recommendation_status, 'completed');
  }
});

test('anon has no raw table access and PUBLIC cannot execute the new capability RPCs', async () => {
  const room = await createRoom();
  const run = await start(room);
  for (const query of [
    'SELECT * FROM location_room',
    'SELECT * FROM participant',
    'SELECT * FROM location_result',
    'SELECT * FROM participant_edit_capability',
    'UPDATE location_room SET meeting_destination = NULL',
    'UPDATE participant SET start_x = 0',
  ]) {
    await assert.rejects(db.query(query), { code: '42501' });
  }
  const { rows } = await db.query<{ relrowsecurity: boolean }>(
    "SELECT relrowsecurity FROM pg_class WHERE oid IN ('location_room'::regclass, 'participant'::regclass, 'location_result'::regclass, 'participant_edit_capability'::regclass)",
  );
  assert.equal(rows.length, 4);
  assert.ok(rows.every(row => row.relrowsecurity));
  await db.exec('RESET ROLE; SET ROLE public_only');
  try {
    await assert.rejects(createRoom(), { code: '42501' });
    await assert.rejects(update(room), { code: '42501' });
    await assert.rejects(
      update(room, changedDestination, room.room_host_id, null),
      { code: '42501' },
    );
    await assert.rejects(input(room, run.recommendation_run_id), {
      code: '42501',
    });
    await assert.rejects(status(room), { code: '42501' });
    await assert.rejects(start(room), { code: '42501' });
  } finally {
    await db.exec('RESET ROLE; SET ROLE anon');
  }
});

test('service_role receives explicit snapshot execution permission and still needs valid room/run capabilities', async () => {
  const serviceDb = new PGlite();
  try {
    await serviceDb.exec(
      'CREATE ROLE anon; CREATE ROLE service_role; GRANT USAGE ON SCHEMA public TO anon, service_role;',
    );
    await applyMigrations(
      serviceDb,
      (await readdir('supabase/migrations'))
        .filter(f => f.endsWith('.sql'))
        .sort(),
    );
    await serviceDb.exec('SET ROLE anon');
    const { rows } = await serviceDb.query<{ room: Room }>(
      "SELECT location_destination_together('방장', '서울', '서울 강남구', 127, 37.5, NULL, $1) AS room",
      [destination],
    );
    const room = rows[0].room;
    const started = await serviceDb.query<{ run: Run }>(
      'SELECT location_room_recommend_start($1, $2) AS run',
      [room.room_id, room.room_host_id],
    );
    await serviceDb.exec('RESET ROLE; SET ROLE service_role');
    const runId = started.rows[0].run.recommendation_run_id;
    assert.deepEqual(
      (await input(room, runId, room.room_host_id, serviceDb))
        .meeting_destination,
      destination,
    );
    await assert.rejects(input(room, runId, 'wrong-host', serviceDb), {
      code: '42501',
    });
    await assert.rejects(
      input(room, randomUUID(), room.room_host_id, serviceDb),
      { code: '55000' },
    );
  } finally {
    await serviceDb.close();
  }
});
