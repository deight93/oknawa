import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Provider, createStore } from 'jotai';
import { RESET } from 'jotai/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { AxiosError, type AxiosAdapter } from 'axios';
import { api, edgeApi } from '../src/api/client';
import useSearchEntryFlow from '../src/hooks/search/useSearchEntryFlow';
import useSearchForm from '../src/hooks/form/search/useSearchForm';
import {
  participantEditCapabilityState,
  roomState,
} from '../src/jotai/global/room';
import {
  bottomSheetState,
  modalState,
  searchState,
} from '../src/jotai/global/store';
import SearchCompleteList from '../src/views/search/SearchCompleteList';
import SearchCompleteListWithTogetherView from '../src/views/search/SearchCompleteListWithTogether';
import SearchLoading from '../src/views/search/components/SearchLoading';
import RecommendationOptionSelector from '../src/views/search/components/RecommendationOptionSelector';
import type Address from '../src/components/Address';
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
    id: i + 1,
    name,
    region_name: '강남역',
    full_address: '서울 강남구',
    start_x: 127 + i / 100,
    start_y: 37.5,
    travel_mode: i === 2 ? 'walk' : null,
  }),
);

test('direct input can edit an existing departure without adding or changing other participants', async () => {
  const mounted = await mountRoom({ type: 'individual', individualList: true });
  try {
    act(() =>
      mounted.store.set(searchState, [form, { ...form, name: '친구' }]),
    );
    const edit = mounted.renderer.root
      .findAllByType('button')
      .find(button => button.props['aria-label'] === '방장 출발지 수정');
    assert.ok(edit, 'existing departures need an edit control');
    act(() => edit.props.onClick());
    const editor = mounted.renderer.root.findByType('form');
    const nameInput = editor.findByProps({ 'aria-label': '수정할 이름' });
    act(() =>
      nameInput.props.onChange({
        target: { name: 'name', value: '수정됨' },
        type: 'change',
      }),
    );
    act(() =>
      editor
        .findAllByType('button')
        .find(button => button.props['aria-label'] === '수정할 출발지 검색')!
        .props.onClick(),
    );
    const contents = mounted.store.get(bottomSheetState).contents;
    assert.ok(
      React.isValidElement<{
        setValue: (name: string, value: unknown) => void;
      }>(contents),
    );
    const address = {
      ...form.address,
      fullAddress: '서울 관악구 봉천동 1511-6',
      regionName: '봉천동 1511-6',
      longitude: 126.95,
    };
    act(() => contents.props.setValue('address', address));
    await act(async () =>
      editor.props.onSubmit({ preventDefault() {}, persist() {} }),
    );
    assert.deepEqual(mounted.store.get(searchState), [
      { ...form, name: '수정됨', travelMode: 'transit', address },
      { ...form, name: '친구' },
    ]);
    assert.equal(mounted.renderer.root.findAllByType('form').length, 0);
  } finally {
    mounted.close();
  }
});

test('together editing is visible only for departures owned by this browser, even for the host', async () => {
  const mounted = await mountRoom({
    view: true,
    participantTokens: { [roomId]: { 2: 'friend-edit-token' } },
  });
  try {
    const buttons = mounted.renderer.root.findAllByType('button');
    assert.ok(
      buttons.some(button => button.props['aria-label'] === '친구 출발지 수정'),
    );
    assert.equal(
      buttons.some(button => button.props['aria-label'] === '방장 출발지 수정'),
      false,
    );
  } finally {
    mounted.close();
  }
});

