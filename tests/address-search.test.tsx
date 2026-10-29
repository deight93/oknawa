import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import useKakaoPlaceService from '../src/hooks/common/useKakaoPlaceService';
import Address from '../src/components/Address';
import { Provider, createStore } from 'jotai';
import BaseHead from '../src/app/head';
import MeetingMap from '../src/components/MeetingMap';
import type {
  KakaoPlace,
  KakaoPlacesSearchStatus,
} from '../src/components/Address/types';

type SearchCallback = (
  places: KakaoPlace[],
  status: KakaoPlacesSearchStatus,
) => void;
let requests: Array<{ query: string; callback: SearchCallback }>;
let ready: () => void;
let tree: ReactTestRenderer | undefined;
let current: ReturnType<typeof useKakaoPlaceService>;
const original = Object.getOwnPropertyDescriptor(globalThis, 'kakao');
const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);
const originalReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
const mapsScript = () => BaseHead().props.children[0];

function Probe({ query }: { query: string }) {
  current = useKakaoPlaceService(query);
  return null;
}

const place = (name: string): KakaoPlace => ({
  id: name,
  place_name: name,
  address_name: '서울',
  x: '127',
  y: '37.5',
});
const flushSearch = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 120));
  });

beforeEach(() => {
  requests = [];
  Object.defineProperty(globalThis, 'React', {
    configurable: true,
    value: React,
  });
  Object.defineProperty(globalThis, 'kakao', {
    configurable: true,
    value: {
      maps: {
        load: (callback: () => void) => {
          ready = callback;
        },
        services: {
          Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' },
          Places: class {
            keywordSearch(query: string, callback: SearchCallback) {
              requests.push({ query, callback });
            }
          },
        },
      },
    },
  });
  mapsScript().props.onLoad?.();
});

afterEach(async () => {
  if (tree) act(() => tree?.unmount());
  tree = undefined;
  mapsScript().props.onError?.();
  await Promise.resolve();
  if (original) Object.defineProperty(globalThis, 'kakao', original);
  else Reflect.deleteProperty(globalThis, 'kakao');
  if (originalStorage)
    Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
  if (originalReact) Object.defineProperty(globalThis, 'React', originalReact);
  else Reflect.deleteProperty(globalThis, 'React');
});

test('opening address search before the SDK global exists waits and searches after script load', async () => {
  const sdk = Object.getOwnPropertyDescriptor(globalThis, 'kakao');
  Reflect.deleteProperty(globalThis, 'kakao');
  assert.doesNotThrow(() =>
    act(() => {
      tree = create(<Probe query="강남" />);
    }),
  );
  assert.equal(current.status, 'loading');
  assert.ok(sdk);
  Object.defineProperty(globalThis, 'kakao', sdk);
  await act(async () => {
    mapsScript().props.onLoad?.();
    ready();
  });
  await flushSearch();
  assert.equal(requests[0]?.query, '강남');
});

test('SDK script failure is shown even when the failure occurred before search mounted', async () => {
  Reflect.deleteProperty(globalThis, 'kakao');
  mapsScript().props.onError?.();
  await act(async () => {
    tree = create(<Probe query="강남" />);
  });
  assert.equal(current.status, 'sdk-error');
  assert.equal(requests.length, 0);
});

test('a hung SDK initialization stops loading and a later query can recover', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await act(async () => {
    tree = create(<Probe query="강남" />);
  });
  await act(async () => {
    t.mock.timers.tick(10_001);
  });
  assert.equal(current.status, 'sdk-error');
  await act(async () => {
    tree?.update(<Probe query="사당" />);
  });
  await act(async () => {
    ready();
  });
  await act(async () => {
    t.mock.timers.tick(101);
  });
  assert.equal(requests[0]?.query, '사당');
  act(() => requests[0].callback([place('사당역')], 'OK'));
  assert.equal(current.status, 'success');
});

test('address and map share one SDK initialization and tolerate unmount before it finishes', async () => {
  let loadCalls = 0;
  kakao.maps.load = callback => {
    loadCalls++;
    ready = callback;
  };
  await act(async () => {
    tree = create(
      <>
        <MeetingMap stationName="강남역" endX={null} endY={null} />
        <Probe query="강남" />
      </>,
    );
  });
  assert.equal(loadCalls, 1);
  act(() => tree?.unmount());
  tree = undefined;
  await act(async () => ready());
  await flushSearch();
  assert.equal(requests.length, 0);
});

