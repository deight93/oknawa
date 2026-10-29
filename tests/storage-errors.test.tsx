import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Provider, createStore, useAtomValue } from 'jotai';
import { RESET, atomWithStorage } from 'jotai/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { api } from '../src/api/client';
import useVoteFlow from '../src/hooks/result/useVoteFlow';
import useResultPageState from '../src/hooks/result/useResultPageState';
import useSearchEntryFlow from '../src/hooks/search/useSearchEntryFlow';
import useCreateResultFlow from '../src/hooks/search/useCreateResultFlow';
import { modalState, searchState } from '../src/jotai/global/store';
import { resultState } from '../src/jotai/result/store';
import { resultConfirmState } from '../src/jotai/result-confirm/store';
import { mapIdState } from '../src/jotai/mapId/store';
import { roomState } from '../src/jotai/global/room';
import {
  clearLegacyVoteState,
  clearVoteStateForMap,
  clearVotedForMap,
} from '../src/utils/voteStorage';
import { createSafeJSONStorage } from '../src/utils/browserStorage';

async function until(check: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await act(async () => {
      await wait(10);
    });
  }
  assert.fail('Expected storage-related flow to settle');
}

async function mountStorage<T>(
  hook: (mapId: string) => T,
  failure: 'getter' | 'write' | 'read' | 'remove' | 'silent-write',
  token?: string,
) {
  const mapId = randomUUID();
  const memory = new Map<string, string>();
  if (token) memory.set('oknawa:voterToken', token);
  let blocked = false;
  const fail = () => {
    throw new Error('Storage blocked');
  };
  const storage = {
    getItem: (key: string) =>
      blocked && failure === 'read' ? fail() : (memory.get(key) ?? null),
    setItem: (key: string, value: string) => {
      if (blocked && failure === 'write') fail();
      if (blocked && failure === 'silent-write') return;
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      if (blocked && failure === 'remove') fail();
      memory.delete(key);
    },
  };
  const globals = ['window', 'localStorage', 'sessionStorage'];
  const previous = globals.map(key =>
    Object.getOwnPropertyDescriptor(globalThis, key),
  );
  const getStorage = () => (blocked && failure === 'getter' ? fail() : storage);
  for (const key of ['localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: getStorage,
    });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      get localStorage() {
        return getStorage();
      },
      get sessionStorage() {
        return getStorage();
      },
      setTimeout,
      clearTimeout,
    },
  });
  const store = createStore();
  // Clear prior fallback caches under a working storage boundary.
  store.set(mapIdState, RESET);
  store.set(resultState, RESET);
  store.set(resultConfirmState, RESET);
  store.set(searchState, RESET);
  store.set(roomState, { roomId: '', hostId: '' });
  blocked = true;
  const previousAdapter = api.defaults.adapter;
  const votes: Array<Record<string, unknown>> = [];
  const requests: string[] = [];
  const result = {
    map_id: mapId,
    station_info: [],
    request_info: { participant: [] },
    vote_round: 1,
  };
  api.defaults.adapter = async config => {
    requests.push(config.url ?? '');
    if (config.url?.endsWith('location_points_vote'))
      votes.push(JSON.parse(config.data));
    return {
      data: config.url?.endsWith('location_points_vote')
        ? { already_voted: false }
        : result,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  let current!: T, tree!: ReactTestRenderer;
  function Probe() {
    current = hook(mapId);
    return null;
  }
  const close = () => {
    if (tree) act(() => tree.unmount());
    client.clear();
    api.defaults.adapter = previousAdapter;
    globals.forEach((key, i) => {
      const old = previous[i];
      if (old) Object.defineProperty(globalThis, key, old);
      else Reflect.deleteProperty(globalThis, key);
    });
  };
  try {
    await act(async () => {
      tree = create(
        <AppRouterContext.Provider
          value={{
            back() {},
            forward() {},
            refresh() {},
            push() {},
            replace() {},
            prefetch: async () => {},
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
  } catch (error) {
    close();
    throw error;
  }
  return {
    get current() {
      return current;
    },
    store,
    votes,
    requests,
    memory,
    result,
    mapId,
    close,
    unblock: () => {
      blocked = false;
    },
  };
}

const person = {
  name: '친구',
  address: {
    fullAddress: '서울',
    regionName: '강남역',
    latitude: 37.5,
    longitude: 127,
  },
};

for (const shareRoomId of [null, 'existing-room']) {
  test(`storage failure prevents ${shareRoomId ? 'joining' : 'creating'} a room and releases the submission for retry`, async () => {
    const mounted = await mountStorage(
      () => useSearchEntryFlow('together', shareRoomId, () => {}),
      'write',
    );
    try {
      await act(async () => {
        mounted.current.submitSearch(person);
      });
      assert.equal(mounted.requests.length, 0);
      assert.equal(mounted.current.isSubmitting, false);
      assert.match(mounted.store.get(modalState).contents, /저장소/);
      mounted.unblock();
      await act(async () => {
        mounted.current.submitSearch(person);
      });
      await until(() => mounted.requests.length === 1);
    } finally {
      mounted.close();
    }
  });
}

test('storage failure stops recommendation before preparing a room and permits retry', async () => {
  const mounted = await mountStorage(useCreateResultFlow, 'write');
  let prepareCalls = 0,
    failureCalls = 0;
  const options = {
    beforeCreate: () => {
      prepareCalls++;
      throw new Error('Stop before the external recommendation service');
    },
    onError: () => {
      failureCalls++;
    },
  };
  try {
    await act(async () => {
      await mounted.current.requestResult([person], undefined, options);
    });
    assert.equal(prepareCalls, 0);
    assert.equal(failureCalls, 0);
    assert.equal(mounted.current.isLoading, false);
    assert.match(mounted.store.get(modalState).contents, /저장소/);
    mounted.unblock();
    await act(async () => {
      await mounted.current.requestResult([person], undefined, options);
    });
    assert.equal(prepareCalls, 1);
    assert.equal(failureCalls, 0);
  } finally {
    mounted.close();
  }
});

for (const failure of ['getter', 'read', 'write'] as const) {
  test(`result reading survives a storage ${failure} failure`, async () => {
    const mounted = await mountStorage(id => useResultPageState(id), failure);
    try {
      await until(() => !mounted.current.isLoading);
      assert.equal(mounted.current.activeMapId, mounted.mapId);
      assert.deepEqual(mounted.store.get(resultState), mounted.result);
    } finally {
      mounted.close();
    }
  });
}

for (const failure of ['getter', 'read', 'write', 'silent-write'] as const) {
  test(`voting with no durable identity explains storage ${failure} failure and sends no vote`, async () => {
    const mounted = await mountStorage(
      id => useVoteFlow('candidate', id),
      failure,
    );
    try {
      act(() => mounted.current.requestVote());
      const confirm: unknown = Reflect.get(
        mounted.store.get(modalState),
        'onConfirm',
      );
      assert.equal(typeof confirm, 'function');
      if (typeof confirm === 'function')
        await act(async () => {
          await confirm();
        });
      assert.equal(mounted.votes.length, 0);
      assert.equal(mounted.current.isVote, false);
      assert.match(mounted.store.get(modalState).contents, /저장소/);
    } finally {
      mounted.close();
    }
  });
}

test('a successful vote stays successful when only its optional marker cannot be written', async () => {
  const mounted = await mountStorage(
    id => useVoteFlow('candidate', id),
    'write',
    'persisted-voter',
  );
  try {
    act(() => mounted.current.requestVote());
    const confirm: unknown = Reflect.get(
      mounted.store.get(modalState),
      'onConfirm',
    );
    if (typeof confirm === 'function')
      await act(async () => {
        await confirm();
      });
    assert.equal(mounted.votes.length, 1);
    assert.equal(mounted.votes[0].voter_token, 'persisted-voter');
    assert.equal(mounted.current.isVote, true);
    assert.equal(mounted.store.get(modalState).isOpen, false);
    act(() => mounted.current.requestVote());
    assert.equal(mounted.store.get(modalState).isOpen, false);
  } finally {
    mounted.close();
  }
});

test('failed cache writes and deletes survive remounts while storage events still update the atom', () => {
  let blocked = false,
    getterBlocked = false;
  class BrowserStorage implements Storage {
    private values = new Map<string, string>();
    get length() {
      return this.values.size;
    }
    key(index: number) {
      return Array.from(this.values.keys())[index] ?? null;
    }
    getItem(key: string) {
      return this.values.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      if (blocked) throw new Error('Quota exceeded');
      this.values.set(key, value);
    }
    removeItem(key: string) {
      if (blocked) throw new Error('Storage blocked');
      this.values.delete(key);
    }
    clear() {
      this.values.clear();
    }
  }
  const browserStorage = new BrowserStorage();
  const events = new EventTarget();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      Storage: BrowserStorage,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    },
  });
  let unsubscribe = () => {};
  try {
    const storage = createSafeJSONStorage<string>(() => {
      if (getterBlocked) throw new Error('Storage blocked');
      return browserStorage;
    });
    browserStorage.setItem('cache', JSON.stringify('old'));
    const atom = atomWithStorage('cache', 'empty', storage);
    const store = createStore();
    unsubscribe = store.sub(atom, () => {});
    assert.equal(store.get(atom), 'old');
    blocked = true;
    store.set(atom, 'new');
    unsubscribe();
    unsubscribe = store.sub(atom, () => {});
    assert.equal(store.get(atom), 'new');
    store.set(atom, RESET);
    unsubscribe();
    unsubscribe = store.sub(atom, () => {});
    assert.equal(store.get(atom), 'empty');
    const storageEvent = () =>
      Object.assign(new Event('storage'), {
        key: 'cache',
        newValue: JSON.stringify('other tab'),
        storageArea: browserStorage,
      });
    getterBlocked = true;
    assert.doesNotThrow(() => events.dispatchEvent(storageEvent()));
    getterBlocked = blocked = false;
    browserStorage.setItem('cache', JSON.stringify('other tab'));
    events.dispatchEvent(storageEvent());
    assert.equal(store.get(atom), 'other tab');
    unsubscribe();
    unsubscribe = store.sub(atom, () => {});
    assert.equal(store.get(atom), 'other tab');
  } finally {
    unsubscribe();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('server execution does not retain values from another request in a shared storage adapter', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'window');
  try {
    const storage = createSafeJSONStorage<string>(() => {
      throw new Error('No browser storage');
    });
    const atom = atomWithStorage('cache', 'empty', storage);
    const first = createStore();
    first.set(atom, 'private request data');
    assert.equal(storage.getItem('cache', 'empty'), 'empty');
    const next = createStore();
    const unsubscribe = next.sub(atom, () => {});
    try {
      assert.equal(next.get(atom), 'empty');
    } finally {
      unsubscribe();
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
  }
});

test('failed cleanup cannot throw through result navigation or reset', async () => {
  const mounted = await mountStorage(() => null, 'remove');
  try {
    assert.doesNotThrow(() => {
      clearLegacyVoteState();
      clearVotedForMap(mounted.mapId);
      clearVoteStateForMap(mounted.mapId);
    });
  } finally {
    mounted.close();
  }
});

test('departure and host state remain usable in the current tab when persistence fails', async () => {
  const mounted = await mountStorage(
    () => ({
      departures: useAtomValue(searchState),
      room: useAtomValue(roomState),
    }),
    'write',
  );
  const person = {
    name: '친구',
    address: {
      fullAddress: '서울',
      regionName: '강남역',
      latitude: 37.5,
      longitude: 127,
    },
  };
  try {
    assert.doesNotThrow(() =>
      act(() => {
        mounted.store.set(searchState, [person]);
        mounted.store.set(roomState, {
          roomId: mounted.mapId,
          hostId: 'existing-capability',
        });
      }),
    );
    assert.deepEqual(mounted.current.departures, [person]);
    assert.equal(mounted.current.room.hostId, 'existing-capability');
  } finally {
    mounted.close();
  }
});
