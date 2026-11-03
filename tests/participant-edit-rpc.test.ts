import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = '20261103090000_participant_edit.sql';
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface Registration {
  participant_id: number;
  participant_token: string;
}
interface Room extends Registration {
  room_id: string;
  room_host_id: string;
}
interface Departure {
  name: string | null;
  region_name: string | null;
  full_address: string | null;
  start_x: number | null;
  start_y: number | null;
  travel_mode: string | null;
}
interface Participant extends Departure {
  id: number;
  room_id: string;
}
const edited: Departure = {
  name: '수정한 이름',
  region_name: '서울역',
  full_address: '서울 용산구 한강대로 405',
  start_x: 126.972,
  start_y: 37.554,
  travel_mode: 'car',
};
let legacyRoom: Pick<Room, 'room_id' | 'room_host_id'>;
let legacyParticipantId: number;

before(async () => {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE public_only;
    GRANT USAGE ON SCHEMA public TO anon, public_only;
  `);
  const directory = 'supabase/migrations';
  const files = (await readdir(directory))
    .filter(f => f.endsWith('.sql'))
    .sort();
  for (const file of files.filter(f => f < migration)) {
    await db.exec(await readFile(`${directory}/${file}`, 'utf8'));
  }
  await db.exec('SET ROLE anon');
  legacyRoom = await createRoom();
  const status = await roomStatus(legacyRoom);
  legacyParticipantId = status.participant[0].id;
  await db.exec('RESET ROLE');
  // Exercise explicit revocation even on hosts with permissive table defaults.
  await db.exec(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, PUBLIC',
  );
  for (const file of files.filter(f => f >= migration)) {
    await db.exec(await readFile(`${directory}/${file}`, 'utf8'));
  }
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

async function createRoom(): Promise<Room> {
  const { rows } = await db.query<{ room: Room }>(
    'SELECT location_together($1, $2, $3, $4, $5) AS room',
    ['방장', '강남역', '서울 강남구', 127, 37.5],
  );
  return rows[0].room;
}

async function joinRoom(room: Pick<Room, 'room_id'>, name = '친구') {
  const { rows } = await db.query<{
    registration: Registration & { msg: string };
  }>('SELECT location_join_room($1, $2, $3, $4, $5, $6) AS registration', [
    room.room_id,
    name,
    '홍대입구역',
    '서울 마포구',
    126.9,
    37.55,
  ]);
  return rows[0].registration;
}

async function roomStatus(room: Pick<Room, 'room_id'>) {
  const { rows } = await db.query<{
    status: { participant: Participant[]; recommendation_status: string };
  }>('SELECT location_room_status($1) AS status', [room.room_id]);
  return rows[0].status;
}

async function startRoom(room: Pick<Room, 'room_id' | 'room_host_id'>) {
  const { rows } = await db.query<{
    run: { participant: Participant[]; recommendation_run_id: string };
  }>('SELECT location_room_recommend_start($1, $2) AS run', [
    room.room_id,
    room.room_host_id,
  ]);
  return rows[0].run;
}

async function updateParticipant(
  room: Pick<Room, 'room_id'>,
  registration: { participant_id: number; participant_token: string | null },
  patch: Partial<Departure> = {},
) {
  const departure = { ...edited, ...patch };
  const { rows } = await db.query<{ result: { participant_id: number } }>(
    'SELECT location_update_participant($1, $2, $3, $4, $5, $6, $7, $8, $9) AS result',
    [
      room.room_id,
      registration.participant_id,
      registration.participant_token,
      departure.name,
      departure.region_name,
      departure.full_address,
      departure.start_x,
      departure.start_y,
      departure.travel_mode,
    ],
  );
  return rows[0].result;
}

function assertNoCapabilities(value: unknown, tokens: string[]) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /participant_token|participant_edit_capability/,
  );
  for (const token of tokens) assert.equal(serialized.includes(token), false);
}

test('legacy and named create/join signatures issue distinct participant capabilities', async () => {
  const room = await createRoom();
  const guest = await joinRoom(room, '방장');
  assert.deepEqual(Object.keys(room).sort(), [
    'participant_id',
    'participant_token',
    'room_host_id',
    'room_id',
  ]);
  assert.deepEqual(Object.keys(guest).sort(), [
    'msg',
    'participant_id',
    'participant_token',
  ]);
  assert.equal(guest.msg, '출발지 등록 완료');
  assert.ok(Number.isInteger(room.participant_id));
  assert.ok(Number.isInteger(guest.participant_id));
  assert.match(room.participant_token, uuid);
  assert.match(guest.participant_token, uuid);
  assert.equal(
    new Set([
      room.participant_token,
      guest.participant_token,
      room.room_host_id,
    ]).size,
    3,
  );
  const { rows } = await db.query<{ room: Room }>(`
    SELECT location_together(name => '방장', region_name => '서울', full_address => '서울 강남구',
      start_x => 127, start_y => 37.5, travel_mode => 'car') AS room
  `);
  const named = rows[0].room;
  const { rows: joined } = await db.query<{ registration: Registration }>(
    `
    SELECT location_join_room(p_room_id => $1, p_name => '도보', p_region_name => '서울',
      p_full_address => '서울 마포구', p_start_x => 126.9, p_start_y => 37.55,
      p_travel_mode => 'walk') AS registration
  `,
    [named.room_id],
  );
  assert.match(named.participant_token, uuid);
  assert.match(joined[0].registration.participant_token, uuid);
  assert.deepEqual(
    (await roomStatus(room)).participant.map(p => p.travel_mode),
    [null, null],
  );
  assert.deepEqual(
    (await roomStatus(named)).participant.map(p => p.travel_mode),
    ['car', 'walk'],
  );
});

test('creator and guest can edit only their own departure and preserve their IDs', async () => {
  const room = await createRoom();
  const guest = await joinRoom(room);
  const before = await roomStatus(room);
  assert.deepEqual(await updateParticipant(room, room), {
    participant_id: room.participant_id,
  });
  assert.deepEqual((await roomStatus(room)).participant, [
    { ...edited, id: room.participant_id, room_id: room.room_id },
    before.participant[1],
  ]);
  assert.deepEqual(
    await updateParticipant(room, guest, {
      name: '친구 수정',
      travel_mode: 'walk',
    }),
    { participant_id: guest.participant_id },
  );
  const run = await startRoom(room);
  assert.deepEqual(run.participant, [
    { ...edited, id: room.participant_id, room_id: room.room_id },
    {
      ...edited,
      name: '친구 수정',
      travel_mode: 'walk',
      id: guest.participant_id,
      room_id: room.room_id,
    },
  ]);
});

test('wrong, missing, other participant and host tokens cannot edit a participant', async () => {
  const room = await createRoom();
  const guest = await joinRoom(room);
  const before = await roomStatus(room);
  for (const token of [
    null,
    '',
    'wrong-token',
    guest.participant_token,
    room.room_host_id,
  ]) {
    await assert.rejects(
      updateParticipant(room, { ...room, participant_token: token }),
      { code: '42501' },
    );
  }
  await assert.rejects(
    updateParticipant(room, {
      ...guest,
      participant_token: room.participant_token,
    }),
    { code: '42501' },
  );
  assert.deepEqual(await roomStatus(room), before);
});

test('a valid capability cannot cross rooms or identify a different participant', async () => {
  const room = await createRoom();
  const other = await createRoom();
  const before = await roomStatus(room);
  const otherBefore = await roomStatus(other);
  await assert.rejects(updateParticipant(other, room), { code: '42501' });
  await assert.rejects(
    updateParticipant(room, { ...room, participant_id: other.participant_id }),
    { code: '42501' },
  );
  await assert.rejects(
    updateParticipant(room, { ...room, participant_id: -1 }),
    { code: '42501' },
  );
  await assert.rejects(
    updateParticipant(
      { room_id: '00000000-0000-4000-8000-000000000000' },
      room,
    ),
    { code: '42501' },
  );
  assert.deepEqual(await roomStatus(room), before);
  assert.deepEqual(await roomStatus(other), otherBefore);
});

test('pre-migration participants cannot be claimed by name, ID, host token or a new registration', async () => {
  const guest = await joinRoom(legacyRoom, '방장');
  const before = await roomStatus(legacyRoom);
  for (const token of [
    null,
    '',
    '방장',
    String(legacyParticipantId),
    legacyRoom.room_host_id,
    guest.participant_token,
  ]) {
    await assert.rejects(
      updateParticipant(legacyRoom, {
        participant_id: legacyParticipantId,
        participant_token: token,
      }),
      { code: '42501' },
    );
  }
  assert.deepEqual(await roomStatus(legacyRoom), before);
  const { rows } = await asOwner(() =>
    db.query(
      'SELECT participant_id FROM participant_edit_capability WHERE participant_id = $1',
      [legacyParticipantId],
    ),
  );
  assert.deepEqual(rows, []);
  await assert.rejects(
    db.query('SELECT location_together_room_id($1, $2, $3)', [
      legacyRoom.room_id,
      legacyRoom.room_host_id,
      [],
    ]),
    { code: '42501' },
  );
});

test('private capability storage blocks raw anon reads and writes and has RLS enabled', async () => {
  const room = await createRoom();
  for (const query of [
    'SELECT * FROM participant_edit_capability',
    "INSERT INTO participant_edit_capability(participant_id, token) VALUES (1, 'claimed')",
    "UPDATE participant_edit_capability SET token = 'claimed'",
    'DELETE FROM participant_edit_capability',
    'TRUNCATE participant_edit_capability',
    "UPDATE participant SET name = 'hijacked'",
    'SELECT * FROM participant',
  ])
    await assert.rejects(db.query(query), { code: '42501' });
  const { rows } = await db.query<{ relrowsecurity: boolean }>(
    "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.participant_edit_capability'::regclass",
  );
  assert.equal(rows[0].relrowsecurity, true);
  const stored = await asOwner(() =>
    db.query<{ participant_id: number; token: string }>(
      'SELECT participant_id, token FROM participant_edit_capability WHERE participant_id = $1',
      [room.participant_id],
    ),
  );
  assert.deepEqual(stored.rows, [
    { participant_id: room.participant_id, token: room.participant_token },
  ]);
});

test('PUBLIC cannot read capabilities or execute edit RPCs', async () => {
  await db.exec('RESET ROLE; SET ROLE public_only');
  try {
    await assert.rejects(
      db.query('SELECT * FROM participant_edit_capability'),
      { code: '42501' },
    );
    await assert.rejects(
      db.query(`
      SELECT location_update_participant(NULL, NULL, NULL, 'name', '서울', '서울', 127, 37)
    `),
      { code: '42501' },
    );
  } finally {
    await db.exec('RESET ROLE; SET ROLE anon');
  }
});

test('status, recommendation snapshots and result readers never expose participant capabilities', async () => {
  const room = await createRoom();
  const guest = await joinRoom(room);
  const tokens = [room.participant_token, guest.participant_token];
  assert.match(tokens[0], uuid);
  assert.match(tokens[1], uuid);
  assertNoCapabilities(await roomStatus(room), tokens);
  const run = await startRoom(room);
  assertNoCapabilities(run, tokens);
  const mapId = '11111111-2222-4333-8444-555555555555';
  await asOwner(() =>
    db.query(
      'INSERT INTO location_result(map_id, map_host_id, request_info) VALUES ($1, $2, $3)',
      [mapId, 'result-host', { participant: run.participant }],
    ),
  );
  const result = await db.query('SELECT location_result_by_map_id($1)', [
    mapId,
  ]);
  assertNoCapabilities(result.rows, tokens);
  const columns = await asOwner(() =>
    db.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'participant' ORDER BY ordinal_position
  `),
  );
  assert.deepEqual(
    columns.rows.map(row => row.column_name),
    [
      'id',
      'room_id',
      'name',
      'region_name',
      'full_address',
      'start_x',
      'start_y',
      'travel_mode',
    ],
  );
});

