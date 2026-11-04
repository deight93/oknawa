import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, test } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type {
  ItineraryItem,
  Participant,
  PolylinePoint,
} from '../src/types/location';
import { onKakaoMapsScriptLoad } from '../src/utils/kakaoMapsReady';

// Keep the real MeetingMap component; replace only the external map renderer.
const sdk =
  require('react-kakao-maps-sdk') as typeof import('react-kakao-maps-sdk');
const MapSurface = React.forwardRef<HTMLDivElement, React.PropsWithChildren>(
  function MapSurface({ children }, ref) {
    return <div ref={ref}>{children}</div>;
  },
);
const Marker = () => null;
const Line = () => null;
const Overlay = ({ children }: React.PropsWithChildren) => <>{children}</>;
for (const [key, value] of Object.entries({
  Map: MapSurface,
  MapMarker: Marker,
  Polyline: Line,
  CustomOverlayMap: Overlay,
}))
  Object.defineProperty(sdk, key, { value });

let MeetingMap: typeof import('../src/components/MeetingMap').default;
before(async () => {
  MeetingMap = (await import('../src/components/MeetingMap')).default;
});

const originalReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
const originalKakao = Object.getOwnPropertyDescriptor(globalThis, 'kakao');
let tree: ReactTestRenderer | undefined;
class LatLng {
  constructor(
    public lat: number,
    public lng: number,
  ) {}
}
class Bounds {
  points: LatLng[] = [];
  extend(point: LatLng) {
    this.points.push(point);
  }
}
beforeEach(() => {
  Object.defineProperty(globalThis, 'React', {
    configurable: true,
    value: React,
  });
  Object.defineProperty(globalThis, 'kakao', {
    configurable: true,
    value: {
      maps: {
        load: (ready: () => void) => ready(),
        services: { Places: class {} },
        LatLng,
        LatLngBounds: Bounds,
      },
    },
  });
  onKakaoMapsScriptLoad();
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  for (const [key, descriptor] of [
    ['React', originalReact],
    ['kakao', originalKakao],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const participants: Participant[] = [
  { name: '민수', region_name: '사당동', start_x: 126.981, start_y: 37.477 },
  { name: '민수', region_name: '잠실동', start_x: 127.101, start_y: 37.501 },
  { name: '지수', region_name: '신림동', start_x: 126.929, start_y: 37.484 },
];
const path = [
  { lat: 37.501, lng: 127.101 },
  { lat: 37.6, lng: 127.2 },
  { lat: 37.554, lng: 126.972 },
];
const route = (points: PolylinePoint[] = path): ItineraryItem => ({
  name: '민수',
  region_name: '잠실동',
  itinerary: { totalTime: 1200, total_polyline: points },
});
async function mount(
  props: Partial<React.ComponentProps<typeof MeetingMap>> = {},
) {
  await act(async () => {
    tree = create(
      <MeetingMap
        stationName="서울역"
        endX={126.972}
        endY={37.554}
        participants={participants}
        {...props}
      />,
    );
  });
  return tree!.root;
}

test('empty routes do not shift the next participant route color or marker number', async () => {
  const root = await mount({ itinerary: [route([]), route()] });
  const lines = root.findAllByType(Line);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].props.path, path);
  assert.equal(lines[0].props.strokeColor, '#8B5CCC');
  assert.deepEqual(
    root.findAllByType(Marker).map(marker => marker.props.image.src),
    ['/images/marker0.svg', '/images/marker1.svg', '/images/marker2.svg'],
  );
});

test('invalid origin coordinates keep subsequent marker numbers and route colors', async () => {
  const root = await mount({
    participants: [
      { ...participants[0], start_x: NaN },
      ...participants.slice(1),
    ],
    itinerary: [route([]), route()],
  });
  assert.equal(
    root.findAllByType(Marker)[0].props.image.src,
    '/images/marker1.svg',
  );
  assert.equal(root.findAllByType(Line)[0].props.strokeColor, '#8B5CCC');
});

test('unavailable and invalid routes leave gaps without drawing substitute lines', async () => {
  const root = await mount({
    itinerary: [null, route([{ lat: NaN, lng: 127.1 }]), route()],
  });
  const lines = root.findAllByType(Line);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].props.path, path);
  assert.equal(lines[0].props.strokeColor, '#FF46CB');
  assert.equal(root.findAllByType(Marker).length, 3);
});

test('marker selection highlights its own route without adding duplicate lines', async () => {
  const root = await mount({
    itinerary: [route([]), route(), route(path.slice(1))],
  });
  const pans: LatLng[] = [];
  act(() =>
    root.findByType(MapSurface).props.onCreate({
      setLevel() {},
      setCenter() {},
      panTo: (point: LatLng) => pans.push(point),
    }),
  );
  const position = new LatLng(37.501, 127.101);
  act(() =>
    root
      .findAllByType(Marker)[1]
      .props.onClick({ getPosition: () => position }),
  );
  assert.deepEqual(pans, [position]);
  assert.deepEqual(
    root
      .findAllByType(Line)
      .map(line => [
        line.props.strokeColor,
        line.props.strokeWeight,
        line.props.zIndex,
      ]),
    [
      ['#8B5CCC', 7, 1],
      ['#FF46CB', 6, 0],
    ],
  );
  act(() =>
    root
      .findAllByType(Marker)[2]
      .props.onClick({ getPosition: () => position }),
  );
  assert.deepEqual(
    root
      .findAllByType(Line)
      .map(line => [line.props.strokeWeight, line.props.zIndex]),
    [
      [6, 0],
      [7, 1],
    ],
  );
});

test('overview bounds include route detours as well as all departures and the destination', async () => {
  const root = await mount({
    focusMode: 'overview',
    itinerary: [route([]), route()],
  });
  let bounds: Bounds | undefined;
  act(() =>
    root.findByType(MapSurface).props.onCreate({
      setBounds: (value: Bounds) => {
        bounds = value;
      },
    }),
  );
  const points = bounds!.points.map(point => ({
    lat: point.lat,
    lng: point.lng,
  }));
  for (const point of [
    ...path,
    ...participants.map(person => ({
      lat: person.start_y,
      lng: person.start_x,
    })),
  ]) {
    assert.ok(
      points.some(
        actual => actual.lat === point.lat && actual.lng === point.lng,
      ),
    );
  }
});
