import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Provider, createStore } from 'jotai';
import { RESET } from 'jotai/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AxiosAdapter } from 'axios';
import { api, edgeApi } from '../src/api/client';
import useCreateResultFlow from '../src/hooks/search/useCreateResultFlow';
import useVoteFlow from '../src/hooks/result/useVoteFlow';
import { modalState, searchState } from '../src/jotai/global/store';
import { mapIdState } from '../src/jotai/mapId/store';
import { resultState } from '../src/jotai/result/store';
import { resultConfirmState } from '../src/jotai/result-confirm/store';
import SearchService from '../src/services/search/SearchService';
import { CreatedResult } from '../src/services/search/types';
import { hasVotedForMap, setVotedForMap } from '../src/utils/voteStorage';

const oldMap = '11111111-1111-4111-8111-111111111111';
const newMap = '22222222-2222-4222-8222-222222222222';
const shareKey = '33333333-3333-4333-8333-333333333333';
const roomId = '44444444-4444-4444-8444-444444444444';
const runId = '55555555-5555-4555-8555-555555555555';
const person = (name: string) => ({
  name,
  address: {
    fullAddress: '서울',
    regionName: '강남역',
    latitude: 37.5,
    longitude: 127,
  },
});
const result = (mapId: string) => ({
  map_id: mapId,
  station_info: [],
  request_info: { participant: [] },
  vote_round: 1,
});
const station = {
  map_id: oldMap,
  share_key: shareKey,
  station_name: '강남역',
  address_name: '서울',
  end_x: 127,
  end_y: 37.5,
  vote: 1,
  itinerary: [],
  request_info: { participant: [] },
};
const phaseUrls = {
  preparing: 'location_room_recommend_start',
  creating: 'location-points',
  fetching: 'location_result_by_map_id',
  publishing: 'location_room_recommend_complete',
};
const newNotice = {
  isOpen: true,
  contents: '새 모임 안내',
  buttonLabel: '확인',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

async function until(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await act(async () => {
      await wait(10);
    });
  }
  assert.fail('Expected the async flow to reach its observable state');
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

async function mount<T, P>(
  hook: (props: P) => T,
  props: P,
  adapter: AxiosAdapter,
  voted = false,
) {
  const keys = ['window', 'localStorage', 'sessionStorage'];
  const previous = keys.map(key =>
    Object.getOwnPropertyDescriptor(globalThis, key),
  );
  const localStorage = memoryStorage(),
    sessionStorage = memoryStorage();
  const values = [
    { localStorage, sessionStorage, setTimeout, clearTimeout },
    localStorage,
    sessionStorage,
  ];
  keys.forEach((key, index) =>
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: values[index],
    }),
  );
  const store = createStore();
  store.set(searchState, RESET);
  store.set(mapIdState, { mapId: oldMap, mapHostId: 'original-host' });
  store.set(resultState, RESET);
  store.set(resultConfirmState, RESET);
  if (voted) setVotedForMap(oldMap, 1);
  const originalApi = api.defaults.adapter,
    originalEdge = edgeApi.defaults.adapter;
  api.defaults.adapter = edgeApi.defaults.adapter = adapter;
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const navigation: string[] = [];
  let current!: T,
    tree!: ReactTestRenderer,
    mounted = true;
  function Probe({ value }: { value: P }) {
    current = hook(value);
    return null;
  }
  const render = (value: P) => (
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
          <Probe value={value} />
        </QueryClientProvider>
      </Provider>
    </AppRouterContext.Provider>
  );
  await act(async () => {
    tree = create(render(props));
  });
  const unmount = () => {
    if (mounted)
      act(() => {
        tree.unmount();
        mounted = false;
      });
  };
  return {
    get current() {
      return current;
    },
    store,
    navigation,
    unmount,
    update: async (value: P) => {
      await act(async () => tree.update(render(value)));
    },
    confirm: () => {
      const callback = store.get(modalState).onConfirm;
      assert.ok(callback, 'Expected a user confirmation callback');
      return callback;
    },
    close: () => {
      unmount();
      client.clear();
      api.defaults.adapter = originalApi;
      edgeApi.defaults.adapter = originalEdge;
      keys.forEach((key, i) => {
        const descriptor = previous[i];
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      });
    },
  };
}

const roomOptions = {
  beforeCreate: async () => {
    await SearchService.startRoomRecommendation(roomId, 'room-host');
    return [person('이전 모임')];
  },
  onReady: (created: CreatedResult) =>
    SearchService.completeRoomRecommendation(
      roomId,
      'room-host',
      created.map_id,
      runId,
    ),
  onError: () =>
    SearchService.failRoomRecommendation(roomId, 'room-host', runId),
};

