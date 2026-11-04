import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Provider, createStore } from 'jotai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { api } from '../src/api/client';
import { modalState, searchState } from '../src/jotai/global/store';
import { mapIdState } from '../src/jotai/mapId/store';
import { roomState } from '../src/jotai/global/room';
import { meetingDestinationState } from '../src/jotai/meeting/store';
import type { LocationResult } from '../src/types/location';
import type { RoomStatusResponse } from '../src/services/search/types';
import DestinationResult from '../src/views/result/DestinationResult';
import MeetingDestinationField from '../src/views/search/components/MeetingDestinationField';

const mapId = '11111111-1111-4111-8111-111111111111';
const roomId = '22222222-2222-4222-8222-222222222222';
const hostId = '33333333-3333-4333-8333-333333333333';
const newerMapId = '44444444-4444-4444-8444-444444444444';
const destination = {
  name: '서울역',
  address: '서울 용산구 한강대로 405',
  x: 126.972,
  y: 37.554,
};
const origins = [
  {
    name: '민수',
    region_name: '사당동',
    full_address: '첫 출발지',
    start_x: 126.981,
    start_y: 37.477,
    travel_mode: 'walk',
  },
  {
    name: '민수',
    region_name: '사당동',
    full_address: '두번째 출발지',
    start_x: 127.101,
    start_y: 37.501,
    travel_mode: 'car',
  },
  {
    name: '지수',
    region_name: '신림동',
    full_address: '세번째 출발지',
    start_x: 126.929,
    start_y: 37.484,
    travel_mode: 'transit',
  },
] satisfies LocationResult['request_info']['participant'];
function result(shared = false): LocationResult {
  return {
    map_id: mapId,
    station_info: [],
    request_info: {
      participant: origins,
      meetingDestination: destination,
      destinationRoutes: [
        {
          participantIndex: 1,
          status: 'ok',
          route: {
            name: '민수',
            region_name: '사당동',
            travel_mode: 'car',
            itinerary: { totalTime: 1200, total_polyline: [] },
          },
        },
        { participantIndex: 0, status: 'unavailable' },
      ],
      ...(shared ? { destinationRoom: { roomId, runId: 'run' } } : {}),
    },
  };
}
const currentRoom = (): RoomStatusResponse => ({
  room_id: roomId,
  result_map_id: mapId,
  recommendation_status: 'completed',
  meeting_destination: destination,
  participant: [],
});
const originalAdapter = api.defaults.adapter;
const originalReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
const originalLocalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);
let tree: ReactTestRenderer | undefined;
let client: QueryClient | undefined;

afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  client?.clear();
  api.defaults.adapter = originalAdapter;
  for (const [key, descriptor] of [
    ['React', originalReact],
    ['localStorage', originalLocalStorage],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

async function mount(
  options: {
    shared?: boolean;
    owner?: boolean;
    activeRoomId?: string;
    room?: RoomStatusResponse;
    value?: LocationResult;
  } = {},
) {
  Object.defineProperty(globalThis, 'React', {
    configurable: true,
    value: React,
  });
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    },
  });
  const store = createStore();
  store.set(roomState, {
    roomId: options.activeRoomId ?? roomId,
    hostId: options.owner ? hostId : '',
    resultMapId: mapId,
  });
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: 0 },
    },
  });
  client.setQueryData(
    ['inputStatusList', roomId],
    options.room ?? currentRoom(),
  );
  const navigation: string[] = [];
  const value = options.value ?? result(options.shared);
  await act(async () => {
    tree = create(
      <Provider store={store}>
        <QueryClientProvider client={client!}>
          <AppRouterContext.Provider
            value={{
              push: path => navigation.push(path),
              replace() {},
              refresh() {},
              back() {},
              forward() {},
              prefetch: async () => {},
            }}
          >
            <DestinationResult
              result={value}
              activeMapId={mapId}
              activeMapHostId={options.owner ? hostId : ''}
            />
          </AppRouterContext.Provider>
        </QueryClientProvider>
      </Provider>,
    );
  });
  return { store, navigation, root: tree!.root, client };
}

