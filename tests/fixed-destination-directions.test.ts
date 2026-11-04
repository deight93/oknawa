import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Participant } from '../src/types/location';
import type { MeetingDestination } from '../src/types/meetingDestination';
import { buildKakaoDirections } from '../src/utils/kakaoDirections';

const origin: Participant = {
  name: '민수',
  region_name: '사당동',
  full_address: '서울 / 사당동, #&',
  start_x: 126.981,
  start_y: 37.477,
};
const destination: MeetingDestination = {
  name: '서울역 / 1번, 출구#&',
  address: '서울 용산구 한강대로 405',
  x: 126.972,
  y: 37.554,
};

for (const [mode, webMode, appMode] of [
  ['transit', 'traffic', 'publictransit'],
  ['car', 'car', 'car'],
  ['walk', 'walk', 'foot'],
] as const) {
  test(`fixed ${mode} directions encode labels and latitude,longitude without a calculated route`, () => {
    const links = buildKakaoDirections(origin, destination, mode);
    assert.ok(links);
    assert.equal(links.travelMode, mode);
    assert.equal(
      links.webUrl,
      `https://map.kakao.com/link/by/${webMode}/${encodeURIComponent('서울 / 사당동, #&')},37.477,126.981/${encodeURIComponent('서울역 / 1번, 출구#&')},37.554,126.972`,
    );
    assert.equal(
      links.appUrl,
      `kakaomap://route?sp=37.477,126.981&ep=37.554,126.972&by=${appMode}`,
    );
  });
}

test('duplicate participant names and regions still produce each supplied origin', () => {
  const duplicate = { ...origin, start_x: 127.101, start_y: 37.501 };
  assert.equal(
    buildKakaoDirections(origin, destination, 'walk')?.appUrl,
    'kakaomap://route?sp=37.477,126.981&ep=37.554,126.972&by=foot',
  );
  assert.equal(
    buildKakaoDirections(duplicate, destination, 'car')?.appUrl,
    'kakaomap://route?sp=37.501,127.101&ep=37.554,126.972&by=car',
  );
});

test('missing full address falls back to region and then a readable origin label', () => {
  assert.match(
    buildKakaoDirections({ ...origin, full_address: ' ' }, destination, 'walk')!
      .webUrl,
    new RegExp(`/walk/${encodeURIComponent('사당동')},`),
  );
  assert.match(
    buildKakaoDirections(
      { ...origin, full_address: undefined, region_name: '' },
      destination,
      'walk',
    )!.webUrl,
    new RegExp(`/walk/${encodeURIComponent('출발지')},`),
  );
});

test('invalid origin or destination coordinates never generate a launch link', () => {
  for (const invalid of [NaN, Infinity, -Infinity, undefined, null, '127']) {
    for (const field of ['start_x', 'start_y', 'x', 'y'] as const) {
      const start = { ...origin };
      const end = { ...destination };
      Reflect.set(field.startsWith('start_') ? start : end, field, invalid);
      assert.equal(buildKakaoDirections(start, end, 'transit'), null);
    }
  }
  for (const [field, value] of [
    ['start_x', 181],
    ['start_x', -181],
    ['start_y', 91],
    ['start_y', -91],
    ['x', 181],
    ['x', -181],
    ['y', 91],
    ['y', -91],
  ] as const) {
    const start = { ...origin };
    const end = { ...destination };
    Reflect.set(field.startsWith('start_') ? start : end, field, value);
    assert.equal(buildKakaoDirections(start, end, 'transit'), null);
  }
});