test('storage events update own-only edit controls without granting another room ownership', async () => {
  const mounted = await mountRoom({ view: true });
  const canEditFriend = () =>
    mounted.renderer.root
      .findAllByType('button')
      .some(button => button.props['aria-label'] === '친구 출발지 수정');
  try {
    assert.equal(canEditFriend(), false);
    mounted.externalStorageChange(
      `participantEditCapability:${otherRoomId}:2`,
      JSON.stringify('other-room-token'),
    );
    assert.equal(canEditFriend(), false);
    const key = `participantEditCapability:${roomId}:2`;
    mounted.externalStorageChange(key, JSON.stringify('friend-token'));
    assert.equal(canEditFriend(), true);
    mounted.externalStorageChange(key, null);
    assert.equal(canEditFriend(), false);
    await act(async () => {
      mounted.client.setQueryData(['inputStatusList', otherRoomId], {
        ...mounted.status,
        room_id: otherRoomId,
      });
      mounted.store.set(roomState, { roomId: otherRoomId, hostId: '' });
      await wait(10);
    });
    assert.equal(canEditFriend(), true);
    assert.equal(mounted.store.get(roomState).hostId, '');
    await act(async () => {
      mounted.store.set(roomState, { roomId, hostId: '' });
      await wait(10);
    });
    assert.equal(canEditFriend(), false);
    assert.equal(mounted.store.get(roomState).hostId, hostId);
  } finally {
    mounted.close();
  }
});