test('an SDK callback without its services library shows an error instead of crashing', async () => {
  await act(async () => {
    tree = create(<Probe query="강남" />);
  });
  Reflect.deleteProperty(kakao.maps.services, 'Places');
  await act(async () => ready());
  assert.equal(current.status, 'sdk-error');
});

for (const scenario of [
  { name: 'malformed saved history', stored: '{}', writeFails: false },
  { name: 'storage write failure', stored: '[]', writeFails: true },
]) {
  test(`address selection still completes with ${scenario.name}`, async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => scenario.stored,
        setItem: () => {
          if (scenario.writeFails) throw new Error('Storage unavailable');
        },
        removeItem: () => {},
      },
    });
    let selected: unknown;
    const setValue: React.ComponentProps<typeof Address>['setValue'] = (
      _field,
      value,
    ) => {
      selected = value;
    };
    act(() => {
      tree = create(
        <Provider store={createStore()}>
          <Address setValue={setValue} />
        </Provider>,
      );
    });
    await act(async () => ready());
    act(() =>
      tree?.root
        .findByType('input')
        .props.onChange({ target: { value: '강남' } }),
    );
    await flushSearch();
    act(() => requests[0].callback([place('강남역')], 'OK'));
    const result = tree?.root
      .findAllByType('button')
      .find(button =>
        button
          .findAllByType('span')
          .some(span => span.children.includes('강남역')),
      );
    assert.ok(result);
    assert.doesNotThrow(() => act(() => result.props.onClick()));
    assert.deepEqual(selected, {
      fullAddress: '서울',
      regionName: '강남역',
      latitude: 37.5,
      longitude: 127,
    });
  });
}

test('address search waits for the SDK and distinguishes initial, loading and empty states', async () => {
  act(() => {
    tree = create(<Probe query="" />);
  });
  assert.equal(current.status, 'idle');
  act(() => tree?.update(<Probe query="  강남  " />));
  assert.equal(current.status, 'loading');
  await act(async () => ready());
  await flushSearch();
  assert.equal(requests[0].query, '강남');
  act(() => requests[0].callback([], 'ZERO_RESULT'));
  assert.equal(current.status, 'empty');
});

test('new address queries ignore older responses and clearing cancels pending results', async () => {
  act(() => {
    tree = create(<Probe query="강남" />);
  });
  await act(async () => ready());
  await flushSearch();
  act(() => tree?.update(<Probe query="사당" />));
  await flushSearch();
  act(() => requests[1].callback([place('사당역')], 'OK'));
  act(() => requests[0].callback([place('강남역')], 'OK'));
  assert.deepEqual(
    current.places.map(item => item.place_name),
    ['사당역'],
  );
  act(() => tree?.update(<Probe query="" />));
  act(() => requests[1].callback([place('사당역')], 'OK'));
  assert.equal(current.status, 'idle');
  assert.deepEqual(current.places, []);
});

test('rapid typing sends only the final query and clearing before debounce sends none', async () => {
  act(() => {
    tree = create(<Probe query="강" />);
  });
  await act(async () => ready());
  act(() => tree?.update(<Probe query="강남" />));
  await flushSearch();
  assert.deepEqual(
    requests.map(item => item.query),
    ['강남'],
  );
  act(() => tree?.update(<Probe query="홍대" />));
  act(() => tree?.update(<Probe query=" " />));
  await flushSearch();
  assert.equal(requests.length, 1);
  assert.equal(current.status, 'idle');
});

test('a failed search exposes an inline error and a subsequent query can succeed', async () => {
  act(() => {
    tree = create(<Probe query="강남" />);
  });
  await act(async () => ready());
  await flushSearch();
  act(() => requests[0].callback([], 'ERROR'));
  assert.equal(current.status, 'error');
  act(() => tree?.update(<Probe query="사당" />));
  await flushSearch();
  act(() => requests[1].callback([place('사당역')], 'OK'));
  assert.equal(current.status, 'success');
  assert.equal(current.places[0].place_name, '사당역');
});
