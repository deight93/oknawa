import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosAdapter } from 'axios';
import { api } from '../src/api/client';
import type { HotPlace } from '../src/services/hot-place/types';

const originalAdapter = api.defaults.adapter;
const originalReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
let tree: ReactTestRenderer;
let client: QueryClient;
let HotPlaceModal: typeof import('../src/components/HotPlaceModal').default;
let PlaceItem: typeof import('../src/components/HotPlaceModal/PlaceItem').default;

const place = (name: string, category = '음식점'): HotPlace => ({
  id: name,
  place_name: name,
  category_group_name: category,
  category_group_code: category === '카페' ? 'CE7' : 'FD6',
  category_name: category,
  road_address_name: '',
  address_name: '서울 동작구 사당동 100',
  distance: '120',
  phone: '',
  place_url: 'https://place.map.kakao.com/123',
  main_photo_url: '',
  x: '126.9816',
  y: '37.4765',
});
const response = (documents: HotPlace[]) => ({
  documents,
  meta: {
    is_end: true,
    total_count: documents.length,
    pageable_count: documents.length,
  },
});
const visibleText = () => JSON.stringify(tree.toJSON());

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (predicate()) return;
    await act(async () => {
      await wait(10);
    });
  }
  assert.fail('The nearby list did not reach its expected visible state');
}

async function mount(adapter: AxiosAdapter) {
  api.defaults.adapter = adapter;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={client}>
        <HotPlaceModal x={126.9816} y={37.4765} />
      </QueryClientProvider>,
    );
  });
}

beforeEach(async () => {
  Object.defineProperty(globalThis, 'React', {
    configurable: true,
    value: React,
  });
  HotPlaceModal = (await import('../src/components/HotPlaceModal')).default;
  PlaceItem = (await import('../src/components/HotPlaceModal/PlaceItem'))
    .default;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

afterEach(() => {
  if (tree) act(() => tree.unmount());
  client.clear();
  api.defaults.adapter = originalAdapter;
  if (originalReact) Object.defineProperty(globalThis, 'React', originalReact);
  else Reflect.deleteProperty(globalThis, 'React');
});

test('nearby places distinguish loading from a completed empty result', async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => {
    finish = resolve;
  });
  await mount(async config => {
    await pending;
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: response([]),
    };
  });
  assert.match(visibleText(), /찾고 있어요/);
  assert.doesNotMatch(visibleText(), /찾지 못했어요/);
  await act(async () => finish());
  await until(() => visibleText().includes('찾지 못했어요'));
  assert.doesNotMatch(visibleText(), /찾고 있어요/);
});

test('switching a nearby category hides stale places until the selected results arrive', async () => {
  let finishCafe!: () => void;
  const pendingCafe = new Promise<void>(resolve => {
    finishCafe = resolve;
  });
  await mount(async config => {
    const cafe = config.url?.endsWith('/cafe');
    if (cafe) await pendingCafe;
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: response([
        cafe ? place('느린 오후 카페', '카페') : place('모퉁이 식탁'),
      ]),
    };
  });
  await until(() => visibleText().includes('모퉁이 식탁'));
  const cafeButton = tree.root
    .findAllByType('button')
    .find(button => button.children.includes('카페'));
  assert.ok(
    cafeButton,
    'category selection must be a native keyboard-operable button',
  );
  await act(async () => cafeButton.props.onClick());
  assert.equal(cafeButton.props['aria-pressed'], true);
  assert.doesNotMatch(visibleText(), /모퉁이 식탁/);
  assert.match(visibleText(), /찾고 있어요/);
  await act(async () => finishCafe());
  await until(() => visibleText().includes('느린 오후 카페'));
  assert.doesNotMatch(visibleText(), /모퉁이 식탁/);
  const link = tree.root.findByType('a');
  assert.equal(link.props.href, 'https://place.map.kakao.com/123');
  assert.equal(link.props.target, '_blank');
});

test('a failed nearby search can be retried from the list without changing category', async () => {
  let attempts = 0;
  await mount(async config => {
    if (++attempts === 1) throw new Error('offline');
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: response([place('다시 찾은 식당')]),
    };
  });
  await until(() => visibleText().includes('불러오지 못했어요'));
  const retry = tree.root
    .findAllByType('button')
    .find(button => button.children.includes('다시 시도'));
  assert.ok(retry);
  await act(async () => {
    await retry.props.onClick();
  });
  await until(() => visibleText().includes('다시 찾은 식당'));
  assert.doesNotMatch(visibleText(), /불러오지 못했어요/);
});

test('a place without a road address or business hours still has a usable address and link', () => {
  act(() => {
    tree = create(<PlaceItem place={place('이름이 긴 모임 장소')} />);
  });
  assert.match(visibleText(), /서울 동작구 사당동 100/);
  assert.match(visibleText(), /영업시간 미기재/);
  assert.equal(
    tree.root.findByType('a').props.href,
    'https://place.map.kakao.com/123',
  );
});
