import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Provider, createStore } from 'jotai';
import SearchForm from '../src/model/search/SearchForm';
import SearchFormWithTogether from '../src/model/search-together/SearchFormWithTogether';
import SearchService from '../src/services/search/SearchService';
import useSearchForm from '../src/hooks/form/search/useSearchForm';
import useResultSummary from '../src/hooks/result/useResultSummary';
import { resultState } from '../src/jotai/result/store';
import { api } from '../src/api/client';
import type { SearchState } from '../src/jotai/global/store';
import type { StationInfo } from '../src/types/location';
import { getRouteStatText } from '../src/utils/recommendationDisplay';
import PeopleCard from '../src/views/search/components/PeopleCard';
import SearchCompleteListWithTogetherView from '../src/views/search/SearchCompleteListWithTogether';
import { roomState } from '../src/jotai/global/room';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

const previousStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'sessionStorage',
);
const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
before(() => {
  Object.defineProperty(globalThis, 'React', {
    configurable: true,
    value: React,
  });
  const memory = new Map<string, string>();
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
});
after(() => {
  if (previousStorage)
    Object.defineProperty(globalThis, 'sessionStorage', previousStorage);
  else Reflect.deleteProperty(globalThis, 'sessionStorage');
  if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
  else Reflect.deleteProperty(globalThis, 'React');
});

const address = {
  fullAddress: '서울특별시 강남구',
  regionName: '강남역',
  latitude: 37.5,
  longitude: 127,
};

test('the existing departure card lets the user change only that person’s travel mode', () => {
  let selected = 'transit',
    renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <PeopleCard
        name="A"
        place="강남역"
        travelMode="transit"
        onTravelModeChange={mode => {
          selected = mode;
        }}
      />,
    );
  });
  try {
    const control = renderer.root.findByType('select');
    act(() => control.props.onChange({ target: { value: 'car' } }));
    assert.equal(selected, 'car');
  } finally {
    act(() => renderer.unmount());
  }
});

test('individual payloads keep explicit modes and legacy group fallback', () => {
  const body = SearchForm.convertToRequestBody(
    [
      { name: 'A', address, travelMode: 'walk' },
      { name: 'B', address },
    ],
    undefined,
    { travelMode: 'car', midpointBasis: 'time' },
  );
  assert.deepEqual(
    body.participant.map(p => Reflect.get(p, 'travel_mode')),
    ['walk', 'car'],
  );
  assert.equal(
    SearchFormWithTogether.convertToRequestBody({
      name: 'A',
      address,
      travelMode: 'transit',
    }).travel_mode,
    'transit',
  );
});

test('the actual departure form retains the selected mode during validation and resets for the next person', async () => {
  let form!: ReturnType<typeof useSearchForm>, renderer!: ReactTestRenderer;
  function Probe() {
    form = useSearchForm();
    return null;
  }
  await act(async () => {
    renderer = create(<Probe />);
  });
  let submitted: SearchState | undefined;
  try {
    await act(async () => {
      form.setValue('name', '참가자');
      form.setValue('address', address);
      form.setValue('travelMode', 'walk');
      await form.handleSubmit(value => {
        submitted = value;
      })();
    });
    assert.equal(submitted?.travelMode, 'walk');
    act(() => form.reset());
    assert.equal(form.getValues('travelMode'), 'transit');
  } finally {
    act(() => renderer.unmount());
  }
});

test('joining a shared room sends the selected mode to the RPC', async () => {
  const original = api.defaults.adapter;
  let sent: Record<string, unknown> = {};
  api.defaults.adapter = async config => {
    sent = JSON.parse(config.data);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    await SearchService.submitDeparturePoint({
      room_id: 'room',
      name: 'A',
      region_name: '강남역',
      full_address: '서울',
      start_x: 127,
      start_y: 37.5,
      travel_mode: 'car',
    });
    assert.equal(sent.p_travel_mode, 'car');
  } finally {
    api.defaults.adapter = original;
  }
});

test('existing result summaries honor the server fairness rank including zero', () => {
  const station = (name: string, time: number, rank: number): StationInfo => ({
    station_name: name,
    address_name: '서울',
    end_x: 127,
    end_y: 37.5,
    share_key: name,
    vote: 0,
    recommend_score: rank,
    itinerary: [
      {
        name: 'A',
        region_name: '출발지',
        itinerary: { totalTime: time, total_polyline: [] },
      },
    ],
    request_info: { participant: [] },
  });
  const store = createStore();
  store.set(resultState, {
    station_info: [
      station('평균 빠른 역', 600, 1),
      station('공평한 역', 1200, 0),
    ],
    request_info: { participant: [] },
  });
  let names: string[] = [],
    renderer!: ReactTestRenderer;
  function Probe() {
    names = useResultSummary('recommended').distanceSummaries.map(
      s => s.station.station_name,
    );
    return null;
  }
  act(() => {
    renderer = create(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );
  });
  try {
    assert.deepEqual(names, ['공평한 역', '평균 빠른 역']);
  } finally {
    act(() => renderer.unmount());
  }
});

test('mixed results show mode-appropriate route text in existing summary rows', () => {
  assert.equal(
    getRouteStatText(
      '20분',
      '0회',
      '0분',
      { travelMode: 'mixed', midpointBasis: 'time' },
      'car',
    ),
    '자동차 20분',
  );
  assert.equal(
    getRouteStatText(
      '15분',
      '0회',
      '15분',
      { travelMode: 'mixed', midpointBasis: 'time' },
      'walk',
    ),
    '도보 15분',
  );
});

test('legacy room cards use the polled group mode while explicit participant modes take precedence', () => {
  const roomId = '11111111-1111-4111-8111-111111111111';
  const previousLocalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  );
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) =>
        key === 'room' ? JSON.stringify({ roomId, hostId: '' }) : null,
      setItem: () => {},
      removeItem: () => {},
    },
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  const store = createStore();
  store.set(roomState, { roomId, hostId: '' });
  client.setQueryData(['inputStatusList', roomId], {
    room_id: roomId,
    recommendation_options: { travelMode: 'car', midpointBasis: 'time' },
    participant: [
      {
        name: '기존 참가자',
        region_name: '강남역',
        start_x: 127,
        start_y: 37.5,
        travel_mode: null,
      },
      {
        name: '도보 참가자',
        region_name: '강남역',
        start_x: 127,
        start_y: 37.5,
        travel_mode: 'walk',
      },
    ],
  });
  let renderer!: ReactTestRenderer;
  try {
    act(() => {
      renderer = create(
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
          <QueryClientProvider client={client}>
            <Provider store={store}>
              <SearchCompleteListWithTogetherView />
            </Provider>
          </QueryClientProvider>
        </AppRouterContext.Provider>,
      );
    });
    assert.deepEqual(
      renderer.root
        .findAllByType(PeopleCard)
        .map(card => card.props.travelMode),
      ['car', 'walk'],
    );
  } finally {
    if (renderer) act(() => renderer.unmount());
    client.clear();
    if (previousLocalStorage)
      Object.defineProperty(globalThis, 'localStorage', previousLocalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
