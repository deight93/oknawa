import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Participant } from '../src/types/location';

const db = new PGlite();
const mapId = '11111111-1111-4111-8111-111111111111';
const hostToken = 'test-host-capability';
const shareKey = 'test-share-key';

before(async () => {
  await db.exec('CREATE ROLE anon; GRANT USAGE ON SCHEMA public TO anon;');
  const directory = 'supabase/migrations';
  for (const file of (await readdir(directory))
    .filter(f => f.endsWith('.sql'))
    .sort()) {
    await db.exec(await readFile(`${directory}/${file}`, 'utf8'));
  }
  await db.query(
    'INSERT INTO location_result (map_id, map_host_id, request_info) VALUES ($1, $2, $3)',
    [mapId, hostToken, { participant: [] }],
  );
  await db.query(
    'INSERT INTO station_info (map_id, share_key, station_name) VALUES ($1, $2, $3)',
    [mapId, shareKey, '테스트역'],
  );
  await db.exec('SET ROLE anon');
});

after(async () => {
  await db.close();
});

test('public result reads do not disclose the host capability', async () => {
  const { rows } = await db.query<{ result: Record<string, unknown> }>(
    'SELECT location_result_by_map_id($1) AS result',
    [mapId],
  );
  assert.equal(rows[0].result.map_id, mapId);
  assert.equal('map_host_id' in rows[0].result, false);
  assert.equal(JSON.stringify(rows[0].result).includes(hostToken), false);
  assert.equal(Array.isArray(rows[0].result.station_info), true);
});

test('room creation returns a host capability that public room reads omit', async () => {
  const { rows: created } = await db.query<{
    room: { room_id: string; room_host_id: string };
  }>('SELECT location_together($1, $2, $3, $4, $5) AS room', [
    '호스트',
    '서울역',
    '서울특별시',
    127,
    37,
  ]);
  const room = created[0].room;
  assert.ok(room.room_host_id);
  const { rows } = await db.query<{ status: Record<string, unknown> }>(
    'SELECT location_room_status($1) AS status',
    [room.room_id],
  );
  assert.equal(rows[0].status.room_id, room.room_id);
  assert.equal('room_host_id' in rows[0].status, false);
  assert.equal(
    JSON.stringify(rows[0].status).includes(room.room_host_id),
    false,
  );
  assert.equal((rows[0].status.participant as unknown[]).length, 1);
  await assert.rejects(
    db.query('SELECT location_room_recommend_start($1, $2, $3, $4)', [
      room.room_id,
      'wrong-token',
      null,
      null,
    ]),
  );
  await db.query('SELECT location_room_recommend_start($1, $2, $3, $4)', [
    room.room_id,
    room.room_host_id,
    null,
    null,
  ]);
});

test('public readers cannot confirm or reset without the creator capability', async () => {
  await assert.rejects(
    db.query('SELECT location_station_confirm($1, $2, $3)', [
      mapId,
      'wrong-token',
      shareKey,
    ]),
  );
  await assert.rejects(
    db.query('SELECT location_vote_reset($1, $2)', [mapId, 'wrong-token']),
  );
  await db.query('SELECT location_station_confirm($1, $2, $3)', [
    mapId,
    hostToken,
    shareKey,
  ]);
  const { rows } = await db.query<{ result: { confirmed: string | null } }>(
    'SELECT location_result_by_map_id($1) AS result',
    [mapId],
  );
  assert.equal(rows[0].result.confirmed, shareKey);
  await db.query('SELECT location_vote_reset($1, $2)', [mapId, hostToken]);
  const { rows: reset } = await db.query<{
    result: { confirmed: string | null; vote_round: number };
  }>('SELECT location_result_by_map_id($1) AS result', [mapId]);
  assert.equal(reset[0].result.confirmed, null);
  assert.equal(reset[0].result.vote_round, 2);
});

test('room modes survive creation, joining and polling while legacy calls remain valid', async () => {
  const { rows: created } = await db.query<{
    room: { room_id: string; room_host_id: string };
  }>('SELECT location_together($1, $2, $3, $4, $5, $6) AS room', [
    '호스트',
    '서울역',
    '서울',
    127,
    37.5,
    'car',
  ]);
  const room = created[0].room;
  await db.query('SELECT location_join_room($1, $2, $3, $4, $5, $6, $7)', [
    room.room_id,
    '도보',
    '시청',
    '서울',
    127.01,
    37.5,
    'walk',
  ]);
  await db.query('SELECT location_join_room($1, $2, $3, $4, $5, $6)', [
    room.room_id,
    '기존 사용자',
    '을지로',
    '서울',
    127.02,
    37.5,
  ]);
  const { rows } = await db.query<{
    status: { participant: Array<{ travel_mode: string | null }> };
  }>('SELECT location_room_status($1) AS status', [room.room_id]);
  assert.deepEqual(
    rows[0].status.participant.map(p => p.travel_mode),
    ['car', 'walk', null],
  );
  assert.equal(
    JSON.stringify(rows[0].status).includes(room.room_host_id),
    false,
  );
  await assert.rejects(
    db.query('SELECT location_join_room($1, $2, $3, $4, $5, $6, $7)', [
      room.room_id,
      '잘못된 수단',
      '서울',
      '서울',
      127,
      37.5,
      'bike',
    ]),
    /Invalid travel mode/,
  );
});