test('recommendation start and completion block edits and joins without changing the snapshot', async () => {
  const room = await createRoom();
  const guest = await joinRoom(room);
  const run = await startRoom(room);
  await assert.rejects(updateParticipant(room, room), { code: '55000' });
  await assert.rejects(updateParticipant(room, guest), { code: '55000' });
  await assert.rejects(joinRoom(room), { code: '55000' });
  const mapId = '22222222-2222-4333-8444-555555555555';
  await asOwner(() =>
    db.query(
      'INSERT INTO location_result(map_id, map_host_id, request_info) VALUES ($1, $2, $3)',
      [mapId, 'result-host', { participant: run.participant }],
    ),
  );
  const completed = await db.query(
    'SELECT location_room_recommend_complete($1, $2, $3, $4)',
    [room.room_id, room.room_host_id, mapId, run.recommendation_run_id],
  );
  assertNoCapabilities(completed.rows, [
    room.participant_token,
    guest.participant_token,
  ]);
  await assert.rejects(updateParticipant(room, room), { code: '55000' });
  await assert.rejects(updateParticipant(room, guest), { code: '55000' });
  await assert.rejects(joinRoom(room), { code: '55000' });
  const status = await roomStatus(room);
  assert.equal(status.recommendation_status, 'completed');
  assert.deepEqual(status.participant, run.participant);
  const count = await asOwner(() =>
    db.query<{ count: number }>(
      `
    SELECT count(*)::integer AS count FROM participant_edit_capability c
    JOIN participant p ON p.id = c.participant_id WHERE p.room_id = $1
  `,
      [room.room_id],
    ),
  );
  assert.equal(count.rows[0].count, 2);
});

