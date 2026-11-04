import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StationInfo } from '../src/types/location';
import {
  getParticipantDirections,
  getKakaoAppLaunchUrl,
} from '../src/utils/kakaoDirections';

function station(): StationInfo {
  return {
    station_name: '서울역 / 1번, 출구#&',
    address_name: '서울',
    end_x: 126.972,
    end_y: 37.554,
    share_key: 'seoul',
    vote: 0,
    request_info: {
      participant: [
        {
          name: '민수',
          region_name: '사당동',
          full_address: '서울 / 사당동, #&',
          start_x: 126.981,
          start_y: 37.477,
        },
        {
          name: '민수',
          region_name: '사당동',
          start_x: 127.101,
          start_y: 37.501,
        },
      ],
    },
    itinerary: [
      {
        name: '민수',
        region_name: '사당동',
        travel_mode: 'transit',
        itinerary: { totalTime: 1800, total_polyline: [] },
      },
      {
        name: '민수',
        region_name: '사당동',
        travel_mode: 'car',
        itinerary: { totalTime: 2400, total_polyline: [] },
      },
    ],
  };
}

for (const [mode, webMode, appMode] of [
  ['transit', 'traffic', 'publictransit'],
  ['car', 'car', 'car'],
  ['walk', 'walk', 'foot'],
] as const) {
  test(`${mode} links encode labels and use latitude,longitude in both app and web`, () => {
    const candidate = station();
    candidate.itinerary[0].travel_mode = mode;
    const links = getParticipantDirections(candidate, 0);
    assert.ok(links);
    assert.equal(links.travelMode, mode);
    assert.equal(
      links.webUrl,
      `https://map.kakao.com/link/by/${webMode}/${encodeURIComponent('서울 / 사당동, #&')},37.477,126.981/${encodeURIComponent(candidate.station_name)},37.554,126.972`,
    );
    assert.equal(
      links.appUrl,
      `kakaomap://route?sp=37.477,126.981&ep=37.554,126.972&by=${appMode}`,
    );
  });
}

test('duplicate names and regions retain each indexed origin and mode', () => {
  const candidate = station();
  assert.match(
    getParticipantDirections(candidate, 1)!.appUrl,
    /sp=37.501,127.101&.*by=car$/,
  );
  candidate.end_x = 127.027;
  candidate.end_y = 37.497;
  assert.match(
    getParticipantDirections(candidate, 1)!.appUrl,
    /ep=37.497,127.027/,
  );
});

test('legacy routes use the participant mode, then group mode, then transit', () => {
  const candidate = station();
  delete candidate.itinerary[0].travel_mode;
  candidate.request_info.participant[0].travel_mode = 'walk';
  assert.equal(
    getParticipantDirections(candidate, 0, 'car')?.travelMode,
    'walk',
  );
  delete candidate.request_info.participant[0].travel_mode;
  assert.equal(
    getParticipantDirections(candidate, 0, 'car')?.travelMode,
    'car',
  );
  candidate.request_info.recommendationOptions = {
    travelMode: 'car',
    midpointBasis: 'time',
  };
  assert.equal(getParticipantDirections(candidate, 0)?.travelMode, 'car');
  assert.equal(
    getParticipantDirections(candidate, 0, 'mixed')?.travelMode,
    'transit',
  );
});

test('missing or misaligned participants never produce another person’s route', () => {
  const candidate = station();
  assert.equal(getParticipantDirections(candidate, -1), null);
  assert.equal(getParticipantDirections(candidate, 2), null);
  candidate.request_info.participant[1].name = '다른 사람';
  assert.equal(getParticipantDirections(candidate, 0), null);
  candidate.request_info.participant.pop();
  assert.equal(getParticipantDirections(candidate, 0), null);
});

test('malformed coordinates cannot produce a launch link', () => {
  for (const invalid of [NaN, Infinity, undefined, null, '127', 181]) {
    const candidate = station();
    Reflect.set(candidate.request_info.participant[0], 'start_x', invalid);
    assert.equal(getParticipantDirections(candidate, 0), null);
  }
  for (const key of ['start_y', 'end_y'] as const) {
    const candidate = station();
    Reflect.set(
      key === 'start_y' ? candidate.request_info.participant[0] : candidate,
      key,
      91,
    );
    assert.equal(getParticipantDirections(candidate, 0), null);
  }
});

test('Android intent contains the exact encoded web fallback', () => {
  const links = getParticipantDirections(station(), 0)!;
  assert.equal(
    getKakaoAppLaunchUrl(links, {
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130',
      maxTouchPoints: 5,
    }),
    `intent://route?sp=37.477,126.981&ep=37.554,126.972&by=publictransit#Intent;scheme=kakaomap;S.browser_fallback_url=${encodeURIComponent(links.webUrl)};end`,
  );
});

test('iPhone and desktop-mode iPad use the scheme; desktop keeps the web link', () => {
  const links = getParticipantDirections(station(), 0)!;
  for (const userAgent of [
    'Mozilla/5.0 (iPhone)',
    'Mozilla/5.0 (iPad)',
    'Mozilla/5.0 (Macintosh)',
  ]) {
    assert.equal(
      getKakaoAppLaunchUrl(links, { userAgent, maxTouchPoints: 5 }),
      links.appUrl,
    );
  }
  for (const userAgent of [
    'Mozilla/5.0 (Macintosh)',
    'Mozilla/5.0 (Windows NT 10.0)',
  ]) {
    assert.equal(
      getKakaoAppLaunchUrl(links, { userAgent, maxTouchPoints: 0 }),
      null,
    );
  }
});
