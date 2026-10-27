import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

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