test('failed recommendations allow edits and include the new departure in the retry', async () => {
  const room = await createRoom();
  const run = await startRoom(room);
  await db.query('SELECT location_room_recommend_fail($1, $2, $3)', [
    room.room_id,
    room.room_host_id,
    run.recommendation_run_id,
  ]);
  await updateParticipant(room, room);
  assert.equal((await roomStatus(room)).recommendation_status, 'failed');
  assert.deepEqual((await startRoom(room)).participant, [
    { ...edited, id: room.participant_id, room_id: room.room_id },
  ]);
});

for (const recovery of ['expired', 'missing run ID']) {
  test(`editing recovers a generating room with ${recovery} before any status poll`, async () => {
    const room = await createRoom();
    const run = await startRoom(room);
    await asOwner(() =>
      db.query(
        recovery === 'expired'
          ? "UPDATE location_room SET updated_at = now() - interval '5 minutes' WHERE room_id = $1"
          : 'UPDATE location_room SET recommendation_run_id = NULL WHERE room_id = $1',
        [room.room_id],
      ),
    );
    await assert.rejects(
      updateParticipant(room, { ...room, participant_token: 'wrong' }),
      { code: '42501' },
    );
    await updateParticipant(room, room);
    const { rows } = await asOwner(() =>
      db.query(
        `
      SELECT recommendation_status, recommendation_run_id, result_map_id
      FROM location_room WHERE room_id = $1
    `,
        [room.room_id],
      ),
    );
    assert.deepEqual(rows, [
      {
        recommendation_status: 'failed',
        recommendation_run_id: null,
        result_map_id: null,
      },
    ]);
    const retry = await startRoom(room);
    assert.notEqual(retry.recommendation_run_id, run.recommendation_run_id);
    assert.deepEqual(retry.participant, [
      { ...edited, id: room.participant_id, room_id: room.room_id },
    ]);
  });
}

