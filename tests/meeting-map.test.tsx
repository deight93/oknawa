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
import RouteDetails from '../src/components/RouteDetails';
import useRouteInteraction from '../src/hooks/result/useRouteInteraction';

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
const originalResizeObserver = Object.getOwnPropertyDescriptor(
  globalThis,
  'ResizeObserver',
);
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
    ['ResizeObserver', originalResizeObserver],
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

const transferRoute = (): ItineraryItem => ({
  ...route(),
  itinerary: {
    ...route().itinerary,
    steps: [
      { mode: 'walk', durationSeconds: 60 },
      { mode: 'transit', transit: { lineName: '2호선' } },
      { mode: 'walk', durationSeconds: 180 },
      {
        mode: 'transit',
        transit: {
          lineName: '4호선',
          departureStop: {
            name: '사당역',
            location: { lat: 37.476, lng: 126.981 },
          },
        },
      },
    ],
  },
});

test('resizing preserves the user map center without refitting routes and cleans up on unmount', async () => {
  let resize: (() => void) | undefined;
  let observed: unknown;
  let disconnected = false;
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe(node: unknown) {
        observed = node;
      }
      disconnect() {
        disconnected = true;
      }
    },
  });
  const root = await mount({
    itinerary: [transferRoute()],
    selectedParticipantIndex: 0,
  });
  const container = {};
  const calls: string[] = [];
  let fitted: Bounds | undefined;
  const userCenter = new LatLng(37.7, 127.3);
  act(() =>
    root.findByType(MapSurface).props.onCreate({
      getNode: () => container,
      getCenter: () => userCenter,
      setCenter: (point: LatLng) => {
        assert.equal(point, userCenter);
        calls.push('center');
      },
      relayout: () => calls.push('relayout'),
      setBounds: (bounds: Bounds) => {
        calls.push('bounds');
        fitted = bounds;
      },
    }),
  );
  assert.equal(observed, container);
  calls.length = 0;
  assert.ok(resize);
  act(() => resize!());
  assert.deepEqual(calls, ['relayout', 'center']);
  assert.ok(
    fitted?.points.some(point => point.lat === 37.476 && point.lng === 126.981),
  );
  act(() => tree!.unmount());
  tree = undefined;
  assert.equal(disconnected, true);
});

test('transfer markers use the selected participant boarding stop and preserve missing route slots', async () => {
  const root = await mount({
    itinerary: [null, transferRoute(), transferRoute()],
    selectedParticipantIndex: 1,
  });
  const transfers = root.findAll(
    node => node.type === 'button' && node.props['data-route-transfer'] === 1,
  );
  assert.equal(transfers.length, 1);
  assert.match(transfers[0].props['aria-label'], /2번.*환승 1.*사당역.*4호선/);
  const overlays = root.findAllByType(Overlay);
  assert.deepEqual(overlays[1].props.position, { lat: 37.476, lng: 126.981 });
  assert.equal(root.findAllByType(Line)[0].props.strokeColor, '#8B5CCC');
  assert.equal(root.findAllByType(Line)[0].props.strokeWeight, 7);
});

test('transfer markers disappear when a new result has no step details', async () => {
  await mount({ itinerary: [transferRoute()], selectedParticipantIndex: 0 });
  assert.equal(
    tree!.root.findAll(
      node => node.type === 'button' && node.props['data-route-transfer'] === 1,
    ).length,
    1,
  );
  await act(async () =>
    tree!.update(
      <MeetingMap
        stationName="새 목적지"
        endX={127}
        endY={37.5}
        participants={participants}
        itinerary={[route()]}
        selectedParticipantIndex={0}
      />,
    ),
  );
  assert.equal(
    tree!.root.findAllByProps({ 'data-route-transfer': 1 }).length,
    0,
  );
});

test('missing transfer coordinates do not invent markers from route geometry', async () => {
  const item = transferRoute();
  item.itinerary.steps = [
    { mode: 'transit' },
    { mode: 'transit', transit: { departureStop: { name: '환승역' } } },
  ];
  const root = await mount({ itinerary: [item], selectedParticipantIndex: 0 });
  assert.equal(root.findAllByType(Overlay).length, 1);
});