test('invalid room transport does not create a room', async () => {
  const countRooms = async () => {
    await db.exec('RESET ROLE');
    try {
      return (await db.query('SELECT count(*) FROM location_room')).rows;
    } finally {
      await db.exec('SET ROLE anon');
    }
  };
  const before = await countRooms();
  await assert.rejects(
    db.query('SELECT location_together($1, $2, $3, $4, $5, $6)', [
      '거부',
      '서울',
      '서울',
      127,
      37.5,
      'boat',
    ]),
    /Invalid travel mode/,
  );
  assert.deepEqual(await countRooms(), before);
});

interface TestRoom {
  room_id: string;
  room_host_id: string;
}

interface TestRun {
  recommendation_run_id: string;
  participant: Participant[];
}

async function createRoom(): Promise<TestRoom> {
  const { rows } = await db.query<{ room: TestRoom }>(
    'SELECT location_together($1, $2, $3, $4, $5) AS room',
    ['방장', '강남역', '서울 강남구', 127, 37.5],
  );
  return rows[0].room;
}

const joinRoom = (room: TestRoom, name = '친구') =>
  db.query('SELECT location_join_room($1, $2, $3, $4, $5, $6, $7)', [
    room.room_id,
    name,
    '홍대입구역',
    '서울 마포구',
    126.9,
    37.55,
    'walk',
  ]);

async function startRoom(room: TestRoom): Promise<TestRun> {
  const { rows } = await db.query<{ run: TestRun }>(
    'SELECT location_room_recommend_start($1, $2, $3, $4) AS run',
    [room.room_id, room.room_host_id, null, null],
  );
  return rows[0].run;
}

async function roomStatus(room: TestRoom) {
  const { rows } = await db.query<{
    status: {
      recommendation_status: string;
      result_map_id: string | null;
      participant: Participant[];
    };
  }>('SELECT location_room_status($1) AS status', [room.room_id]);
  return rows[0].status;
}

async function expireRoom(room: TestRoom) {
  await db.exec('RESET ROLE');
  try {
    await db.query(
      "UPDATE location_room SET updated_at = now() - interval '1 hour' WHERE room_id = $1",
      [room.room_id],
    );
  } finally {
    await db.exec('SET ROLE anon');
  }
}

test('starting a room captures everyone registered since the last client poll', async () => {
  const room = await createRoom();
  assert.equal((await roomStatus(room)).participant.length, 1);
  await joinRoom(room);
  const run = await startRoom(room);
  assert.deepEqual(
    run.participant?.map(p => p.name),
    ['방장', '친구'],
  );
  assert.deepEqual(
    run.participant.map(p => p.travel_mode),
    [null, 'walk'],
  );
  assert.ok(run.recommendation_run_id);
  const publicStatus = await roomStatus(room);
  assert.equal(
    JSON.stringify(publicStatus).includes(run.recommendation_run_id),
    false,
  );
  assert.equal(JSON.stringify(publicStatus).includes(room.room_host_id), false);
});

test('joining after recommendation starts is rejected without adding an omitted participant', async () => {
  const room = await createRoom();
  await joinRoom(room);
  await startRoom(room);
  await assert.rejects(joinRoom(room, '늦은 친구'), /추천/);
  assert.equal((await roomStatus(room)).participant.length, 2);
});

test('joining a completed room cannot send a new participant to an old result', async () => {
  const room = await createRoom();
  await db.exec('RESET ROLE');
  try {
    await db.query(
      "UPDATE location_room SET recommendation_status = 'completed', result_map_id = $2 WHERE room_id = $1",
      [room.room_id, mapId],
    );
  } finally {
    await db.exec('SET ROLE anon');
  }
  await assert.rejects(joinRoom(room), /추천/);
  assert.equal((await roomStatus(room)).participant.length, 1);
  assert.equal((await roomStatus(room)).result_map_id, mapId);
});