for (const phase of [
  'preparing',
  'creating',
  'fetching',
  'publishing',
] as const) {
  test(`leaving during ${phase} preserves the new flow and settles only the prepared room run`, async () => {
    const gate = deferred();
    const requests: { url: string; body: Record<string, unknown> }[] = [];
    let waiting = false;
    const m = await mount(
      () => useCreateResultFlow(),
      undefined,
      async config => {
        const url = config.url ?? '';
        requests.push({ url, body: JSON.parse(config.data) });
        if (url.endsWith(phaseUrls[phase])) {
          waiting = true;
          await gate.promise;
        }
        const data = url.endsWith(phaseUrls.preparing)
          ? { recommendation_run_id: runId, participant: [] }
          : url.endsWith(phaseUrls.creating)
            ? { map_id: oldMap, map_host_id: 'old-host' }
            : result(oldMap);
        return { data, status: 200, statusText: 'OK', headers: {}, config };
      },
    );
    try {
      let task!: Promise<void>;
      act(() => {
        task = m.current.requestResult(
          [person('이전 모임')],
          undefined,
          roomOptions,
        );
      });
      await until(() => waiting);
      m.unmount();
      m.store.set(searchState, [person('새 모임')]);
      m.store.set(mapIdState, { mapId: newMap, mapHostId: 'new-host' });
      m.store.set(resultState, result(newMap));
      m.store.set(modalState, newNotice);
      gate.resolve();
      await act(async () => {
        await task;
      });
      assert.deepEqual(m.navigation, []);
      assert.equal(m.store.get(searchState)[0].name, '새 모임');
      assert.equal(m.store.get(mapIdState).mapId, newMap);
      assert.equal(m.store.get(resultState).map_id, newMap);
      assert.deepEqual(m.store.get(modalState), newNotice);
      const failures = requests.filter(r =>
        r.url.endsWith('location_room_recommend_fail'),
      );
      assert.deepEqual(
        failures.map(r => r.body),
        phase === 'publishing'
          ? []
          : [
              {
                p_room_id: roomId,
                p_room_host_id: 'room-host',
                p_recommendation_run_id: runId,
              },
            ],
      );
      assert.equal(
        requests.filter(r => r.url.endsWith(phaseUrls.publishing)).length,
        phase === 'publishing' ? 1 : 0,
      );
    } finally {
      gate.resolve();
      m.close();
    }
  });
}

test('a recommendation error after leaving cannot replace a new modal', async () => {
  const gate = deferred();
  let waiting = false;
  const m = await mount(
    () => useCreateResultFlow(),
    undefined,
    async () => {
      waiting = true;
      await gate.promise;
      throw new Error('Old request failed');
    },
  );
  try {
    let task!: Promise<void>;
    act(() => {
      task = m.current.requestResult([person('이전 모임')]);
    });
    await until(() => waiting);
    m.unmount();
    m.store.set(modalState, newNotice);
    gate.resolve();
    await act(async () => {
      await task;
    });
    assert.deepEqual(m.store.get(modalState), newNotice);
    assert.deepEqual(m.navigation, []);
  } finally {
    gate.resolve();
    m.close();
  }
});

test('changing rooms rearms creation without allowing an old response to unlock or overwrite the new request', async () => {
  const oldGate = deferred(),
    newGate = deferred();
  let creates = 0;
  let oldTask: Promise<void> | undefined, newTask: Promise<void> | undefined;
  const m = await mount(
    (context: string) => useCreateResultFlow(context),
    'old-room',
    async config => {
      let data;
      if (config.url?.endsWith('location-points')) {
        const index = creates++;
        await (index === 0 ? oldGate : newGate).promise;
        data = { map_id: index === 0 ? oldMap : newMap, map_host_id: 'host' };
      } else data = result(newMap);
      return { data, status: 200, statusText: 'OK', headers: {}, config };
    },
  );
  try {
    act(() => {
      oldTask = m.current.requestResult([person('이전 모임')]);
    });
    await until(() => creates === 1);
    await m.update('new-room');
    assert.equal(m.current.isLoading, false);
    act(() => {
      newTask = m.current.requestResult([person('새 모임')]);
    });
    await until(() => creates === 2);
    oldGate.resolve();
    await act(async () => {
      await oldTask;
    });
    assert.deepEqual(m.navigation, []);
    assert.equal(m.current.isLoading, true);
    newGate.resolve();
    await act(async () => {
      await newTask;
    });
    assert.deepEqual(m.navigation, [`/result?mapId=${newMap}`]);
    assert.equal(m.store.get(searchState)[0].name, '새 모임');
    assert.equal(m.store.get(mapIdState).mapId, newMap);
    assert.equal(m.current.isLoading, true);
  } finally {
    oldGate.resolve();
    newGate.resolve();
    await act(async () => {
      await Promise.allSettled([oldTask, newTask]);
    });
    m.close();
  }
});

interface VoteContext {
  mapId: string;
  round: number;
}
const voteHook = ({ mapId, round }: VoteContext) =>
  useVoteFlow(shareKey, mapId, round);
const firstRound = { mapId: oldMap, round: 1 };