test('partial and missing routes retain every origin, mapping duplicate names by participantIndex', async () => {
  const m = await mount();
  const rows = m.root.findAllByType('li');
  assert.equal(rows.length, 3);
  for (const [index, mode, coordinates, time] of [
    [0, 'walk', '37.477,126.981', '조회 불가'],
    [1, 'car', '37.501,127.101', '20분'],
    [2, 'traffic', '37.484,126.929', '조회 불가'],
  ] as const) {
    const links = rows[index].findAllByType('a');
    assert.equal(
      links.length,
      2,
      'app-first and explicit web links remain available',
    );
    for (const link of links) {
      assert.match(link.props.href, new RegExp(`/by/${mode}/`));
      assert.ok(link.props.href.includes(`,${coordinates}/`));
      assert.ok(link.props.href.endsWith(',37.554,126.972'));
    }
    assert.ok(
      rows[index].findAll(node => node.children.includes(time)).length > 0,
    );
  }
  assert.equal(
    m.root.findByType(MeetingDestinationField).props.onChange,
    undefined,
  );
  assert.equal(
    m.root
      .findAllByType('button')
      .some(button => button.children.includes('확정하기')),
    false,
  );
});

test('direct owner retry restores all origins and selected destination before opening /meeting/list', async () => {
  const m = await mount({ owner: true });
  const retry = m.root
    .findAllByType('button')
    .find(button => button.children.includes('출발지 확인·다시 계산'));
  assert.ok(retry);
  await act(async () => retry.props.onClick());
  assert.deepEqual(m.navigation, ['/meeting/list']);
  assert.deepEqual(m.store.get(meetingDestinationState), destination);
  assert.deepEqual(
    m.store
      .get(searchState)
      .map(item => [
        item.name,
        item.address.fullAddress,
        item.address.longitude,
        item.address.latitude,
        item.travelMode,
      ]),
    [
      ['민수', '첫 출발지', 126.981, 37.477, 'walk'],
      ['민수', '두번째 출발지', 127.101, 37.501, 'car'],
      ['지수', '세번째 출발지', 126.929, 37.484, 'transit'],
    ],
  );
});

test('direct destination editing keeps the origins and opens the dedicated list', async () => {
  const m = await mount({ owner: true });
  const changed = {
    ...destination,
    name: '새 모임 장소',
    x: 127.027,
    y: 37.497,
  };
  await act(async () =>
    m.root.findByType(MeetingDestinationField).props.onChange(changed),
  );
  assert.deepEqual(m.store.get(meetingDestinationState), changed);
  assert.equal(m.store.get(searchState).length, 3);
  assert.deepEqual(m.navigation, ['/meeting/list']);
});

for (const scenario of [
  { name: 'guest', owner: false },
  {
    name: 'host of another active room',
    owner: true,
    activeRoomId: newerMapId,
  },
  {
    name: 'outdated snapshot',
    owner: true,
    room: { ...currentRoom(), result_map_id: newerMapId },
  },
  {
    name: 'outdated guest snapshot',
    owner: false,
    room: { ...currentRoom(), result_map_id: newerMapId },
  },
  {
    name: 'reset destination',
    owner: true,
    room: { ...currentRoom(), result_map_id: null },
  },
]) {
  test(`${scenario.name} cannot mutate a shared destination result`, async () => {
    const m = await mount({ shared: true, ...scenario });
    assert.equal(
      m.root.findByType(MeetingDestinationField).props.onChange,
      undefined,
    );
    assert.equal(
      m.root
        .findAllByType('button')
        .some(button => button.children.includes('다시 계산하기')),
      false,
    );
    if (scenario.room?.result_map_id === newerMapId) {
      assert.ok(
        m.root
          .findAllByType('a')
          .some(link => link.props.href === `/result?mapId=${newerMapId}`),
      );
    }
    if (scenario.name === 'reset destination') {
      const listLink = m.root
        .findAllByType('a')
        .find(link => link.props.href === '/search/list-together');
      assert.ok(listLink);
      act(() => listLink.props.onClick());
      assert.equal(m.store.get(roomState).resultMapId, undefined);
    }
  });
}

