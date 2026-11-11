import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import RouteDetails from '../src/components/RouteDetails';
import type {
  ItineraryItem,
  Participant,
  RouteStep,
} from '../src/types/location';

const participants: Participant[] = [
  { name: '민수', region_name: '사당', start_x: 126.98, start_y: 37.47 },
  { name: '민수', region_name: '잠실', start_x: 127.1, start_y: 37.5 },
  { name: '지수', region_name: '신림', start_x: 126.92, start_y: 37.48 },
];

function route(steps?: RouteStep[]): ItineraryItem {
  return {
    name: '민수',
    region_name: '잠실',
    itinerary: { totalTime: 1800, total_polyline: [], steps },
  };
}

const journey: RouteStep[] = [
  { mode: 'walk', durationSeconds: 30, distanceMeters: 25 },
  {
    mode: 'transit',
    durationSeconds: 601,
    distanceMeters: 2300,
    transit: {
      lineName: '740',
      vehicleType: 'BUS',
      headsign: '종로',
      departureStop: { name: '강남역' },
      arrivalStop: { name: '교대역' },
      stopCount: 3,
    },
  },
  { mode: 'walk', durationSeconds: 120, distanceMeters: 100 },
  {
    mode: 'transit',
    transit: {
      lineName: '2호선',
      vehicleType: 'SUBWAY',
      departureStop: {
        name: '교대역',
        location: { lat: 37.49, lng: 127.01 },
      },
      arrivalStop: { name: '시청역' },
    },
  },
  { mode: 'transit', transit: { vehicleType: 'TRAM' } },
  { mode: 'car', durationSeconds: 60, distanceMeters: 1000 },
  { mode: 'walk', durationSeconds: 0, distanceMeters: 0 },
];

type Props = React.ComponentProps<typeof RouteDetails>;
const defaultProps: Props = {
  participants,
  itinerary: [route(journey)],
  selectedParticipantIndex: 0,
  onSelectParticipant: () => {},
};
let tree: ReactTestRenderer | undefined;

afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
});

function mount(props: Partial<Props> = {}) {
  act(() => {
    tree = create(<RouteDetails {...defaultProps} {...props} />);
  });
  assert.ok(tree);
  return tree.root;
}

function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(text).join('');
}

test('provides a collapsed native disclosure and an explicitly labelled native select', () => {
  const root = mount();
  const details = root.findAllByType('details');
  assert.equal(details.length, 1);
  assert.ok(!details[0].props.open);
  assert.equal(text(root.findByType('summary')), '이동 구간·환승 안내');
  const select = root.findByType('select');
  const label = root.findByType('label');
  assert.equal(text(label), '경로를 볼 참가자');
  assert.ok(select.props.id);
  assert.equal(label.props.htmlFor, select.props.id);
});

test('renders every mode in journey order and numbers transfers across walks and adjacent transit', () => {
  const root = mount();
  assert.equal(root.findAllByType('ol').length, 1);
  const steps = root.findByType('ol').findAllByType('li');
  assert.deepEqual(
    steps.map(step => text(step.findByType('h3'))),
    [
      '도보',
      '승차 · 버스 740',
      '도보',
      '환승 1 · 지하철 2호선',
      '환승 2 · 트램',
      '자동차',
      '도보',
    ],
  );
  assert.match(text(steps[1]), /강남역 승차 → 교대역 하차/);
  assert.match(text(steps[1]), /종로 방면/);
  assert.match(text(steps[1]), /3개 정류장/);
  assert.match(text(steps[1]), /11분/);
  assert.match(text(steps[1]), /2\.3km/);
});

test('keeps duplicate participant names and null route slots indexed during controlled selection', () => {
  const selected: number[] = [];
  const itinerary = [null, route([{ mode: 'car' }]), route([{ mode: 'walk' }])];
  const props = {
    itinerary,
    selectedParticipantIndex: 1,
    onSelectParticipant: (index: number) => selected.push(index),
  };
  const root = mount(props);
  assert.deepEqual(
    root
      .findAllByType('option')
      .map(option => [option.props.value, text(option)]),
    [
      [0, '1번 민수'],
      [1, '2번 민수'],
      [2, '3번 지수'],
    ],
  );
  assert.match(text(root.findByType('ol')), /자동차/);
  const select = root.findByType('select');
  assert.equal(select.props.value, 1);
  act(() => select.props.onChange({ target: { value: '2' } }));
  assert.deepEqual(selected, [2]);
  assert.equal(select.props.value, 1);
  act(() =>
    tree?.update(
      <RouteDetails
        {...defaultProps}
        {...props}
        selectedParticipantIndex={2}
      />,
    ),
  );
  assert.equal(root.findByType('select').props.value, 2);
  assert.match(text(root.findByType('ol')), /도보/);
  assert.doesNotMatch(text(root.findByType('ol')), /자동차/);
  act(() =>
    root.findByType('select').props.onChange({ target: { value: '0' } }),
  );
  assert.deepEqual(selected, [2, 0]);
});