for (const change of ['round', 'map', 'unmount'] as const) {
  for (const outcome of ['success', 'error'] as const) {
    test(`a delayed vote ${outcome} after ${change} cannot change the current screen`, async () => {
      const gate = deferred();
      let votes = 0;
      const m = await mount(voteHook, firstRound, async config => {
        if (++votes === 1) {
          await gate.promise;
          if (outcome === 'error') throw new Error('Old vote failed');
        }
        return {
          data: { already_voted: false },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      });
      try {
        act(() => m.current.requestVote());
        const confirm = m.confirm();
        let task!: Promise<void>;
        act(() => {
          task = Promise.resolve(confirm());
        });
        await until(() => votes === 1);
        const next =
          change === 'map'
            ? { mapId: newMap, round: 1 }
            : { mapId: oldMap, round: 2 };
        if (change === 'unmount') m.unmount();
        else await m.update(next);
        m.store.set(modalState, newNotice);
        gate.resolve();
        await act(async () => {
          await task;
        });
        assert.deepEqual(m.store.get(modalState), newNotice);
        assert.deepEqual(m.navigation, []);
        if (change !== 'unmount') {
          assert.equal(m.current.isVote, false);
          assert.equal(hasVotedForMap(next.mapId, next.round), false);
          act(() => m.current.requestVote());
          const nextConfirm = m.confirm();
          await act(async () => {
            await nextConfirm();
          });
          assert.equal(votes, 2);
          assert.equal(m.current.isVote, true);
          assert.equal(hasVotedForMap(next.mapId, next.round), true);
        }
      } finally {
        gate.resolve();
        m.close();
      }
    });
  }
}

for (const action of ['vote', 'confirm'] as const) {
  test(`a retained ${action} dialog from the previous round cannot submit or dismiss the current dialog`, async () => {
    let requests = 0;
    const m = await mount(
      voteHook,
      firstRound,
      async config => {
        requests++;
        return {
          data: station,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      },
      action === 'confirm',
    );
    try {
      act(() => {
        if (action === 'vote') m.current.requestVote();
        else m.current.requestConfirm();
      });
      const stale = m.confirm();
      await m.update({ mapId: oldMap, round: 2 });
      m.store.set(modalState, newNotice);
      await act(async () => {
        await stale();
      });
      assert.equal(requests, 0);
      assert.deepEqual(m.store.get(modalState), newNotice);
      assert.equal(m.current.isConfirming, false);
    } finally {
      m.close();
    }
  });
}

test('a pending confirmation cannot redirect a newer vote round', async () => {
  const gate = deferred();
  const requests: string[] = [];
  const m = await mount(
    voteHook,
    firstRound,
    async config => {
      requests.push(config.url ?? '');
      if (config.url?.endsWith('location_station_confirm')) await gate.promise;
      return {
        data: station,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
    true,
  );
  try {
    act(() => m.current.requestConfirm());
    const confirm = m.confirm();
    let task!: Promise<void>;
    act(() => {
      task = Promise.resolve(confirm());
    });
    await until(() => requests.length === 1);
    await m.update({ mapId: oldMap, round: 2 });
    m.store.set(resultConfirmState, {
      ...station,
      share_key: 'new-confirmation',
    });
    m.store.set(modalState, newNotice);
    gate.resolve();
    await act(async () => {
      await task;
    });
    assert.deepEqual(m.navigation, []);
    assert.equal(m.store.get(resultConfirmState).share_key, 'new-confirmation');
    assert.deepEqual(m.store.get(modalState), newNotice);
    assert.equal(m.current.isConfirming, false);
    assert.equal(requests.length, 1);
  } finally {
    gate.resolve();
    m.close();
  }
});

test('current-round vote and confirmation still allow retry and navigate successfully', async () => {
  let voteAttempts = 0,
    confirmationAttempts = 0;
  const m = await mount(voteHook, firstRound, async config => {
    if (config.url?.endsWith('location_points_vote') && ++voteAttempts === 1)
      throw new Error('Vote unavailable');
    if (
      config.url?.endsWith('location_station_confirm') &&
      ++confirmationAttempts === 1
    )
      throw new Error('Confirmation unavailable');
    return {
      data: station,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      act(() => m.current.requestVote());
      const confirm = m.confirm();
      await act(async () => {
        await confirm();
      });
      assert.equal(m.current.isVote, attempt === 1);
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      act(() => m.current.requestConfirm());
      const confirm = m.confirm();
      await act(async () => {
        await confirm();
      });
      assert.equal(m.current.isConfirming, false);
    }
    assert.equal(voteAttempts, 2);
    assert.equal(confirmationAttempts, 2);
    assert.deepEqual(m.navigation, [`/result/confirm?sharekey=${shareKey}`]);
    assert.equal(m.store.get(resultConfirmState).share_key, shareKey);
  } finally {
    m.close();
  }
});