test('a together departure update sends its private capability and refreshes the shared list', async () => {
  const sent: Array<{ url?: string; body: Record<string, unknown> }> = [];
  const mounted = await mountRoom({
    view: true,
    participantTokens: { [roomId]: { 2: 'friend-edit-token' } },
    adapter: async config => {
      sent.push({ url: config.url, body: JSON.parse(config.data) });
      return {
        data: config.url?.endsWith('location_room_status')
          ? {
              room_id: roomId,
              recommendation_status: 'idle',
              participant: participants.slice(0, 2),
            }
          : { participant_id: 2 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  });
  try {
    const edit = mounted.renderer.root
      .findAllByType('button')
      .find(button => button.props['aria-label'] === '친구 출발지 수정');
    assert.ok(edit, 'the owner can edit their own departure');
    act(() => edit.props.onClick());
    const editor = mounted.renderer.root.findByType('form');
    await act(async () =>
      editor.props.onSubmit({ preventDefault() {}, persist() {} }),
    );
    const request = sent.find(item =>
      item.url?.endsWith('location_update_participant'),
    );
    assert.deepEqual(request?.body, {
      p_room_id: roomId,
      p_participant_id: 2,
      p_participant_token: 'friend-edit-token',
      p_name: '친구',
      p_region_name: '강남역',
      p_full_address: '서울 강남구',
      p_start_x: 127.01,
      p_start_y: 37.5,
      p_travel_mode: 'transit',
    });
    assert.ok(sent.some(item => item.url?.endsWith('location_room_status')));
  } finally {
    mounted.close();
  }
});

test('registration retains the participant edit capability only in its room', async () => {
  const mounted = await mountRoom({
    shareRoomId: otherRoomId,
    participantTokens: { [roomId]: { 7: 'existing-capability' } },
    adapter: async config => ({
      data: {
        participant_id: 42,
        participant_token: 'private-edit-capability',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }),
  });
  try {
    act(() => mounted.entry.submitSearch(form));
    await until(() => mounted.navigation.length > 0);
    assert.equal(readToken(mounted.memory, roomId, 7), 'existing-capability');
    assert.equal(
      readToken(mounted.memory, otherRoomId, 42),
      'private-edit-capability',
    );
    assert.equal(readToken(mounted.memory, roomId, 42), null);
  } finally {
    mounted.close();
  }
});

for (const secondRoomId of [roomId, otherRoomId]) {
  test(`concurrent registrations retain both tokens in ${secondRoomId === roomId ? 'the same room' : 'different rooms'}`, async () => {
    const memory = new Map<string, string>();
    let release!: () => void;
    let requests = 0;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const adapter: AxiosAdapter = async config => {
      const { p_name } = JSON.parse(config.data);
      requests++;
      await gate;
      return {
        data:
          p_name === 'first'
            ? { participant_id: 1, participant_token: 'first-token' }
            : { participant_id: 2, participant_token: 'second-token' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    const first = await mountRoom({ memory, adapter, shareRoomId: roomId });
    const second = await mountRoom({
      memory,
      adapter,
      shareRoomId: secondRoomId,
    });
    try {
      act(() => {
        first.entry.submitSearch({ ...form, name: 'first' });
        second.entry.submitSearch({ ...form, name: 'second' });
      });
      await until(() => requests === 2);
      await act(async () => {
        release();
        await wait(20);
      });
      // Both tabs started from the same state; storage events have not arrived.
      assert.equal(readToken(memory, roomId, 1), 'first-token');
      assert.equal(readToken(memory, secondRoomId, 2), 'second-token');
      const reloaded = createStore();
      const firstAtom = participantEditCapabilityState(roomId, 1);
      const secondAtom = participantEditCapabilityState(secondRoomId, 2);
      const unmountFirst = reloaded.sub(firstAtom, () => {});
      const unmountSecond = reloaded.sub(secondAtom, () => {});
      try {
        assert.equal(reloaded.get(firstAtom), 'first-token');
        assert.equal(reloaded.get(secondAtom), 'second-token');
      } finally {
        unmountFirst();
        unmountSecond();
      }
    } finally {
      release();
      second.close();
      first.close();
    }
  });
}

test('a registration token remains usable in this tab if storage writes fail after the preflight', async () => {
  let release!: () => void;
  let started = false;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const mounted = await mountRoom({
    shareRoomId: otherRoomId,
    adapter: async config => {
      started = true;
      await gate;
      return {
        data: { participant_id: 9042, participant_token: 'fallback-token' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  });
  const capability = participantEditCapabilityState(otherRoomId, 9042);
  try {
    act(() => mounted.entry.submitSearch(form));
    await until(() => started);
    mounted.blockWrites(true);
    release();
    await until(() => mounted.navigation.length > 0);
    assert.equal(readToken(mounted.memory, otherRoomId, 9042), null);
    assert.equal(mounted.store.get(capability), 'fallback-token');
    const unsubscribe = mounted.store.sub(capability, () => {});
    unsubscribe();
    const remount = mounted.store.sub(capability, () => {});
    try {
      assert.equal(mounted.store.get(capability), 'fallback-token');
    } finally {
      remount();
    }
    assert.equal(mounted.store.get(modalState).isOpen, false);
  } finally {
    release();
    mounted.blockWrites(false);
    mounted.store.set(capability, RESET);
    // Clear existing host/room fallback state while storage is available again.
    mounted.store.set(roomState, { roomId: '', hostId: '' });
    mounted.close();
  }
});

test('cancelling an edit preserves the existing departure', async () => {
  const mounted = await mountRoom({ type: 'individual', individualList: true });
  try {
    act(() =>
      mounted.store.set(searchState, [form, { ...form, name: '친구' }]),
    );
    act(() =>
      mounted.renderer.root
        .findAllByType('button')
        .find(button => button.props['aria-label'] === '방장 출발지 수정')!
        .props.onClick(),
    );
    const editor = mounted.renderer.root.findByType('form');
    act(() =>
      editor.findByProps({ 'aria-label': '수정할 이름' }).props.onChange({
        target: { name: 'name', value: '임시' },
        type: 'change',
      }),
    );
    act(() =>
      editor
        .findAllByType('button')
        .find(button => button.children.includes('취소'))!
        .props.onClick(),
    );
    assert.deepEqual(mounted.store.get(searchState), [
      form,
      { ...form, name: '친구' },
    ]);
    assert.equal(mounted.renderer.root.findAllByType('form').length, 0);
  } finally {
    mounted.close();
  }
});

test('together edits stop being available once recommendation starts', async () => {
  const mounted = await mountRoom({
    view: true,
    participantTokens: { [roomId]: { 2: 'friend-edit-token' } },
  });
  try {
    act(() =>
      mounted.renderer.root
        .findAllByType('button')
        .find(button => button.props['aria-label'] === '친구 출발지 수정')!
        .props.onClick(),
    );
    assert.equal(mounted.renderer.root.findAllByType('form').length, 1);
    await act(async () => {
      mounted.client.setQueryData(['inputStatusList', roomId], {
        ...mounted.status,
        recommendation_status: 'generating',
      });
      await wait(10);
    });
    assert.equal(mounted.renderer.root.findAllByType('form').length, 0);
    assert.equal(
      mounted.renderer.root
        .findAllByType('button')
        .some(button => button.props['aria-label'] === '친구 출발지 수정'),
      false,
    );
  } finally {
    mounted.close();
  }
});

test('a rejected together edit keeps the draft and allows retry without duplicate submissions', async () => {
  let attempts = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const mounted = await mountRoom({
    view: true,
    participantTokens: { [roomId]: { 2: 'friend-edit-token' } },
    adapter: async config => {
      if (config.url?.endsWith('location_update_participant')) {
        attempts++;
        if (attempts === 1) {
          await gate;
          throw new Error('temporary network failure');
        }
      }
      return {
        data: config.url?.endsWith('location_room_status')
          ? {
              room_id: roomId,
              recommendation_status: 'idle',
              participant: participants.slice(0, 2),
            }
          : { participant_id: 2 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  });
  try {
    act(() =>
      mounted.renderer.root
        .findAllByType('button')
        .find(button => button.props['aria-label'] === '친구 출발지 수정')!
        .props.onClick(),
    );
    const editor = mounted.renderer.root.findByType('form');
    let first!: Promise<void>, second!: Promise<void>;
    await act(async () => {
      first = editor.props.onSubmit({ preventDefault() {}, persist() {} });
      second = editor.props.onSubmit({ preventDefault() {}, persist() {} });
      await wait(10);
    });
    assert.equal(attempts, 1);
    assert.equal(editor.findByType('fieldset').props.disabled, true);
    await act(async () => {
      release();
      await Promise.all([first, second]);
    });
    assert.equal(mounted.renderer.root.findAllByType('form').length, 1);
    assert.ok(editor.findAllByProps({ role: 'alert' }).length > 0);
    await act(async () =>
      editor.props.onSubmit({ preventDefault() {}, persist() {} }),
    );
    assert.equal(attempts, 2);
    assert.equal(mounted.renderer.root.findAllByType('form').length, 0);
  } finally {
    release();
    mounted.close();
  }
});

async function until(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await act(async () => {
      await wait(10);
    });
  }
  assert.fail('Room flow did not reach the expected state');
}

function readToken(
  memory: Map<string, string>,
  room: string,
  id: number,
): unknown {
  return JSON.parse(
    memory.get(`participantEditCapability:${room}:${id}`) ?? 'null',
  );
}

async function mountRoom(
  options: {
    shareRoomId?: string;
    view?: boolean;
    adapter?: AxiosAdapter;
    status?: string;
    type?: 'individual' | 'together';
    individualList?: boolean;
    createNewRoom?: boolean;
    destination?: { name: string; address: string; x: number; y: number };
    participantTokens?: Record<string, Record<number, string>>;
    memory?: Map<string, string>;
  } = {},
) {
  const memory =
    options.memory ??
    new Map<string, string>([['room', JSON.stringify({ roomId, hostId })]]);
  for (const [room, tokens] of Object.entries(options.participantTokens ?? {}))
    for (const [id, token] of Object.entries(tokens))
      memory.set(
        `participantEditCapability:${room}:${id}`,
        JSON.stringify(token),
      );
  let failWrites = false;
  class MemoryStorage {
    getItem(key: string) {
      return memory.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      if (failWrites) throw new Error('Storage blocked');
      memory.set(key, value);
    }
    removeItem(key: string) {
      memory.delete(key);
    }
  }
  const storage = new MemoryStorage();
  type StorageChange = {
    key: string;
    newValue: string | null;
    storageArea: MemoryStorage;
  };
  const storageListeners = new Set<(event: StorageChange) => void>();
  const globals = Object.entries({
    localStorage: storage,
    sessionStorage: storage,
    React,
    Image: class {
      src = '';
    },
    HTMLElement: class {},
    SVGElement: class {},
    window: {
      localStorage: storage,
      sessionStorage: storage,
      Storage: MemoryStorage,
      addEventListener: (
        type: string,
        listener: (event: StorageChange) => void,
      ) => {
        if (type === 'storage') storageListeners.add(listener);
      },
      removeEventListener: (
        type: string,
        listener: (event: StorageChange) => void,
      ) => {
        if (type === 'storage') storageListeners.delete(listener);
      },
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
    meeting_destination: options.destination ?? null,
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
    entry = useSearchEntryFlow(
      options.type ?? 'together',
      shareRoomId,
      () => {
        resetCount++;
        searchForm.reset();
      },
      options.destination,
      options.createNewRoom,
    );
    return options.individualList ? (
      <SearchCompleteList />
    ) : options.view ? (
      <SearchCompleteListWithTogetherView />
    ) : null;
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
    blockWrites: (blocked: boolean) => {
      failWrites = blocked;
    },
    externalStorageChange: (key: string, newValue: string | null) => {
      if (newValue === null) memory.delete(key);
      else memory.set(key, newValue);
      act(() => {
        storageListeners.forEach(listener =>
          listener({ key, newValue, storageArea: storage }),
        );
      });
    },
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
            data: {
              room_id: otherRoomId,
              room_host_id: 'late-host',
              participant_id: 42,
              participant_token: 'late-edit-token',
            },
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
        assert.equal(
          readToken(mounted.memory, otherRoomId, 42),
          fails ? null : 'late-edit-token',
        );
        assert.equal(readToken(mounted.memory, mapId, 42), null);
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
      const { p_room_id } = JSON.parse(config.data);
      return {
        data: {
          participant_id: 42,
          participant_token:
            p_room_id === roomId ? 'old-invite-token' : 'new-invite-token',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  });
  try {
    act(() => mounted.entry.submitSearch(form));
    await until(() => releases.length === 1);
    mounted.changeRoom(otherRoomId);
    act(() =>
      mounted.store.set(roomState, { roomId: mapId, hostId: 'active-host' }),
    );
    assert.equal(mounted.entry.isSubmitting, false);
    act(() => mounted.entry.submitSearch({ ...form, name: '새 친구' }));
    await until(() => releases.length === 2);
    await act(async () => {
      releases[0]();
      await wait(20);
    });
    assert.deepEqual(mounted.navigation, []);
    assert.deepEqual(mounted.store.get(roomState), {
      roomId: mapId,
      hostId: 'active-host',
    });
    assert.equal(readToken(mounted.memory, roomId, 42), 'old-invite-token');
    assert.equal(readToken(mounted.memory, otherRoomId, 42), null);
    assert.equal(mounted.entry.isSubmitting, true);
    await act(async () => {
      releases[1]();
      await wait(20);
    });
    assert.deepEqual(mounted.navigation, ['/search/list-together']);
    assert.equal(mounted.store.get(roomState).roomId, otherRoomId);
    assert.equal(mounted.store.get(roomState).hostId, '');
    assert.equal(readToken(mounted.memory, roomId, 42), 'old-invite-token');
    assert.equal(
      readToken(mounted.memory, otherRoomId, 42),
      'new-invite-token',
    );
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
          data: {
            room_id: otherRoomId,
            room_host_id: 'new-creator',
            participant_id: 42,
            participant_token: 'new-edit-token',
          },
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
      assert.equal(
        readToken(mounted.memory, otherRoomId, 42),
        'new-edit-token',
      );
      assert.equal(
        mounted.store.get(roomState).hostId,
        shareRoomId ? '' : 'new-creator',
      );
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

const meetingPlace = {
  name: '코엑스',
  address: '서울 강남구 영동대로 513',
  x: 127.059,
  y: 37.512,
};

test('fixed destination direct entry goes to its list after the first departure and locks duplicates', async () => {
  const mounted = await mountRoom({
    type: 'individual',
    destination: meetingPlace,
  });
  try {
    act(() => {
      mounted.entry.submitSearch(form);
      mounted.entry.submitSearch(form);
    });
    assert.equal(mounted.store.get(searchState).length, 1);
    assert.deepEqual(mounted.navigation, ['/meeting/list']);
    assert.equal(mounted.resetCount, 0);
  } finally {
    mounted.close();
  }
});

test('fixed destination room is created atomically with private participant capability retained', async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const mounted = await mountRoom({
    destination: meetingPlace,
    adapter: async config => {
      requests.push({ url: config.url ?? '', body: JSON.parse(config.data) });
      return {
        data: {
          room_id: otherRoomId,
          room_host_id: 'fixed-host',
          participant_id: 42,
          participant_token: 'fixed-token',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  });
  try {
    act(() => mounted.entry.submitSearch({ ...form, travelMode: 'walk' }));
    await until(() => mounted.navigation.length > 0);
    assert.equal(requests.length, 1);
    assert.ok(requests[0].url.endsWith('location_destination_together'));
    assert.deepEqual(requests[0].body.meeting_destination, meetingPlace);
    assert.equal(requests[0].body.travel_mode, 'walk');
    assert.equal(readToken(mounted.memory, otherRoomId, 42), 'fixed-token');
  } finally {
    mounted.close();
  }
});

test('joining a room never replaces its destination with a local selection', async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const mounted = await mountRoom({
    destination: meetingPlace,
    shareRoomId: otherRoomId,
    adapter: async config => {
      requests.push({ url: config.url ?? '', body: JSON.parse(config.data) });
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  try {
    act(() => mounted.entry.submitSearch(form));
    await until(() => mounted.navigation.length > 0);
    assert.ok(requests[0].url.endsWith('location_join_room'));
    assert.equal('meeting_destination' in requests[0].body, false);
  } finally {
    mounted.close();
  }
});

test('fixed shared result uses the server run context and skips midpoint settings', async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const mounted = await mountRoom({
    view: true,
    destination: meetingPlace,
    adapter: async config => {
      const url = config.url ?? '';
      requests.push({ url, body: JSON.parse(config.data) });
      const data = url.endsWith('location_room_recommend_start')
        ? {
            recommendation_run_id: runId,
            participant: participants,
            meeting_destination: meetingPlace,
          }
        : url.endsWith('location-destination')
          ? { map_id: mapId, map_host_id: 'fixed-result-host' }
          : url.endsWith('location_result_by_map_id')
            ? {
                map_id: mapId,
                station_info: [],
                request_info: {
                  participant: participants,
                  meetingDestination: meetingPlace,
                  destinationRoutes: [],
                },
              }
            : {};
      return { data, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  try {
    assert.equal(
      mounted.renderer.root.findAllByType(RecommendationOptionSelector).length,
      0,
    );
    act(() => mounted.renderer.root.findByType(Button).props.onClick());
    await until(() => mounted.navigation.length > 0);
    const generated = requests.find(request =>
      request.url.endsWith('location-destination'),
    );
    assert.deepEqual(generated?.body, {
      roomContext: { roomId, hostId, runId },
    });
    assert.equal(
      requests.some(request => request.url.endsWith('location-points')),
      false,
    );
    const completed = requests.find(request =>
      request.url.endsWith('location_room_recommend_complete'),
    );
    assert.equal(completed?.body.p_recommendation_run_id, runId);
    assert.equal(mounted.navigation.at(-1), `/result?mapId=${mapId}`);
  } finally {
    mounted.close();
  }
});

test('fixed shared result refuses an old server snapshot with no destination and releases only that run', async () => {
  const urls: string[] = [];
  const mounted = await mountRoom({
    view: true,
    destination: meetingPlace,
    adapter: async config => {
      urls.push(config.url ?? '');
      return {
        data: { recommendation_run_id: runId, participant: participants },
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
    assert.deepEqual(urls, [
      '/rest/v1/rpc/location_room_recommend_start',
      '/rest/v1/rpc/location_room_recommend_fail',
    ]);
    assert.deepEqual(mounted.navigation, []);
  } finally {
    mounted.close();
  }
});

test('fixed shared destination change is hidden from guests and enabled for the host only', async () => {
  for (const host of [false, true]) {
    const mounted = await mountRoom({
      view: true,
      destination: meetingPlace,
      memory: new Map([
        ['room', JSON.stringify({ roomId, hostId: host ? hostId : '' })],
      ]),
    });
    try {
      assert.equal(
        mounted.renderer.root
          .findAllByType('button')
          .some(button => button.props['aria-label'] === '모임 장소 변경'),
        host,
      );
      assert.equal(
        mounted.renderer.root.findByType(Button).props.isDisabled,
        !host,
      );
    } finally {
      mounted.close();
    }
  }
});

test('starting fixed together input cannot join a previously active room after visiting direct input', async () => {
  const requests: string[] = [];
  const mounted = await mountRoom({
    destination: meetingPlace,
    createNewRoom: true,
    adapter: async config => {
      requests.push(config.url ?? '');
      return {
        data: { room_id: otherRoomId, room_host_id: 'new' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  });
  try {
    act(() => mounted.store.set(searchState, [form]));
    act(() => mounted.entry.submitSearch(form));
    await until(() => mounted.navigation.length > 0);
    assert.deepEqual(requests, ['/rest/v1/rpc/location_destination_together']);
  } finally {
    mounted.close();
  }
});

for (const pendingSave of [false, true]) {
  test(`switching cached fixed rooms isolates an ${pendingSave ? 'in-flight destination save' : 'open destination picker'}`, async () => {
    const requests: { url: string; body: Record<string, unknown> }[] = [];
    const otherHostId = 'other-room-host';
    const otherPlace = { ...meetingPlace, name: '다른 방 장소' };
    let releaseSave!: () => void;
    const save = new Promise<void>(resolve => {
      releaseSave = resolve;
    });
    const mounted = await mountRoom({
      view: true,
      destination: meetingPlace,
      adapter: async config => {
        const url = config.url ?? '';
        requests.push({ url, body: JSON.parse(config.data) });
        if (url.endsWith('location_room_destination_update')) await save;
        const data = url.endsWith('location_room_recommend_start')
          ? {
              recommendation_run_id: runId,
              participant: participants,
              meeting_destination: otherPlace,
            }
          : url.endsWith('location-destination')
            ? { map_id: mapId, map_host_id: 'fixed-result-host' }
            : url.endsWith('location_result_by_map_id')
              ? {
                  map_id: mapId,
                  station_info: [],
                  request_info: {
                    participant: participants,
                    meetingDestination: otherPlace,
                    destinationRoutes: [],
                  },
                }
              : {};
        return { data, status: 200, statusText: 'OK', headers: {}, config };
      },
    });
    const calculate = () => mounted.renderer.root.findByType(Button);
    const destinationWrites = () =>
      requests.filter(request =>
        request.url.endsWith('location_room_destination_update'),
      );
    try {
      mounted.client.setQueryData(['inputStatusList', otherRoomId], {
        ...mounted.status,
        room_id: otherRoomId,
        meeting_destination: otherPlace,
      });
      act(() =>
        mounted.renderer.root
          .findAllByType('button')
          .find(button => button.props['aria-label'] === '모임 장소 변경')!
          .props.onClick(),
      );
      const picker = mounted.store.get(bottomSheetState).contents;
      assert.ok(
        React.isValidElement<React.ComponentProps<typeof Address>>(picker),
      );
      const select = picker.props.onSelect;
      assert.ok(select);
      if (pendingSave) {
        await act(async () => {
          select(form.address);
          mounted.store.set(bottomSheetState, RESET);
        });
        assert.equal(destinationWrites().length, 1);
        assert.equal(destinationWrites()[0].body.p_room_id, roomId);
        assert.equal(calculate().props.isDisabled, true);
      }
      await act(async () =>
        mounted.store.set(roomState, {
          roomId: otherRoomId,
          hostId: otherHostId,
        }),
      );
      await act(async () => select(form.address));
      assert.equal(
        destinationWrites().length,
        pendingSave ? 1 : 0,
        'the previous room picker must not send another mutation',
      );
      assert.equal(mounted.store.get(bottomSheetState).isOpen, false);
      assert.equal(calculate().props.isDisabled, false);
      if (pendingSave) {
        await act(async () => mounted.store.set(roomState, { roomId, hostId }));
        assert.equal(
          calculate().props.isDisabled,
          false,
          'returning to the previous room must not restore an abandoned busy flag',
        );
        await act(async () =>
          mounted.store.set(roomState, {
            roomId: otherRoomId,
            hostId: otherHostId,
          }),
        );
      }
      act(() => calculate().props.onClick());
      await until(() => mounted.navigation.length > 0);
      assert.deepEqual(
        requests.find(request => request.url.endsWith('location-destination'))
          ?.body,
        { roomContext: { roomId: otherRoomId, hostId: otherHostId, runId } },
      );
      assert.equal(mounted.navigation.at(-1), `/result?mapId=${mapId}`);
    } finally {
      await act(async () => {
        releaseSave();
        await wait(0);
      });
      mounted.close();
    }
  });
}