for (const action of ['retry', 'change'] as const) {
  test(`shared host ${action} resets the room destination before invalidation and list navigation`, async () => {
    let serverRoom = currentRoom();
    const requests: Array<{ url: string; body: unknown }> = [];
    api.defaults.adapter = async config => {
      const body = JSON.parse(config.data);
      requests.push({ url: config.url!, body });
      if (config.url?.endsWith('location_room_destination_update')) {
        serverRoom = {
          ...serverRoom,
          result_map_id: null,
          recommendation_status: 'idle',
          meeting_destination: body.p_meeting_destination,
        };
      }
      return {
        data: serverRoom,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    const m = await mount({ shared: true, owner: true });
    const selected =
      action === 'retry'
        ? destination
        : { ...destination, name: '다음 장소', x: 127.027 };
    await act(async () => {
      if (action === 'change')
        await m.root
          .findByType(MeetingDestinationField)
          .props.onChange(selected);
      else
        await m.root
          .findAllByType('button')
          .find(button => button.children.includes('다시 계산하기'))!
          .props.onClick();
    });
    assert.deepEqual(
      requests.map(item => item.url),
      [
        '/rest/v1/rpc/location_room_status',
        '/rest/v1/rpc/location_room_destination_update',
        '/rest/v1/rpc/location_room_status',
      ],
    );
    assert.deepEqual(requests[1].body, {
      p_room_id: roomId,
      p_room_host_id: hostId,
      p_meeting_destination: selected,
      p_expected_map_id: mapId,
    });
    assert.equal(m.store.get(roomState).resultMapId, undefined);
    assert.equal(
      m.client.getQueryData<RoomStatusResponse>(['inputStatusList', roomId])
        ?.result_map_id,
      null,
    );
    assert.deepEqual(m.navigation, ['/search/list-together']);
  });
}

test('retry and destination change cannot race while the room request is pending', async () => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => {
    release = resolve;
  });
  let reads = 0;
  let writes = 0;
  api.defaults.adapter = async config => {
    if (config.url?.endsWith('location_room_status')) {
      reads++;
      await wait;
    } else writes++;
    return {
      data: writes ? { ...currentRoom(), result_map_id: null } : currentRoom(),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  const m = await mount({ shared: true, owner: true });
  const change = m.root.findByType(MeetingDestinationField).props.onChange;
  const retry = m.root
    .findAllByType('button')
    .find(button => button.children.includes('다시 계산하기'))!;
  let completion: Promise<void>;
  act(() => {
    completion = retry.props.onClick();
  });
  assert.equal(retry.props.disabled, true);
  await act(async () => {
    await change({ ...destination, name: '경쟁 변경' });
    await retry.props.onClick();
  });
  assert.equal(reads, 1);
  assert.equal(writes, 0);
  await act(async () => {
    release();
    await completion;
  });
  assert.equal(writes, 1);
  assert.deepEqual(m.navigation, ['/search/list-together']);
});

test('a failed shared reset displays the error, preserves the snapshot, and permits retry', async () => {
  let fail = true;
  api.defaults.adapter = async config => {
    if (config.url?.endsWith('location_room_destination_update') && fail)
      throw new Error('변경 실패');
    return {
      data: currentRoom(),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  const m = await mount({ shared: true, owner: true });
  const retry = () =>
    m.root
      .findAllByType('button')
      .find(button => button.children.includes('다시 계산하기'))!;
  await act(async () => retry().props.onClick());
  assert.equal(
    m.root
      .findAllByType('div')
      .find(node => node.props.role === 'alert')
      ?.children.includes('변경 실패'),
    true,
  );
  assert.equal(retry().props.disabled, false);
  assert.deepEqual(m.navigation, []);
  assert.equal(m.store.get(roomState).resultMapId, mapId);
  fail = false;
  await act(async () => retry().props.onClick());
  assert.deepEqual(m.navigation, ['/search/list-together']);
});

test('a room result that changes after render cannot be reset from an old snapshot', async () => {
  let writes = 0;
  api.defaults.adapter = async config => {
    if (config.url?.endsWith('location_room_destination_update')) writes++;
    return {
      data: { ...currentRoom(), result_map_id: newerMapId },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  const m = await mount({ shared: true, owner: true });
  await act(async () =>
    m.root
      .findAllByType('button')
      .find(button => button.children.includes('다시 계산하기'))!
      .props.onClick(),
  );
  assert.equal(writes, 0);
  assert.deepEqual(m.navigation, []);
  assert.equal(
    m.root.findByType(MeetingDestinationField).props.onChange,
    undefined,
  );
  assert.ok(
    m.root
      .findAllByType('a')
      .some(link => link.props.href === `/result?mapId=${newerMapId}`),
  );
});

test('sharing uses the displayed result ID even when the local owner cache points elsewhere', async () => {
  const m = await mount();
  m.store.set(mapIdState, { mapId: newerMapId, mapHostId: hostId });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  let copied = '';
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { href: 'https://example.test/result?old=value#section' },
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (url: string) => {
          copied = url;
        },
      },
    },
  });
  try {
    const share = m.root
      .findAllByType('button')
      .find(button =>
        button.children.some(
          child => typeof child === 'string' && child.includes('결과 공유'),
        ),
      );
    assert.ok(share);
    await act(async () => share.props.onClick());
    assert.equal(copied, `https://example.test/result?mapId=${mapId}`);
    assert.equal(m.store.get(modalState).isOpen, true);
  } finally {
    for (const [key, descriptor] of [
      ['window', previousWindow],
      ['navigator', previousNavigator],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