test('a second start cannot replace an active run, including the legacy three-argument call', async () => {
  const room = await createRoom();
  await startRoom(room);
  await assert.rejects(startRoom(room), /진행/);
  await assert.rejects(
    db.query('SELECT location_room_recommend_start($1, $2, $3)', [
      room.room_id,
      room.room_host_id,
      null,
    ]),
    /진행/,
  );
});

test('polling an abandoned run releases the loading state and allows participants and a retry', async () => {
  const room = await createRoom();
  await startRoom(room);
  await expireRoom(room);
  assert.equal((await roomStatus(room)).recommendation_status, 'failed');
  assert.equal((await roomStatus(room)).result_map_id, null);
  await joinRoom(room);
  const retry = await startRoom(room);
  assert.equal(retry.participant.length, 2);
  assert.equal((await roomStatus(room)).recommendation_status, 'generating');
});

test('expired runs can be retried or joined without waiting for a status poll', async () => {
  const room = await createRoom();
  const first = await startRoom(room);
  await expireRoom(room);
  const retry = await startRoom(room);
  assert.ok(retry.recommendation_run_id);
  assert.notEqual(retry.recommendation_run_id, first.recommendation_run_id);
  await expireRoom(room);
  await joinRoom(room);
  assert.equal((await roomStatus(room)).recommendation_status, 'failed');
});

test('late completion and failure cannot overwrite a newer run or its completed result', async () => {
  const room = await createRoom();
  const first = await startRoom(room);
  assert.ok(first.recommendation_run_id);
  await expireRoom(room);
  const retry = await startRoom(room);
  for (const token of [first.recommendation_run_id, null]) {
    await assert.rejects(
      db.query('SELECT location_room_recommend_complete($1, $2, $3, $4)', [
        room.room_id,
        room.room_host_id,
        mapId,
        token,
      ]),
    );
    await assert.rejects(
      db.query('SELECT location_room_recommend_fail($1, $2, $3)', [
        room.room_id,
        room.room_host_id,
        token,
      ]),
    );
  }
  await assert.rejects(
    db.query('SELECT location_room_recommend_complete($1, $2, $3, $4)', [
      room.room_id,
      'wrong-host',
      mapId,
      retry.recommendation_run_id,
    ]),
  );
  assert.equal((await roomStatus(room)).recommendation_status, 'generating');
  await db.query('SELECT location_room_recommend_complete($1, $2, $3, $4)', [
    room.room_id,
    room.room_host_id,
    mapId,
    retry.recommendation_run_id,
  ]);
  await assert.rejects(
    db.query('SELECT location_room_recommend_fail($1, $2, $3)', [
      room.room_id,
      room.room_host_id,
      retry.recommendation_run_id,
    ]),
  );
  assert.equal((await roomStatus(room)).result_map_id, mapId);
});

test('legacy callbacks without a run identifier cannot publish or clear a current recommendation', async () => {
  const room = await createRoom();
  await startRoom(room);
  await assert.rejects(
    db.query('SELECT location_room_recommend_complete($1, $2, $3)', [
      room.room_id,
      room.room_host_id,
      mapId,
    ]),
  );
  await assert.rejects(
    db.query('SELECT location_room_recommend_fail($1, $2)', [
      room.room_id,
      room.room_host_id,
    ]),
  );
  assert.equal((await roomStatus(room)).recommendation_status, 'generating');
});

test('an expired run cannot publish before polling and the current host can release a failed run', async () => {
  const room = await createRoom();
  const run = await startRoom(room);
  await expireRoom(room);
  await assert.rejects(
    db.query('SELECT location_room_recommend_complete($1, $2, $3, $4)', [
      room.room_id,
      room.room_host_id,
      mapId,
      run.recommendation_run_id,
    ]),
  );
  await assert.rejects(
    db.query('SELECT location_room_recommend_fail($1, $2, $3)', [
      room.room_id,
      'wrong-host',
      run.recommendation_run_id,
    ]),
  );
  await db.query('SELECT location_room_recommend_fail($1, $2, $3)', [
    room.room_id,
    room.room_host_id,
    run.recommendation_run_id,
  ]);
  assert.equal((await roomStatus(room)).recommendation_status, 'failed');
  await joinRoom(room);
  assert.equal((await startRoom(room)).participant.length, 2);
});

test('a pre-migration generating room with no run identifier becomes retryable', async () => {
  const room = await createRoom();
  await db.exec('RESET ROLE');
  try {
    await db.query(
      "UPDATE location_room SET recommendation_status = 'generating' WHERE room_id = $1",
      [room.room_id],
    );
  } finally {
    await db.exec('SET ROLE anon');
  }
  assert.equal((await roomStatus(room)).recommendation_status, 'failed');
  assert.ok((await startRoom(room)).recommendation_run_id);
});
