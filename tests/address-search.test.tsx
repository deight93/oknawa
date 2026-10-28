import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import useKakaoPlaceService from '../src/hooks/common/useKakaoPlaceService';
import Address from '../src/components/Address';
import { Provider, createStore } from 'jotai';
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
});

afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = undefined;
  if (original) Object.defineProperty(globalThis, 'kakao', original);
  else Reflect.deleteProperty(globalThis, 'kakao');
  if (originalStorage)
    Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
  if (originalReact) Object.defineProperty(globalThis, 'React', originalReact);
  else Reflect.deleteProperty(globalThis, 'React');
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
    act(() => ready());
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
  act(() => ready());
  await flushSearch();
  assert.equal(requests[0].query, '강남');
  act(() => requests[0].callback([], 'ZERO_RESULT'));
  assert.equal(current.status, 'empty');
});

test('new address queries ignore older responses and clearing cancels pending results', async () => {
  act(() => {
    tree = create(<Probe query="강남" />);
  });
  act(() => ready());
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
  act(() => ready());
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
  act(() => ready());
  await flushSearch();
  act(() => requests[0].callback([], 'ERROR'));
  assert.equal(current.status, 'error');
  act(() => tree?.update(<Probe query="사당" />));
  await flushSearch();
  act(() => requests[1].callback([place('사당역')], 'OK'));
  assert.equal(current.status, 'success');
  assert.equal(current.places[0].place_name, '사당역');
});
