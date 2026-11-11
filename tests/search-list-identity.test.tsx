import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Provider, createStore } from 'jotai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { searchState, type SearchState } from '../src/jotai/global/store';
import SearchCompleteList from '../src/views/search/SearchCompleteList';
import PeopleCard from '../src/views/search/components/PeopleCard';

const globals = {
  React,
  Image: class {
    src = '';
  },
  HTMLElement: class {},
  SVGElement: class {},
};
const previous = Object.keys(globals).map(key =>
  Object.getOwnPropertyDescriptor(globalThis, key),
);
before(() => {
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
});
after(() => {
  Object.keys(globals).forEach((key, index) => {
    const descriptor = previous[index];
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  });
});

const people: SearchState[] = [0, 1, 2].map(index => ({
  name: '민수',
  travelMode: index === 0 ? 'transit' : index === 1 ? 'car' : 'walk',
  address: {
    fullAddress: '서울 강남구 역삼동',
    regionName: '강남역',
    latitude: 37.5,
    longitude: 127,
  },
}));

function mountList() {
  const store = createStore();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let renderer!: ReactTestRenderer;
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
            <SearchCompleteList />
          </Provider>
        </QueryClientProvider>
      </AppRouterContext.Provider>,
    );
  });
  act(() => {
    store.set(
      searchState,
      people.map(person => ({ ...person })),
    );
  });
  return {
    store,
    renderer,
    cards: () => renderer.root.findAllByType(PeopleCard),
    close() {
      act(() => renderer.unmount());
      client.clear();
    },
  };
}

test('deleting a duplicate-name departure preserves the surviving native selects and card identity', () => {
  const mounted = mountList();
  try {
    const original = mounted.cards();
    const selects = original.map(card => card.findByType('select'));
    act(() => original[0].props.onDeleteIconClick());
    assert.deepEqual(mounted.store.get(searchState), people.slice(1));
    assert.equal(
      mounted.cards().length,
      2,
      'removed controls must unmount immediately',
    );
    assert.equal(mounted.cards()[0], original[1]);
    assert.equal(mounted.cards()[1], original[2]);
    assert.equal(mounted.cards()[0].findByType('select'), selects[1]);
    assert.equal(mounted.cards()[1].findByType('select'), selects[2]);

    act(() => selects[1].props.onChange({ target: { value: 'transit' } }));
    assert.equal(mounted.cards()[0].findByType('select'), selects[1]);
    assert.deepEqual(mounted.store.get(searchState), [
      { ...people[1], travelMode: 'transit' },
      people[2],
    ]);
  } finally {
    mounted.close();
  }
});

test('retained callbacks target the original participant after preceding rows are removed', () => {
  const mounted = mountList();
  try {
    const [first, second, third] = mounted.cards().map(card => card.props);
    act(() => first.onDeleteIconClick());
    act(() => first.onDeleteIconClick());
    assert.equal(mounted.store.get(searchState).length, 2);
    act(() => second.onTravelModeChange('walk'));
    act(() => third.onDeleteIconClick());
    assert.deepEqual(mounted.store.get(searchState), [
      { ...people[1], travelMode: 'walk' },
    ]);
    act(() => first.onEdit());
    assert.equal(mounted.renderer.root.findAllByType('form').length, 0);
    assert.equal(typeof mounted.cards()[0].props.onEdit, 'function');
  } finally {
    mounted.close();
  }
});

test('editing a duplicate-name departure after deletion keeps its identity and full address', async () => {
  const mounted = mountList();
  try {
    const [first, , third] = mounted.cards();
    const editThird = third.props.onEdit;
    act(() => first.props.onDeleteIconClick());
    act(() => editThird());
    const editor = mounted.renderer.root.findByType('form');
    const name = editor.findByProps({ 'aria-label': '수정할 이름' });
    await act(async () => {
      await name.props.onChange({
        target: { name: 'name', value: '수정됨' },
        type: 'change',
      });
    });
    await act(async () =>
      editor.props.onSubmit({ preventDefault() {}, persist() {} }),
    );
    assert.deepEqual(mounted.store.get(searchState), [
      people[1],
      { ...people[2], name: '수정됨' },
    ]);
    assert.equal(mounted.cards()[1], third, 'saving must not remount the row');
    assert.equal(mounted.renderer.root.findAllByType('form').length, 0);
  } finally {
    mounted.close();
  }
});
