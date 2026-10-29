import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Provider, createStore } from 'jotai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AxiosAdapter } from 'axios';
import { api, edgeApi } from '../src/api/client';
import useCreateResultFlow from '../src/hooks/search/useCreateResultFlow';
import useConfirmedResult from '../src/hooks/result/useConfirmedResult';
import { resultConfirmState } from '../src/jotai/result-confirm/store';
import { modalState } from '../src/jotai/global/store';
import type { LocationResult, StationInfo } from '../src/types/location';

const mapId = '11111111-1111-4111-8111-111111111111';
const shareKey = '22222222-2222-4222-8222-222222222222';
const nextShareKey = '33333333-3333-4333-8333-333333333333';
const participant = {
  name: 'A',
  region_name: '서울역',
  full_address: '서울',
  start_x: 127,
  start_y: 37,
};
const station: StationInfo = {
  map_id: mapId,
  share_key: shareKey,
  station_name: '서울역',
  address_name: '서울',
  end_x: 127,
  end_y: 37,
  vote: 1,
  itinerary: [
    {
      name: 'A',
      region_name: '서울역',
      itinerary: { totalTime: 1800, total_polyline: [] },
    },
  ],
  request_info: { participant: [participant] },
};
const result: LocationResult = {
  map_id: mapId,
  station_info: [station],
  request_info: station.request_info,
  confirmed: shareKey,
  vote_round: 1,
};
const searchList = [
  {
    name: 'A',
    address: {
      fullAddress: '서울',
      regionName: '서울역',
      longitude: 127,
      latitude: 37,
    },
  },
];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await act(async () => {
      await wait(10);
    });
  }
  assert.fail('Expected the hook to complete its observable state transition');
}

async function mountHook<T>(
  hook: () => T,
  options: {
    confirmed?: StationInfo;
    initialMap?: LocationResult;
    adapter?: AxiosAdapter;
  } = {},
) {
  const originalApi = api.defaults.adapter;
  const originalEdge = edgeApi.defaults.adapter;
  const memory = new Map<string, string>();
  const previousStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'sessionStorage',
  );
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
  const store = createStore();
  if (options.confirmed) store.set(resultConfirmState, options.confirmed);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  if (options.initialMap)
    client.setQueryData(['placeSearchMapId', mapId], options.initialMap);
  const navigation: string[] = [];
  const requests: string[] = [];
  const defaultAdapter: AxiosAdapter = async config => {
    requests.push(config.url ?? '');
    const data = config.url?.endsWith('location-points')
      ? { map_id: mapId, map_host_id: 'creator-only' }
      : config.url?.endsWith('location_station_by_share_key')
        ? station
        : result;
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  api.defaults.adapter = options.adapter ?? defaultAdapter;
  edgeApi.defaults.adapter = options.adapter ?? defaultAdapter;
  let current!: T;
  let renderer!: ReactTestRenderer;
  function Probe() {
    current = hook();
    return null;
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
    get current() {
      return current;
    },
    navigation,
    requests,
    client,
    store,
    close: () => {
      act(() => renderer.unmount());
      client.clear();
      api.defaults.adapter = originalApi;
      edgeApi.defaults.adapter = originalEdge;
      if (previousStorage)
        Object.defineProperty(globalThis, 'sessionStorage', previousStorage);
      else Reflect.deleteProperty(globalThis, 'sessionStorage');
    },
  };
}

test('publication failure shows an error and does not navigate the host away', async () => {
  const mounted = await mountHook(useCreateResultFlow);
  let failed = false;
  try {
    act(() => {
      void mounted.current.requestResult(searchList, undefined, {
        onReady: async () => {
          throw new Error('공유 결과 저장 실패');
        },
        onError: () => {
          failed = true;
        },
      });
    });
    await until(() => failed);
    await act(async () => {
      await wait(10);
    });
    assert.deepEqual(mounted.navigation, []);
    assert.equal(mounted.store.get(modalState).isOpen, true);
    assert.equal(mounted.current.isLoading, false);
  } finally {
    mounted.close();
  }
});

test('preparation and publication keep loading active and reject repeated clicks', async () => {
  const mounted = await mountHook(useCreateResultFlow);
  const prepared = deferred();
  const published = deferred();
  let prepareCalls = 0;
  let publicationStarted = false;
  const options = {
    beforeCreate: () => {
      prepareCalls++;
      return prepared.promise;
    },
    onReady: () => {
      publicationStarted = true;
      return published.promise;
    },
  };
  try {
    act(() => {
      void mounted.current.requestResult(searchList, undefined, options);
      void mounted.current.requestResult(searchList, undefined, options);
    });
    assert.equal(mounted.current.isLoading, true);
    assert.equal(prepareCalls, 1);
    prepared.resolve();
    await until(() => publicationStarted);
    assert.equal(mounted.current.isLoading, true);
    assert.deepEqual(mounted.navigation, []);
    published.resolve();
    await until(() => mounted.navigation.length > 0);
    await act(async () => {
      await mounted.current.requestResult(searchList, undefined, options);
    });
    assert.equal(prepareCalls, 1);
    assert.deepEqual(mounted.navigation, [`/result?mapId=${mapId}`]);
    assert.equal(
      mounted.requests.filter(url => url.endsWith('location-points')).length,
      1,
    );
    assert.equal(mounted.current.isLoading, true);
  } finally {
    prepared.resolve();
    published.resolve();
    mounted.close();
  }
});

test('a completed individual recommendation cannot be generated again before navigation unmounts the page', async () => {
  const mounted = await mountHook(useCreateResultFlow);
  try {
    await act(async () => {
      await mounted.current.requestResult(searchList);
    });
    await act(async () => {
      await mounted.current.requestResult(searchList);
    });
    assert.equal(
      mounted.requests.filter(url => url.endsWith('location-points')).length,
      1,
    );
    assert.deepEqual(mounted.navigation, [`/result?mapId=${mapId}`]);
    assert.equal(mounted.current.isLoading, true);
  } finally {
    mounted.close();
  }
});

