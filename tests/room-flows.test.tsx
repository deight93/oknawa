import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Provider, createStore } from 'jotai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { AxiosError, type AxiosAdapter } from 'axios';
import { api, edgeApi } from '../src/api/client';
import useSearchEntryFlow from '../src/hooks/search/useSearchEntryFlow';
import useSearchForm from '../src/hooks/form/search/useSearchForm';
import { roomState } from '../src/jotai/global/room';
import { modalState, searchState } from '../src/jotai/global/store';
import SearchCompleteListWithTogetherView from '../src/views/search/SearchCompleteListWithTogether';
import SearchLoading from '../src/views/search/components/SearchLoading';
import RecommendationOptionSelector from '../src/views/search/components/RecommendationOptionSelector';
import { Button } from '@nextui-org/react';
import type { Participant } from '../src/types/location';

const roomId = '11111111-1111-4111-8111-111111111111';
const otherRoomId = '22222222-2222-4222-8222-222222222222';
const mapId = '33333333-3333-4333-8333-333333333333';
const runId = '44444444-4444-4444-8444-444444444444';
const hostId = 'creator-only';
const form = {
  name: '방장',
  address: {
    fullAddress: '서울 강남구',
    regionName: '강남역',
    latitude: 37.5,
    longitude: 127,
  },
};
const participants: Participant[] = ['방장', '친구', '방금 합류'].map(
  (name, i) => ({
    name,
    region_name: '강남역',
    full_address: '서울 강남구',
    start_x: 127 + i / 100,
    start_y: 37.5,
    travel_mode: i === 2 ? 'walk' : null,
  }),
);

async function until(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await act(async () => {
      await wait(10);
    });
  }
  assert.fail('Room flow did not reach the expected state');
}