test('distinguishes an unavailable route from saved routes without guidance', () => {
  const root = mount({ itinerary: [null] });
  assert.match(text(root), /이 참가자의 경로를 불러올 수 없어요/);
  assert.doesNotMatch(text(root), /이 경로에는 구간 정보가 없어요/);
  assert.equal(root.findAllByType('ol').length, 0);
  for (const itinerary of [[route()], [route([])]]) {
    act(() =>
      tree?.update(<RouteDetails {...defaultProps} itinerary={itinerary} />),
    );
    assert.ok(
      text(root).includes(
        '이 경로에는 구간 정보가 없어요. 새로 검색하거나 카카오맵 길찾기를 확인해주세요.',
      ),
    );
    assert.equal(root.findAllByType('ol').length, 0);
  }
});

test('retains participants whose route slots are absent instead of showing a different route', () => {
  const root = mount({
    itinerary: [route(journey)],
    selectedParticipantIndex: 2,
  });
  assert.equal(root.findAllByType('option').length, 3);
  assert.match(text(root), /이 참가자의 경로를 불러올 수 없어요/);
  assert.equal(root.findAllByType('li').length, 0);
});

test('renders nothing for no participants', () => {
  mount({ participants: [] });
  assert.equal(tree?.toJSON(), null);
});

test('replaces old guidance on rerender without keeping stale lines, stops or transfers', () => {
  const root = mount();
  assert.match(text(root), /환승 2/);
  act(() =>
    tree?.update(<RouteDetails {...defaultProps} itinerary={[route()]} />),
  );
  assert.doesNotMatch(text(root), /740|2호선|교대역|환승 2/);
  assert.equal(root.findAllByType('li').length, 0);
  act(() =>
    tree?.update(
      <RouteDetails
        {...defaultProps}
        itinerary={[
          route([
            {
              mode: 'transit',
              transit: {
                lineName: '새 노선',
                departureStop: { name: '새 역' },
              },
            },
          ]),
        ]}
      />,
    ),
  );
  assert.match(text(root), /승차 · 대중교통 새 노선/);
  assert.match(text(root), /새 역 승차/);
  assert.doesNotMatch(text(root), /740|2호선|교대역|환승 1|환승 2/);
});

for (const [seconds, expected] of [
  [0, '0분'],
  [0.5, '1분 미만'],
  [59, '1분 미만'],
  [60, '1분'],
  [61, '2분'],
  [3599, '60분'],
] as const) {
  test(`displays ${seconds} seconds as ${expected} without rounding down`, () => {
    const root = mount({
      itinerary: [route([{ mode: 'walk', durationSeconds: seconds }])],
    });
    assert.equal(text(root.findByType('li')), `도보${expected}`);
  });
}

for (const [meters, expected] of [
  [0, '0m'],
  [50, '50m'],
  [999, '999m'],
  [1000, '1km'],
  [1250, '1.3km'],
] as const) {
  test(`displays ${meters} meters as ${expected}`, () => {
    const root = mount({
      itinerary: [route([{ mode: 'walk', distanceMeters: meters }])],
    });
    assert.equal(text(root.findByType('li')), `도보${expected}`);
  });
}

test('shows readable partial transit information without inferring missing names or metrics', () => {
  const root = mount({
    itinerary: [
      route([
        { mode: 'transit' },
        {
          mode: 'transit',
          transit: {
            vehicleType: 'UNKNOWN',
            lineName: '공항 노선',
            departureStop: { name: '출발 정류장' },
            stopCount: 0,
          },
        },
        { mode: 'transit', transit: { arrivalStop: { name: '도착역' } } },
      ]),
    ],
  });
  const steps = root.findAllByType('li');
  assert.equal(text(steps[0].findByType('h3')), '승차 · 대중교통');
  assert.match(text(steps[0]), /승차 정류장 정보 없음 → 하차 정류장 정보 없음/);
  assert.match(text(steps[1]), /환승 1 · 대중교통 공항 노선/);
  assert.match(text(steps[1]), /출발 정류장 승차 → 하차 정류장 정보 없음/);
  assert.match(text(steps[1]), /0개 정류장/);
  assert.match(text(steps[2]), /승차 정류장 정보 없음 → 도착역 하차/);
  assert.doesNotMatch(
    steps.map(text).join(''),
    /undefined|null|NaN|방면|\d+분|\d+m/,
  );
});