for (const failure of ['prepare', 'generate', 'fetch', 'publish'] as const) {
  test(`recommendation ${failure} failure unlocks retry, and a successful retry stays locked`, async () => {
    let failing = true,
      generations = 0,
      errorCalls = 0;
    const mounted = await mountHook(useCreateResultFlow, {
      adapter: async config => {
        const generating = config.url?.endsWith('location-points');
        if (generating) generations++;
        if (
          failing &&
          ((failure === 'generate' && generating) ||
            (failure === 'fetch' && !generating))
        )
          throw new Error('Controlled API failure');
        return {
          data: generating
            ? { map_id: mapId, map_host_id: 'creator-only' }
            : result,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      },
    });
    const options = {
      beforeCreate: () => {
        if (failing && failure === 'prepare')
          throw new Error('Controlled preparation failure');
      },
      onReady: () => {
        if (failing && failure === 'publish')
          throw new Error('Controlled publication failure');
      },
      onError: () => {
        errorCalls++;
      },
    };
    try {
      await act(async () => {
        await mounted.current.requestResult(searchList, undefined, options);
      });
      assert.equal(mounted.current.isLoading, false);
      assert.equal(mounted.store.get(modalState).isOpen, true);
      assert.deepEqual(mounted.navigation, []);
      assert.equal(errorCalls, failure === 'prepare' ? 0 : 1);
      failing = false;
      await act(async () => {
        await mounted.current.requestResult(searchList, undefined, options);
      });
      assert.deepEqual(mounted.navigation, [`/result?mapId=${mapId}`]);
      assert.equal(mounted.current.isLoading, true);
      const afterRetry = generations;
      await act(async () => {
        await mounted.current.requestResult(searchList, undefined, options);
      });
      assert.equal(generations, afterRetry);
    } finally {
      mounted.close();
    }
  });
}

test('failed preparation never marks another running recommendation as failed', async () => {
  const mounted = await mountHook(useCreateResultFlow);
  let failedCalls = 0;
  try {
    act(() => {
      void mounted.current.requestResult(searchList, undefined, {
        beforeCreate: async () => {
          throw new Error('추천 준비 실패');
        },
        onError: () => {
          failedCalls++;
        },
      });
    });
    await until(() => mounted.store.get(modalState).isOpen);
    assert.equal(failedCalls, 0);
    assert.equal(mounted.requests.length, 0);
    assert.deepEqual(mounted.navigation, []);
  } finally {
    mounted.close();
  }
});

test('a confirmed page follows a reset performed by another participant', async () => {
  const mounted = await mountHook(() => useConfirmedResult(shareKey), {
    confirmed: station,
  });
  try {
    await until(() => mounted.current.hasResult);
    await act(async () => {
      mounted.client.setQueryData(['placeSearchMapId', mapId], {
        ...result,
        confirmed: null,
        vote_round: 2,
      });
    });
    await until(() => mounted.navigation.length > 0);
    assert.equal(mounted.navigation.at(-1), `/result?mapId=${mapId}`);
    assert.equal(mounted.current.hasResult, false);
  } finally {
    mounted.close();
  }
});

test('a confirmed page follows a changed confirmed candidate', async () => {
  const mounted = await mountHook(() => useConfirmedResult(shareKey), {
    confirmed: station,
  });
  try {
    await until(() => mounted.current.hasResult);
    await act(async () => {
      mounted.client.setQueryData(['placeSearchMapId', mapId], {
        ...result,
        confirmed: nextShareKey,
      });
    });
    await until(() => mounted.navigation.length > 0);
    assert.equal(
      mounted.navigation.at(-1),
      `/result/confirm?sharekey=${nextShareKey}`,
    );
    assert.equal(mounted.current.hasResult, false);
  } finally {
    mounted.close();
  }
});

test('reopening a stored confirmation still checks the live map status', async () => {
  const requestedMaps: string[] = [];
  const adapter: AxiosAdapter = async config => {
    const isMap = config.url?.endsWith('location_result_by_map_id');
    if (isMap) requestedMaps.push(JSON.parse(config.data).p_map_id);
    return {
      data: isMap ? { ...result, confirmed: null } : station,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  const mounted = await mountHook(() => useConfirmedResult(shareKey), {
    confirmed: station,
    adapter,
  });
  try {
    await until(() => mounted.navigation.length > 0);
    assert.deepEqual(requestedMaps, [mapId]);
    assert.equal(mounted.navigation.at(-1), `/result?mapId=${mapId}`);
  } finally {
    mounted.close();
  }
});

test('a cached pre-confirmation result waits for a fresh read without redirecting', async () => {
  const freshRead = deferred();
  let mapRequested = false;
  const adapter: AxiosAdapter = async config => {
    const isMap = config.url?.endsWith('location_result_by_map_id');
    if (isMap) {
      mapRequested = true;
      await freshRead.promise;
    }
    return {
      data: isMap ? result : station,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  const mounted = await mountHook(() => useConfirmedResult(shareKey), {
    initialMap: { ...result, confirmed: null },
    adapter,
  });
  try {
    await until(() => mapRequested);
    assert.equal(mounted.current.isLoading, true);
    assert.equal(mounted.current.hasResult, false);
    assert.deepEqual(mounted.navigation, []);
    freshRead.resolve();
    await until(() => mounted.current.hasResult);
    assert.deepEqual(mounted.navigation, []);
  } finally {
    freshRead.resolve();
    mounted.close();
  }
});