async function mountRoom(
  options: {
    shareRoomId?: string;
    view?: boolean;
    adapter?: AxiosAdapter;
    status?: string;
    type?: 'individual' | 'together';
  } = {},
) {
  const memory = new Map<string, string>([
    ['room', JSON.stringify({ roomId, hostId })],
  ]);
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  const globals = Object.entries({
    localStorage: storage,
    sessionStorage: storage,
    React,
    HTMLElement: class {},
    SVGElement: class {},
    window: {
      localStorage: storage,
      sessionStorage: storage,
      setInterval,
      clearInterval,
      setTimeout,
      clearTimeout,
    },
  });
  const previous = globals.map(([key]) =>
    Object.getOwnPropertyDescriptor(globalThis, key),
  );
  for (const [key, value] of globals)
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const originalApi = api.defaults.adapter,
    originalEdge = edgeApi.defaults.adapter;
  api.defaults.adapter = edgeApi.defaults.adapter =
    options.adapter ??
    (async config => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
  const store = createStore();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const status = {
    room_id: roomId,
    recommendation_status: options.status ?? 'idle',
    result_map_id: null,
    recommendation_options: { travelMode: 'transit', midpointBasis: 'time' },
    participant: participants.slice(0, 2),
  };
  client.setQueryData(['inputStatusList', roomId], status);
  const navigation: string[] = [];
  let resetCount = 0;
  let entry!: ReturnType<typeof useSearchEntryFlow>,
    renderer!: ReactTestRenderer;
  let searchForm!: ReturnType<typeof useSearchForm>;
  let setShareRoomId!: React.Dispatch<React.SetStateAction<string | null>>;
  function Probe() {
    searchForm = useSearchForm();
    const [shareRoomId, changeRoom] = React.useState(
      options.shareRoomId ?? null,
    );
    setShareRoomId = changeRoom;
    entry = useSearchEntryFlow(options.type ?? 'together', shareRoomId, () => {
      resetCount++;
      searchForm.reset();
    });
    return options.view ? <SearchCompleteListWithTogetherView /> : null;
  }
  await act(async () => {
    renderer = create(
      <AppRouterContext.Provider
        value={{
          back() {},
          forward() {},
          refresh() {},
          prefetch: async () => {},
          push: url => {
            navigation.push(url);
          },
          replace: url => {
            navigation.push(url);
          },
        }}
      >
        <Provider store={store}>
          <QueryClientProvider client={client}>
            <Probe />
          </QueryClientProvider>
        </Provider>
      </AppRouterContext.Provider>,
    );
  });
  return {
    get entry() {
      return entry;
    },
    get searchForm() {
      return searchForm;
    },
    renderer,
    navigation,
    store,
    client,
    status,
    memory,
    changeRoom: (id: string) => act(() => setShareRoomId(id)),
    get resetCount() {
      return resetCount;
    },
    close() {
      act(() => renderer.unmount());
      client.clear();
      api.defaults.adapter = originalApi;
      edgeApi.defaults.adapter = originalEdge;
      globals.forEach(([key], i) => {
        const descriptor = previous[i];
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      });
    },
  };
}

test('an individual input step accepts only one of repeated or delayed validated submissions', async () => {
  const mounted = await mountRoom({ type: 'individual' });
  try {
    const submitFirst = mounted.entry.submitSearch;
    act(() => {
      submitFirst(form);
      submitFirst(form);
    });
    assert.equal(mounted.store.get(searchState).length, 1);
    assert.equal(mounted.resetCount, 1);
    assert.deepEqual(mounted.navigation, []);
    act(() => submitFirst(form));
    assert.equal(mounted.store.get(searchState).length, 1);
    assert.equal(mounted.resetCount, 1);
  } finally {
    mounted.close();
  }
});

test('individual registration stays locked while navigation to the list is pending', async () => {
  const mounted = await mountRoom({ type: 'individual' });
  try {
    act(() => mounted.entry.submitSearch(form));
    const friend = { ...form, name: '친구' };
    act(() => {
      mounted.entry.submitSearch(friend);
      mounted.entry.submitSearch(friend);
    });
    act(() => mounted.entry.submitSearch(friend));
    assert.deepEqual(
      mounted.store.get(searchState).map(person => person.name),
      ['방장', '친구'],
    );
    assert.deepEqual(mounted.navigation, ['/search/list']);
    assert.equal(mounted.entry.isSubmitting, true);
  } finally {
    mounted.close();
  }
});

test('concurrent form validation adds one person, then allows an intentionally identical next person', async () => {
  const mounted = await mountRoom({ type: 'individual' });
  const fill = () => {
    mounted.searchForm.setValue('name', '같은 이름');
    mounted.searchForm.setValue('address', form.address);
    mounted.searchForm.setValue('travelMode', 'walk');
  };
  try {
    act(fill);
    const submitFirst = mounted.searchForm.handleSubmit(
      mounted.entry.submitSearch,
    );
    await act(async () => {
      await Promise.all([submitFirst(), submitFirst()]);
    });
    assert.equal(mounted.store.get(searchState).length, 1);
    assert.equal(mounted.searchForm.getValues('name'), '');
    assert.equal(mounted.searchForm.getValues('travelMode'), 'transit');
    await act(async () => {
      await mounted.searchForm.handleSubmit(mounted.entry.submitSearch)();
    });
    assert.equal(mounted.store.get(searchState).length, 1);
    assert.equal(mounted.resetCount, 1);
    act(fill);
    const submitNext = mounted.searchForm.handleSubmit(
      mounted.entry.submitSearch,
    );
    await act(async () => {
      await Promise.all([submitNext(), submitNext()]);
    });
    assert.equal(mounted.store.get(searchState).length, 2);
    assert.deepEqual(
      mounted.store
        .get(searchState)
        .map(person => ({ name: person.name, mode: person.travelMode })),
      [
        { name: '같은 이름', mode: 'walk' },
        { name: '같은 이름', mode: 'walk' },
      ],
    );
    assert.deepEqual(mounted.navigation, ['/search/list']);
  } finally {
    mounted.close();
  }
});

for (const joining of [false, true]) {
  for (const fails of [false, true]) {
    test(`leaving pending ${joining ? 'join' : 'create'} ignores a late ${fails ? 'error' : 'response'}`, async () => {
      let release!: () => void;
      let started = false;
      const pending = new Promise<void>(resolve => {
        release = resolve;
      });
      const mounted = await mountRoom({
        shareRoomId: joining ? otherRoomId : undefined,
        adapter: async config => {
          started = true;
          await pending;
          if (fails) throw new Error('Late registration failure');
          return {
            data: { room_id: otherRoomId, room_host_id: 'late-host' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          };
        },
      });
      try {
        act(() => mounted.entry.submitSearch(form));
        await until(() => started);
        act(() => mounted.renderer.unmount());
        mounted.store.set(roomState, {
          roomId: mapId,
          hostId: 'next-room-host',
        });
        await act(async () => {
          release();
          await wait(20);
        });
        assert.deepEqual(mounted.navigation, []);
        assert.deepEqual(mounted.store.get(roomState), {
          roomId: mapId,
          hostId: 'next-room-host',
        });
        assert.equal(mounted.store.get(modalState).isOpen, false);
      } finally {
        release();
        mounted.close();
      }
    });
  }
}

test('changing the invitation on a mounted form ignores the old request and permits the new one', async () => {
  const releases: Array<() => void> = [];
  const mounted = await mountRoom({
    shareRoomId: roomId,
    adapter: async config => {
      await new Promise<void>(resolve => {
        releases.push(resolve);
      });
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  try {
    act(() => mounted.entry.submitSearch(form));
    await until(() => releases.length === 1);
    mounted.changeRoom(otherRoomId);
    assert.equal(mounted.entry.isSubmitting, false);
    act(() => mounted.entry.submitSearch({ ...form, name: '새 친구' }));
    await until(() => releases.length === 2);
    await act(async () => {
      releases[0]();
      await wait(20);
    });
    assert.deepEqual(mounted.navigation, []);
    assert.equal(mounted.entry.isSubmitting, true);
    await act(async () => {
      releases[1]();
      await wait(20);
    });
    assert.deepEqual(mounted.navigation, ['/search/list-together']);
    assert.equal(mounted.store.get(roomState).roomId, otherRoomId);
  } finally {
    releases.forEach(release => release());
    mounted.close();
  }
});

test('individual entry still accepts the next friend after resetting the first entry', async () => {
  const mounted = await mountRoom({ type: 'individual' });
  try {
    act(() => mounted.entry.submitSearch(form));
    assert.equal(mounted.resetCount, 1);
    assert.equal(mounted.entry.isSubmitting, false);
    assert.equal(mounted.entry.searchCount, 1);
    const friend = { ...form, name: '다음 친구', travelMode: 'walk' as const };
    act(() => mounted.entry.submitSearch(friend));
    assert.deepEqual(
      mounted.store.get(searchState),
      [form, friend].map(person => ({
        ...person,
        travelMode: 'travelMode' in person ? person.travelMode : undefined,
      })),
    );
    assert.deepEqual(mounted.navigation, ['/search/list']);
  } finally {
    mounted.close();
  }
});

test('using a host’s own invitation link preserves the existing host capability', async () => {
  const mounted = await mountRoom({ shareRoomId: roomId });
  try {
    act(() => mounted.entry.submitSearch(form));
    await until(() => mounted.navigation.length > 0);
    assert.equal(mounted.store.get(roomState).hostId, hostId);
    assert.equal(mounted.store.get(roomState).roomId, roomId);
  } finally {
    mounted.close();
  }
});

for (const shareRoomId of [undefined, otherRoomId]) {
  test(`${shareRoomId ? 'joining' : 'creating'} a room sends one request through double submit and the navigation gap`, async () => {
    let release!: () => void;
    const response = new Promise<void>(resolve => {
      release = resolve;
    });
    const requests: string[] = [];
    const mounted = await mountRoom({
      shareRoomId,
      adapter: async config => {
        requests.push(config.url ?? '');
        await response;
        return {
          data: { room_id: otherRoomId, room_host_id: 'new-creator' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      },
    });
    try {
      act(() => {
        mounted.entry.submitSearch(form);
        mounted.entry.submitSearch(form);
      });
      await until(() => requests.length > 0);
      assert.equal(requests.length, 1);
      assert.equal(mounted.entry.isSubmitting, true);
      release();
      await until(() => mounted.navigation.length > 0);
      act(() => mounted.entry.submitSearch(form));
      await act(async () => {
        await wait(10);
      });
      assert.equal(requests.length, 1);
      assert.equal(mounted.navigation.length, 1);
    } finally {
      release();
      mounted.close();
    }
  });
}

test('a failed registration unlocks retry and displays the existing error modal', async () => {
  let requests = 0;
  const mounted = await mountRoom({
    adapter: async config => {
      requests++;
      if (requests === 1) throw new Error('등록 실패');
      return {
        data: { room_id: otherRoomId, room_host_id: 'new-creator' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  });
  try {
    act(() => mounted.entry.submitSearch(form));
    await until(() => mounted.client.isMutating() === 0);
    assert.equal(mounted.entry.isSubmitting, false);
    assert.equal(mounted.store.get(modalState).isOpen, true);
    act(() => mounted.entry.submitSearch(form));
    await until(() => mounted.navigation.length > 0);
    assert.equal(requests, 2);
  } finally {
    mounted.close();
  }
});

test('visiting another room never grants it the previous host capability and returning restores ownership', async () => {
  const mounted = await mountRoom({ shareRoomId: otherRoomId });
  try {
    act(() => mounted.entry.submitSearch(form));
    await until(() => mounted.navigation.length > 0);
    assert.deepEqual(mounted.store.get(roomState), {
      roomId: otherRoomId,
      hostId: '',
    });
    act(() => mounted.store.set(roomState, { roomId, hostId: '' }));
    assert.equal(mounted.store.get(roomState).hostId, hostId);
    // A fresh store mounts the same public atom, as a browser reload does.
    const reloaded = createStore();
    const unsubscribe = reloaded.sub(roomState, () => {});
    try {
      assert.equal(reloaded.get(roomState).hostId, hostId);
    } finally {
      unsubscribe();
    }
  } finally {
    mounted.close();
  }
});

test('a rejected late join shows the existing error modal without losing the current room or navigating', async () => {
  const message =
    '이미 추천이 시작된 방입니다. 방장에게 새 모임 링크를 요청해주세요.';
  const mounted = await mountRoom({
    shareRoomId: otherRoomId,
    adapter: async config => {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        {
          data: { message },
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config,
        },
      );
    },
  });
  try {
    act(() => mounted.entry.submitSearch(form));
    await until(() => mounted.client.isMutating() === 0);
    assert.equal(mounted.store.get(modalState).isOpen, true);
    assert.equal(mounted.store.get(modalState).contents, message);
    assert.deepEqual(mounted.navigation, []);
    assert.deepEqual(mounted.store.get(roomState), { roomId, hostId });
  } finally {
    mounted.close();
  }
});

test('reloading while hosting a room retains capabilities for other previously hosted rooms', async () => {
  const mounted = await mountRoom();
  try {
    act(() =>
      mounted.store.set(roomState, {
        roomId: otherRoomId,
        hostId: 'other-creator',
      }),
    );
    const reloaded = createStore();
    const unsubscribe = reloaded.sub(roomState, () => {});
    try {
      reloaded.set(roomState, { roomId: mapId, hostId: '' });
      assert.equal(reloaded.get(roomState).hostId, '');
      reloaded.set(roomState, { roomId, hostId: '' });
      assert.equal(reloaded.get(roomState).hostId, hostId);
      reloaded.set(roomState, { roomId: otherRoomId, hostId: '' });
      assert.equal(reloaded.get(roomState).hostId, 'other-creator');
    } finally {
      unsubscribe();
    }
  } finally {
    mounted.close();
  }
});

test('shared recommendation uses the start snapshot and publishes with that run identifier', async () => {
  let calculated: { name: string; travel_mode: string }[] = [];
  let completed: Record<string, unknown> = {};
  const mounted = await mountRoom({
    view: true,
    adapter: async config => {
      let data: unknown;
      if (config.url?.endsWith('location_room_recommend_start')) {
        data = { recommendation_run_id: runId, participant: participants };
      } else if (config.url?.endsWith('location-points')) {
        calculated = JSON.parse(config.data).participant;
        data = { map_id: mapId, map_host_id: 'map-creator' };
      } else if (config.url?.endsWith('location_result_by_map_id')) {
        data = {
          map_id: mapId,
          station_info: [],
          request_info: { participant: participants },
        };
      } else if (config.url?.endsWith('location_room_recommend_complete')) {
        completed = JSON.parse(config.data);
        data = {};
      } else {
        throw new Error(`Unexpected request: ${config.url}`);
      }
      return { data, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  try {
    act(() =>
      mounted.renderer.root
        .findByType(RecommendationOptionSelector)
        .props.onChange({ travelMode: 'car', midpointBasis: 'time' }),
    );
    act(() => mounted.renderer.root.findByType(Button).props.onClick());
    await until(() => mounted.navigation.length > 0);
    assert.deepEqual(
      calculated.map(p => p.name),
      ['방장', '친구', '방금 합류'],
    );
    assert.deepEqual(
      calculated.map(p => p.travel_mode),
      ['car', 'car', 'walk'],
    );
    assert.equal(completed.p_recommendation_run_id, runId);
    assert.deepEqual(
      mounted.store.get(searchState).map(p => p.name),
      ['방장', '친구', '방금 합류'],
    );
    assert.equal(mounted.navigation.at(-1), `/result?mapId=${mapId}`);
  } finally {
    mounted.close();
  }
});

test('a failed room calculation releases only its own run and stays on the list', async () => {
  let failure: Record<string, unknown> | undefined;
  const mounted = await mountRoom({
    view: true,
    adapter: async config => {
      if (config.url?.endsWith('location-points'))
        throw new Error('경로 조회 실패');
      let data: unknown;
      if (config.url?.endsWith('location_room_recommend_start')) {
        data = { recommendation_run_id: runId, participant: participants };
      } else if (config.url?.endsWith('location_room_recommend_fail')) {
        failure = JSON.parse(config.data);
        data = {};
      } else {
        throw new Error(`Unexpected request: ${config.url}`);
      }
      return { data, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  try {
    act(() => mounted.renderer.root.findByType(Button).props.onClick());
    await until(() => failure !== undefined);
    assert.equal(failure?.p_recommendation_run_id, runId);
    assert.equal(failure?.p_room_host_id, hostId);
    assert.deepEqual(mounted.navigation, []);
    assert.equal(mounted.store.get(modalState).isOpen, true);
    assert.equal(mounted.renderer.root.findAllByType(SearchLoading).length, 0);
  } finally {
    mounted.close();
  }
});

test('an old server response without a snapshot cannot calculate from a stale client list', async () => {
  const requests: string[] = [];
  const mounted = await mountRoom({
    view: true,
    adapter: async config => {
      requests.push(config.url ?? '');
      return {
        data: { recommendation_status: 'generating' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  });
  try {
    act(() => mounted.renderer.root.findByType(Button).props.onClick());
    await until(() => mounted.store.get(modalState).isOpen);
    assert.deepEqual(requests, ['/rest/v1/rpc/location_room_recommend_start']);
    assert.deepEqual(mounted.navigation, []);
  } finally {
    mounted.close();
  }
});

test('a recovered room removes the loading overlay and enables the existing host retry button', async () => {
  const mounted = await mountRoom({ view: true, status: 'generating' });
  try {
    assert.equal(mounted.renderer.root.findAllByType(SearchLoading).length, 1);
    assert.equal(
      mounted.renderer.root.findByType(Button).props.isDisabled,
      true,
    );
    await act(async () => {
      mounted.client.setQueryData(['inputStatusList', roomId], {
        ...mounted.status,
        recommendation_status: 'failed',
      });
      await wait(10);
    });
    assert.equal(mounted.renderer.root.findAllByType(SearchLoading).length, 0);
    assert.equal(
      mounted.renderer.root.findByType(Button).props.isDisabled,
      false,
    );
  } finally {
    mounted.close();
  }
});