test('omits malformed optional numbers and text while retaining the valid route steps', () => {
  const steps: RouteStep[] = [
    { mode: 'walk', durationSeconds: -1, distanceMeters: NaN },
    { mode: 'car', durationSeconds: Infinity, distanceMeters: -5 },
    { mode: 'transit', transit: { stopCount: -1 } },
    { mode: 'transit', transit: { stopCount: 1.5 } },
    {
      mode: 'transit',
      transit: {
        lineName: ' ',
        headsign: '\t',
        departureStop: { name: '' },
        stopCount: NaN,
      },
    },
    { mode: 'walk' },
  ];
  Reflect.set(steps[5], 'durationSeconds', '60');
  Reflect.set(steps[5], 'distanceMeters', null);
  const malformed = {
    lineName: {},
    headsign: false,
    departureStop: { name: 42 },
    stopCount: '3',
  };
  Reflect.set(steps[2], 'transit', malformed);
  const root = mount({ itinerary: [route(steps)] });
  const rendered = root.findAllByType('li');
  assert.equal(rendered.length, 6);
  assert.equal(text(rendered[0]), '도보');
  assert.equal(text(rendered[1]), '자동차');
  assert.equal(text(rendered[5]), '도보');
  assert.doesNotMatch(
    rendered.map(text).join(''),
    /NaN|Infinity|undefined|null|\[object Object\]|방면|개 정류장/,
  );
});

test('makes the entire guidance unavailable for unrecognized or missing step modes', () => {
  for (const invalid of [{ mode: 'flying' }, {}, null]) {
    const item = route();
    Reflect.set(item.itinerary, 'steps', [{ mode: 'walk' }, invalid]);
    const markup = renderToStaticMarkup(
      <RouteDetails {...defaultProps} itinerary={[item]} />,
    );
    assert.match(markup, /이 경로에는 구간 정보가 없어요/);
    assert.doesNotMatch(markup, /<ol|<li/);
  }
});

test('explains estimates, waiting time, map line styles and selected-participant transfer numbers', () => {
  const root = mount();
  const notes = root.findAllByType('p').map(text).join(' ');
  assert.match(notes, /상황에 따라 달라질 수/);
  assert.match(notes, /전체 이동 시간.*대기 시간/);
  assert.match(notes, /도보.*점선.*대중교통.*실선/);
  assert.match(notes, /좌표가 있는 환승 지점만.*선택한 참가자.*지도.*번호/);
});

test('does not promise map markers for transfers with absent or invalid stop coordinates', () => {
  for (const location of [
    undefined,
    { lat: NaN, lng: 127 },
    { lat: 91, lng: 127 },
  ]) {
    const steps: RouteStep[] = [
      { mode: 'transit' },
      {
        mode: 'transit',
        transit: { departureStop: { name: '환승역', location } },
      },
    ];
    const markup = renderToStaticMarkup(
      <RouteDetails {...defaultProps} itinerary={[route(steps)]} />,
    );
    assert.match(markup, /환승 1/);
    assert.doesNotMatch(markup, /선택한 참가자의 지도에 번호로 표시/);
  }
});

test('escapes participant names and provider text instead of interpreting HTML', () => {
  const malicious = '<script>alert("x")</script>';
  const markup = renderToStaticMarkup(
    <RouteDetails
      {...defaultProps}
      participants={[
        { ...participants[0], name: '<img src=x onerror=alert(1)>' },
      ]}
      itinerary={[
        route([
          {
            mode: 'transit',
            transit: {
              lineName: malicious,
              headsign: '<b>방향</b>',
              departureStop: { name: '<svg onload=alert(1)>' },
              arrivalStop: { name: 'A & B' },
            },
          },
        ]),
      ]}
    />,
  );
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(markup, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(markup, /&lt;b&gt;방향&lt;\/b&gt;/);
  assert.match(markup, /&lt;svg onload=alert\(1\)&gt;/);
  assert.match(markup, /A &amp; B/);
  assert.doesNotMatch(markup, /<script|<img|<svg|<b>/);
});