test('joining still recovers abandoned runs and issues a usable private capability', async () => {
  const room = await createRoom();
  await startRoom(room);
  await asOwner(() =>
    db.query(
      "UPDATE location_room SET updated_at = now() - interval '5 minutes' WHERE room_id = $1",
      [room.room_id],
    ),
  );
  const guest = await joinRoom(room);
  assert.match(guest.participant_token, uuid);
  assert.equal((await roomStatus(room)).recommendation_status, 'failed');
  await updateParticipant(room, guest);
});

const invalidDepartures: Array<[string, Partial<Departure>]> = [
  ['null name', { name: null }],
  ['empty name', { name: '' }],
  ['whitespace name', { name: ' \t\n ' }],
  ['null region', { region_name: null }],
  ['empty region', { region_name: '' }],
  ['whitespace region', { region_name: ' \t\n ' }],
  ['null address', { full_address: null }],
  ['empty address', { full_address: '' }],
  ['whitespace address', { full_address: ' \t\n ' }],
  ['null longitude', { start_x: null }],
  ['null latitude', { start_y: null }],
  ['NaN longitude', { start_x: NaN }],
  ['NaN latitude', { start_y: NaN }],
  ['infinite longitude', { start_x: Infinity }],
  ['negative infinite longitude', { start_x: -Infinity }],
  ['infinite latitude', { start_y: Infinity }],
  ['negative infinite latitude', { start_y: -Infinity }],
  ['longitude above 180', { start_x: 180.001 }],
  ['longitude below -180', { start_x: -180.001 }],
  ['latitude above 90', { start_y: 90.001 }],
  ['latitude below -90', { start_y: -90.001 }],
  ['unknown mode', { travel_mode: 'bike' }],
  ['empty mode', { travel_mode: '' }],
];
for (const [label, patch] of invalidDepartures) {
  test(`editing rejects ${label} without modifying the participant`, async () => {
    const room = await createRoom();
    const before = await roomStatus(room);
    await assert.rejects(updateParticipant(room, room, patch), {
      code: '22023',
    });
    assert.deepEqual(await roomStatus(room), before);
  });
}