test('controlled selection reports origin clicks and includes transfer stops in map bounds', async () => {
  const selected: number[] = [];
  const bounds: Bounds[] = [];
  const root = await mount({
    itinerary: [null, transferRoute()],
    selectedParticipantIndex: 1,
    onSelectParticipant: index => selected.push(index),
  });
  act(() =>
    root.findByType(MapSurface).props.onCreate({
      setBounds: (value: Bounds) => bounds.push(value),
      panTo() {},
    }),
  );
  assert(
    bounds[0].points.some(
      point => point.lat === 37.476 && point.lng === 126.981,
    ),
  );
  act(() =>
    root
      .findAllByType(Marker)[2]
      .props.onClick({ getPosition: () => new LatLng(37.5, 127) }),
  );
  assert.deepEqual(selected, [2]);
});

test('invalid stop coordinates are omitted and later transfers retain their ordinal', async () => {
  const item = transferRoute();
  item.itinerary.steps = [
    { mode: 'transit' },
    {
      mode: 'transit',
      transit: { departureStop: { location: { lat: NaN, lng: 127 } } },
    },
    { mode: 'walk' },
    {
      mode: 'transit',
      transit: {
        departureStop: {
          name: '서울역',
          location: { lat: 37.554, lng: 126.972 },
        },
      },
    },
  ];
  const root = await mount({ itinerary: [item], selectedParticipantIndex: 0 });
  const transfers = root.findAll(
    node => node.type === 'button' && node.props['data-route-transfer'],
  );
  assert.deepEqual(
    transfers.map(marker => marker.props['data-route-transfer']),
    [2],
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

const segments = [
  { mode: 'walk' as const, polyline: path.slice(0, 2) },
  {
    mode: 'transit' as const,
    polyline: [path[1], { lat: 37.65, lng: 127.25 }],
  },
  {
    mode: 'walk' as const,
    polyline: [{ lat: 37.65, lng: 127.25 }, path[2]],
  },
];
const segmentedRoute = () => ({
  ...route(),
  travel_mode: 'transit' as const,
  itinerary: {
    ...route().itinerary,
    segments: segments.map(segment => ({
      ...segment,
      polyline: [...segment.polyline],
    })),
  },
});

test('walking segments are dashed without painting a solid route underneath', async () => {
  const root = await mount({ itinerary: [null, segmentedRoute()] });
  const lines = root.findAllByType(Line);
  assert.equal(lines.length, 3);
  assert.deepEqual(
    lines.map(line => line.props.path),
    segments.map(s => s.polyline),
  );
  assert.deepEqual(
    lines.map(line => [line.props.strokeStyle, line.props.strokeColor]),
    [
      ['shortdash', '#8B5CCC'],
      ['solid', '#8B5CCC'],
      ['shortdash', '#8B5CCC'],
    ],
  );
});

test('legacy transit stays solid and explicitly walking routes are dashed', async () => {
  const transit = {
    ...route(),
    itinerary: { ...route().itinerary, walkingTime: 300 },
  };
  const walking = { ...route(), travel_mode: 'walk' as const };
  const car = { ...route(), travel_mode: 'car' as const };
  const root = await mount({ itinerary: [transit, walking, car] });
  assert.deepEqual(
    root.findAllByType(Line).map(line => line.props.strokeStyle),
    ['solid', 'shortdash', 'solid'],
  );
});

for (const invalidPath of [
  [],
  [path[0]],
  [{ lat: NaN, lng: 127 }, path[0]],
  [{ lat: 200, lng: 127 }, path[0]],
]) {
  test(`incomplete segment geometry falls back to the whole route (${JSON.stringify(invalidPath)})`, async () => {
    const itinerary = segmentedRoute();
    itinerary.itinerary.segments[1] = {
      mode: 'transit',
      polyline: invalidPath,
    };
    const root = await mount({ itinerary: [itinerary] });
    const lines = root.findAllByType(Line);
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0].props.path, path);
    assert.equal(lines[0].props.strokeStyle, 'solid');
  });
}

test('selecting a participant highlights every segment in that route only', async () => {
  const root = await mount({ itinerary: [null, segmentedRoute(), route()] });
  act(() =>
    root.findByType(MapSurface).props.onCreate({
      setLevel() {},
      setCenter() {},
      panTo() {},
    }),
  );
  act(() =>
    root.findAllByType(Marker)[1].props.onClick({
      getPosition: () => new LatLng(37.501, 127.101),
    }),
  );
  assert.deepEqual(
    root
      .findAllByType(Line)
      .map(line => [line.props.strokeWeight, line.props.zIndex]),
    [
      [7, 1],
      [7, 1],
      [7, 1],
      [6, 0],
    ],
  );
});

test('overview includes segment geometry even when the legacy whole-route path is absent', async () => {
  const itinerary = segmentedRoute();
  itinerary.itinerary.total_polyline = [];
  const root = await mount({ focusMode: 'overview', itinerary: [itinerary] });
  let bounds: Bounds | undefined;
  act(() =>
    root.findByType(MapSurface).props.onCreate({
      setBounds: (value: Bounds) => {
        bounds = value;
      },
    }),
  );
  const points = bounds!.points;
  for (const point of segments.flatMap(segment => segment.polyline)) {
    assert.ok(
      points.some(
        actual => actual.lat === point.lat && actual.lng === point.lng,
      ),
    );
  }
});

test('an empty or single-point route never invents a visible line', async () => {
  const root = await mount({ itinerary: [null, route([]), route([path[0]])] });
  assert.equal(root.findAllByType(Line).length, 0);
});

test('the same candidate preserves user pan on equivalent rerenders, while a different candidate at the same destination restores overview', async () => {
  const props = {
    stationName: '서울역',
    endX: 126.972,
    endY: 37.554,
    participants,
    itinerary: [transferRoute(), route()],
    selectedParticipantIndex: 0,
    routeKey: 'candidate-a',
  };
  const root = await mount(props);
  const fitted: Bounds[] = [];
  act(() =>
    root.findByType(MapSurface).props.onCreate({
      setBounds: (bounds: Bounds) => fitted.push(bounds),
      panTo() {},
    }),
  );
  assert.equal(fitted.length, 1);
  act(() =>
    root.findAllByType(Marker)[1].props.onClick({
      getPosition: () => new LatLng(37.5, 127.1),
    }),
  );
  act(() =>
    tree?.update(
      <MeetingMap
        {...props}
        participants={participants.map(p => ({ ...p }))}
        itinerary={[transferRoute(), route()]}
      />,
    ),
  );
  assert.equal(fitted.length, 1, 'a refreshed array must not reset a user pan');
  act(() => tree?.update(<MeetingMap {...props} routeKey="candidate-b" />));
  assert.equal(
    fitted.length,
    2,
    'candidate identity must reset even at the same coordinates',
  );
});

interface InteractionProps {
  resultKey?: string;
  people?: Participant[];
  routes?: (ItineraryItem | null)[];
  endX?: number;
}

function InteractiveResult({
  resultKey = 'candidate-a',
  people = participants,
  routes = [transferRoute(), transferRoute(), route()],
  endX = 126.972,
}: InteractionProps) {
  const routeKey = JSON.stringify([resultKey, endX]);
  const interaction = useRouteInteraction({
    resultKey: routeKey,
    participants: people,
    itinerary: routes,
  });
  return (
    <>
      <MeetingMap
        stationName="서울역"
        endX={endX}
        endY={37.554}
        routeKey={routeKey}
        participants={people}
        itinerary={routes}
        selectedParticipantIndex={interaction.selectedParticipantIndex}
        isRouteFocused={interaction.isRouteFocused}
        selectedTransfer={interaction.selectedTransfer}
        onSelectParticipant={interaction.selectParticipant}
        onSelectTransfer={step => interaction.selectTransfer(step, 'map')}
        onShowOverview={interaction.showOverview}
      />
      <RouteDetails
        participants={people}
        itinerary={routes}
        selectedParticipantIndex={interaction.selectedParticipantIndex}
        selectedTransfer={interaction.selectedTransfer}
        onSelectParticipant={interaction.selectParticipant}
        onSelectTransfer={interaction.selectTransfer}
      />
    </>
  );
}

async function mountInteraction(props: InteractionProps = {}) {
  await act(async () => {
    tree = create(<InteractiveResult {...props} />);
  });
  assert.ok(tree);
  const pans: LatLng[] = [];
  const levels: number[] = [];
  const bounds: Bounds[] = [];
  act(() =>
    tree!.root.findByType(MapSurface).props.onCreate({
      panTo: (point: LatLng) => pans.push(point),
      setLevel: (level: number) => levels.push(level),
      setBounds: (value: Bounds) => bounds.push(value),
    }),
  );
  return { root: tree.root, pans, levels, bounds };
}

test('native map and detail buttons share transfer selection, dim other routes and restore a full overview', async () => {
  const { root, pans, levels, bounds } = await mountInteraction();
  assert.ok(
    root.findAllByType(Line).every(line => line.props.strokeOpacity === 1),
  );
  const transfer = () =>
    root
      .findAllByType('button')
      .find(button => button.props['data-route-transfer'] === 1)!;
  const detail = () => root.findByType(RouteDetails).findByType('button');
  assert.equal(transfer().props.type, 'button');
  act(() => transfer().props.onClick());
  assert.equal(root.findByType('details').props.open, true);
  assert.equal(detail().props['aria-pressed'], true);
  assert.equal(transfer().props['aria-pressed'], true);
  assert.deepEqual(pans, [new LatLng(37.476, 126.981)]);
  assert.deepEqual(levels, [4]);
  assert.deepEqual(
    root.findAllByType(Line).map(line => line.props.strokeOpacity),
    [1, 0.25, 0.25],
  );
  assert.deepEqual(
    root.findAllByType(Line).map(line => line.props.strokeWeight),
    [7, 6, 6],
  );

  act(() => detail().props.onClick());
  assert.equal(
    pans.length,
    2,
    'selecting the same transfer again recenters after a manual pan',
  );
  assert.equal(
    root.findByType(MeetingMap).props.selectedTransfer.source,
    'details',
  );
  act(() => tree!.update(<InteractiveResult />));
  assert.equal(
    pans.length,
    2,
    'an incidental render cannot repeat the transfer pan',
  );
  assert.equal(bounds.length, 1);

  const overview = root
    .findAllByType('button')
    .find(button => button.children.includes('전체 경로 보기'))!;
  act(() => overview.props.onClick());
  assert.equal(bounds.length, 2);
  assert.ok(
    root
      .findAllByType(Line)
      .every(
        line => line.props.strokeOpacity === 1 && line.props.strokeWeight === 6,
      ),
  );
  assert.equal(transfer().props['aria-pressed'], false);
  assert.equal(detail().props['aria-pressed'], false);
});

test('participant selection clears the previous transfer before reading another route', async () => {
  const { root, pans, bounds } = await mountInteraction();
  act(() => root.findByType(RouteDetails).findByType('button').props.onClick());
  act(() =>
    root.findByType('select').props.onChange({ target: { value: '1' } }),
  );
  assert.equal(root.findByType('select').props.value, 1);
  assert.equal(root.findByType(MeetingMap).props.selectedTransfer, null);
  assert.ok(
    root
      .findAllByType('button')
      .every(button => button.props['aria-pressed'] !== true),
  );
  assert.equal(
    pans.length,
    1,
    'participant selection must not pan to the previous transfer',
  );
  assert.deepEqual(
    root.findAllByType(Line).map(line => line.props.strokeOpacity),
    [0.25, 1, 0.25],
  );
  assert.equal(
    bounds.length,
    2,
    'switching participant must leave the old transfer zoom',
  );
  assert.ok(
    bounds[1].points.some(
      point =>
        point.lat === participants[1].start_y &&
        point.lng === participants[1].start_x,
    ),
  );
  assert.ok(
    !bounds[1].points.some(
      point =>
        point.lat === participants[0].start_y &&
        point.lng === participants[0].start_x,
    ),
  );
  act(() => tree!.update(<InteractiveResult />));
  assert.equal(
    bounds.length,
    2,
    'ordinary vote refreshes must preserve the selected route viewport',
  );
  act(() =>
    root.findByType('select').props.onChange({ target: { value: '0' } }),
  );
  assert.equal(root.findByType(MeetingMap).props.selectedTransfer, null);
  assert.equal(bounds.length, 3);
});

const movedTransfer = transferRoute();
for (const step of movedTransfer.itinerary.steps ?? []) {
  if (step.mode === 'transit' && step.transit?.departureStop)
    step.transit.departureStop.location = { lat: 37.55, lng: 127.15 };
}

for (const [label, changed] of [
  [
    'candidate key with unchanged destination and geometry',
    { resultKey: 'candidate-b' },
  ],
  ['destination coordinates', { endX: 127.2 }],
  [
    'participant identity at the same index',
    {
      people: [
        { ...participants[0], name: '새 참가자' },
        ...participants.slice(1),
      ],
    },
  ],
  [
    'transfer coordinates within the same route',
    { routes: [movedTransfer, transferRoute(), route()] },
  ],
] satisfies [string, InteractionProps][]) {
  test(`${label} clears transfer scope without resurrecting the old selection on return`, async () => {
    const { root, pans } = await mountInteraction();
    act(() =>
      root.findByType(RouteDetails).findByType('button').props.onClick(),
    );
    assert.equal(pans.length, 1);
    act(() => tree!.update(<InteractiveResult {...changed} />));
    assert.equal(root.findByType(MeetingMap).props.selectedTransfer, null);
    assert.equal(root.findByType(MeetingMap).props.isRouteFocused, false);
    assert.equal(pans.length, 1);
    act(() => tree!.update(<InteractiveResult />));
    assert.equal(root.findByType(MeetingMap).props.selectedTransfer, null);
    assert.equal(pans.length, 1);
  });
}
