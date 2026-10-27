import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider, createStore, useAtomValue } from 'jotai';

test('saved departures hydrate after the initial render and retain each travel mode', async () => {
  const people = [
    {
      name: '민수',
      travelMode: 'car',
      address: {
        fullAddress: '서울 강남구',
        regionName: '강남역',
        latitude: 37.5,
        longitude: 127,
      },
    },
  ];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) =>
          key === 'searchList' ? JSON.stringify(people) : null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });
  try {
    // Import in a browser-like environment: server and first client render must
    // both start empty, then the mounted store can load session storage.
    const { searchState } = await import('../src/jotai/global/store');
    const store = createStore();
    assert.deepEqual(store.get(searchState), []);
    let rendered: unknown;
    function Probe() {
      rendered = useAtomValue(searchState);
      return null;
    }
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Provider store={store}>
          <Probe />
        </Provider>,
      );
    });
    try {
      assert.deepEqual(rendered, people);
    } finally {
      act(() => tree.unmount());
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