test('coordinate boundaries, all supported modes and omitted update mode remain usable', async () => {
  const room = await createRoom();
  for (const mode of ['car', 'walk', 'transit', null]) {
    await updateParticipant(room, room, {
      start_x: -180,
      start_y: -90,
      travel_mode: mode,
    });
    assert.equal((await roomStatus(room)).participant[0].travel_mode, mode);
  }
  const { rows } = await db.query<{ result: { participant_id: number } }>(
    `
    SELECT location_update_participant(p_room_id => $1, p_participant_id => $2,
      p_participant_token => $3, p_name => '경계', p_region_name => '지역', p_full_address => '주소',
      p_start_x => 180, p_start_y => 90) AS result
  `,
    [room.room_id, room.participant_id, room.participant_token],
  );
  assert.deepEqual(rows[0].result, { participant_id: room.participant_id });
  assert.deepEqual((await roomStatus(room)).participant[0], {
    id: room.participant_id,
    room_id: room.room_id,
    name: '경계',
    region_name: '지역',
    full_address: '주소',
    start_x: 180,
    start_y: 90,
    travel_mode: null,
  });
});

test('deleting a participant cascades to its private capability', async () => {
  const room = await createRoom();
  await asOwner(() =>
    db.query('DELETE FROM participant WHERE id = $1', [room.participant_id]),
  );
  const { rows } = await asOwner(() =>
    db.query(
      'SELECT * FROM participant_edit_capability WHERE participant_id = $1',
      [room.participant_id],
    ),
  );
  assert.deepEqual(rows, []);
  await assert.rejects(updateParticipant(room, room), { code: '42501' });
});
