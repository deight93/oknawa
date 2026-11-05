import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import useKakaoPlaceService from '../src/hooks/common/useKakaoPlaceService';
import Address from '../src/components/Address';
import { Provider, createStore } from 'jotai';
import KakaoScripts from '../src/components/KakaoScripts';
import MeetingMap from '../src/components/MeetingMap';

type SearchCallback = Parameters<
  kakao.maps.services.Places['keywordSearch']
>[1];
type AddressSearchCallback = Parameters<
  kakao.maps.services.Geocoder['addressSearch']
>[1];
type AddressResult = Parameters<AddressSearchCallback>[0][number];
let requests: Array<{ query: string; callback: SearchCallback }>;
let addressRequests: Array<{ query: string; callback: AddressSearchCallback }>;
let ready: () => void;
let tree: ReactTestRenderer | undefined;
let current: ReturnType<typeof useKakaoPlaceService>;
const original = Object.getOwnPropertyDescriptor(globalThis, 'kakao');
const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);
const originalReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
const mapsScript = () => KakaoScripts().props.children[0];

function Probe({ query }: { query: string }) {
  current = useKakaoPlaceService(query);
  return null;
}

const pagination: kakao.maps.Pagination = {
  totalCount: 1,
  hasNextPage: false,
  hasPrevPage: false,
  current: 1,
  first: 1,
  last: 1,
  nextPage() {},
  prevPage() {},
  gotoPage() {},
  gotoFirst() {},
  gotoLast() {},
};

const place = (name: string): kakao.maps.services.PlacesSearchResultItem => ({
  id: name,
  place_name: name,
  address_name: '서울',
  road_address_name: '',
  category_name: '',
  category_group_code: '',
  category_group_name: '',
  phone: '',
  place_url: '',
  distance: '',
  x: '127',
  y: '37.5',
});
const flushSearch = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 120));
  });

beforeEach(() => {
  requests = [];
  addressRequests = [];
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
          Geocoder: class {
            addressSearch(query: string, callback: AddressSearchCallback) {
              addressRequests.push({ query, callback });
            }
          },
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
  act(() =>
    requests[0].callback(
      [place('사당역')],
      kakao.maps.services.Status.OK,
      pagination,
    ),
  );
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
    act(() =>
      requests[0].callback(
        [place('강남역')],
        kakao.maps.services.Status.OK,
        pagination,
      ),
    );
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
  act(() =>
    requests[0].callback(
      [],
      kakao.maps.services.Status.ZERO_RESULT,
      pagination,
    ),
  );
  act(() =>
    addressRequests[0].callback(
      [],
      kakao.maps.services.Status.ZERO_RESULT,
      pagination,
    ),
  );
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
  act(() =>
    requests[1].callback(
      [place('사당역')],
      kakao.maps.services.Status.OK,
      pagination,
    ),
  );
  act(() =>
    requests[0].callback(
      [place('강남역')],
      kakao.maps.services.Status.OK,
      pagination,
    ),
  );
  assert.deepEqual(
    current.places.map(item => item.place_name),
    ['사당역'],
  );
  act(() => tree?.update(<Probe query="" />));
  act(() =>
    requests[1].callback(
      [place('사당역')],
      kakao.maps.services.Status.OK,
      pagination,
    ),
  );
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
  act(() =>
    requests[0].callback([], kakao.maps.services.Status.ERROR, pagination),
  );
  act(() =>
    addressRequests[0].callback(
      [],
      kakao.maps.services.Status.ZERO_RESULT,
      pagination,
    ),
  );
  assert.equal(current.status, 'error');
  act(() => tree?.update(<Probe query="사당" />));
  await flushSearch();
  act(() =>
    requests[1].callback(
      [place('사당역')],
      kakao.maps.services.Status.OK,
      pagination,
    ),
  );
  assert.equal(current.status, 'success');
  assert.equal(current.places[0].place_name, '사당역');
});

// Coordinates and road address are synthetic fixtures, not a live Kakao lookup.
const address = (overrides: Partial<AddressResult> = {}): AddressResult => ({
  address_name: '서울 관악구 봉천동 1511-6',
  address_type: 'REGION_ADDR',
  x: '126.945',
  y: '37.48',
  address: {
    address_name: '서울 관악구 봉천동 1511-6',
    region_1depth_name: '서울',
    region_2depth_name: '관악구',
    region_3depth_name: '봉천동',
    region_3depth_h_name: '',
    h_code: '',
    b_code: '',
    mountain_yn: 'N',
    main_address_no: '1511',
    sub_address_no: '6',
    zip_code: '',
    x: '126.945',
    y: '37.48',
  },
  road_address: {
    address_name: '서울 관악구 테스트로 6',
    region_1depth_name: '서울',
    region_2depth_name: '관악구',
    region_3depth_name: '봉천동',
    road_name: '테스트로',
    underground_yn: 'N',
    main_building_no: '6',
    sub_building_no: '',
    building_name: '',
    zone_no: '',
    x: '126.945',
    y: '37.48',
  },
  ...overrides,
});

async function search(query = '봉천동 1511-6') {
  act(() => {
    tree = create(<Probe query={query} />);
  });
  await act(async () => ready());
  await flushSearch();
}

function replyKeyword(
  results: Parameters<SearchCallback>[0],
  status = kakao.maps.services.Status.OK,
  index = 0,
) {
  const request = requests[index];
  assert.ok(request, 'keyword search must be issued before replying');
  act(() => request.callback(results, status, pagination));
}

function replyAddress(
  results: Parameters<AddressSearchCallback>[0],
  status = kakao.maps.services.Status.OK,
  index = 0,
) {
  const request = addressRequests[index];
  assert.ok(request, 'address search must be issued before replying');
  act(() => request.callback(results, status, pagination));
}

test('봉천동 1511-6 returns a selectable address when keyword search has no places', async () => {
  await search('  봉천동 1511-6  ');
  replyKeyword([], kakao.maps.services.Status.ZERO_RESULT);
  assert.equal(current.status, 'loading');
  replyAddress([address()]);
  assert.equal(current.status, 'success');
  assert.equal(addressRequests[0]?.query, '봉천동 1511-6');
  assert.equal(current.places.length, 1);
  const result = current.places[0];
  assert.ok(result.id);
  assert.deepEqual(
    { ...result, id: 'generated' },
    {
      id: 'generated',
      place_name: '서울 관악구 봉천동 1511-6',
      address_name: '서울 관악구 봉천동 1511-6',
      road_address_name: '서울 관악구 테스트로 6',
      x: '126.945',
      y: '37.48',
    },
  );
});

test('a geocoded address can be selected through the existing Address component', async () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => '[]', setItem() {}, removeItem() {} },
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
      .props.onChange({ target: { value: '봉천동 1511-6' } }),
  );
  await flushSearch();
  replyKeyword([], kakao.maps.services.Status.ZERO_RESULT);
  replyAddress([address()]);
  const button = tree?.root
    .findAllByType('button')
    .find(item =>
      item
        .findAllByType('span')
        .some(span => span.children.includes('서울 관악구 봉천동 1511-6')),
    );
  assert.ok(button, 'geocoded address should be selectable');
  act(() => button.props.onClick());
  assert.deepEqual(selected, {
    fullAddress: '서울 관악구 봉천동 1511-6',
    regionName: '서울 관악구 봉천동 1511-6',
    latitude: 37.48,
    longitude: 126.945,
  });
});

for (const missing of ['road_address', 'address'] as const) {
  test(`geocoder adapts a null ${missing} using the available address fields`, async () => {
    await search();
    replyKeyword([], kakao.maps.services.Status.ZERO_RESULT);
    // The installed SDK declaration omits nullable nested address fields.
    act(() => {
      const callback = addressRequests[0]?.callback;
      assert.ok(callback, 'address search must be issued before replying');
      Reflect.apply(callback, undefined, [
        [{ ...address(), [missing]: null }],
        kakao.maps.services.Status.OK,
        pagination,
      ]);
    });
    assert.equal(current.status, 'success');
    assert.equal(current.places[0].address_name, '서울 관악구 봉천동 1511-6');
    assert.equal(
      current.places[0].road_address_name || '',
      missing === 'road_address' ? '' : '서울 관악구 테스트로 6',
    );
  });
}

for (const failedProvider of ['keyword', 'address']) {
  for (const failureFirst of [false, true]) {
    test(`${failedProvider} failure preserves the other provider's result, failure first: ${failureFirst}`, async () => {
      await search();
      const fail = () =>
        failedProvider === 'keyword'
          ? replyKeyword([], kakao.maps.services.Status.ERROR)
          : replyAddress([], kakao.maps.services.Status.ERROR);
      const succeed = () =>
        failedProvider === 'keyword'
          ? replyAddress([address()])
          : replyKeyword([place('봉천역')]);
      if (failureFirst) {
        fail();
        assert.equal(current.status, 'loading');
        succeed();
      } else {
        succeed();
        assert.equal(current.status, 'success');
        fail();
      }
      assert.equal(current.status, 'success');
      assert.equal(current.places.length, 1);
      assert.equal(
        current.places[0].place_name,
        failedProvider === 'keyword' ? '서울 관악구 봉천동 1511-6' : '봉천역',
      );
    });
  }
}

for (const [keywordStatus, addressStatus, expected] of [
  ['ZERO_RESULT', 'ZERO_RESULT', 'empty'],
  ['ERROR', 'ZERO_RESULT', 'error'],
  ['ZERO_RESULT', 'ERROR', 'error'],
  ['ERROR', 'ERROR', 'error'],
  ['OK', 'OK', 'empty'],
] as const) {
  test(`no results with ${keywordStatus}/${addressStatus} resolves to ${expected} after both responses`, async () => {
    await search();
    replyKeyword([], kakao.maps.services.Status[keywordStatus]);
    assert.equal(current.status, 'loading');
    replyAddress([], kakao.maps.services.Status[addressStatus]);
    assert.equal(current.status, expected);
    assert.deepEqual(current.places, []);
  });
}

for (const first of ['keyword', 'address']) {
  test(`merged results deduplicate addresses and place IDs without dropping distinct businesses, ${first} first`, async () => {
    await search();
    const cafe = {
      ...place('봉천 카페'),
      address_name: '서울 관악구 봉천동 1511-6',
      x: '126.9450',
      y: '37.4800',
    };
    const bakery = { ...cafe, id: 'bakery', place_name: '봉천 빵집' };
    const other = address({
      address_name: '서울 관악구 봉천동 1511-7',
      address: {
        ...address().address,
        address_name: '서울 관악구 봉천동 1511-7',
      },
      x: '126.946',
    });
    const keywords = () => replyKeyword([cafe, cafe, bakery]);
    const addresses = () => replyAddress([address(), address(), other, other]);
    if (first === 'keyword') {
      keywords();
      addresses();
    } else {
      addresses();
      keywords();
    }
    assert.equal(current.status, 'success');
    assert.deepEqual(
      current.places.map(item => item.place_name),
      ['봉천 카페', '봉천 빵집', '서울 관악구 봉천동 1511-7'],
    );
    assert.equal(new Set(current.places.map(item => item.id)).size, 3);
  });
}

test('address IDs are stable across repeated queries and distinct for different addresses', async () => {
  await search();
  replyKeyword([], kakao.maps.services.Status.ZERO_RESULT);
  replyAddress([address()]);
  const id = current.places[0]?.id;
  assert.ok(id);
  act(() => tree?.update(<Probe query="다른 주소" />));
  await flushSearch();
  replyAddress(
    [
      address(),
      address({ address_name: '서울 관악구 봉천동 1511-7', x: '126.946' }),
    ],
    kakao.maps.services.Status.OK,
    1,
  );
  assert.equal(current.places[0].id, id);
  assert.notEqual(current.places[1].id, id);
});

test('late address responses cannot overwrite a newer query or restore a cleared query', async () => {
  await search();
  act(() => tree?.update(<Probe query="사당" />));
  await flushSearch();
  replyKeyword([place('사당역')], kakao.maps.services.Status.OK, 1);
  replyAddress([address()]);
  replyKeyword([], kakao.maps.services.Status.ERROR);
  assert.deepEqual(
    current.places.map(item => item.place_name),
    ['사당역'],
  );
  act(() => tree?.update(<Probe query=" " />));
  replyAddress([address()], kakao.maps.services.Status.OK, 1);
  replyKeyword([place('사당역')], kakao.maps.services.Status.OK, 1);
  assert.deepEqual(current, { status: 'idle', places: [] });
});

test('clearing before debounce prevents both searches', async () => {
  await search();
  act(() => tree?.update(<Probe query="새 주소" />));
  act(() => tree?.update(<Probe query="" />));
  await flushSearch();
  assert.deepEqual(
    addressRequests.map(item => item.query),
    ['봉천동 1511-6'],
  );
  assert.deepEqual(
    requests.map(item => item.query),
    ['봉천동 1511-6'],
  );
  assert.equal(current.status, 'idle');
});

test('a missing Geocoder reports SDK failure and a later query recovers', async () => {
  const geocoder = Object.getOwnPropertyDescriptor(
    kakao.maps.services,
    'Geocoder',
  );
  Reflect.deleteProperty(kakao.maps.services, 'Geocoder');
  await search();
  assert.equal(current.status, 'sdk-error');
  assert.ok(geocoder);
  Object.defineProperty(kakao.maps.services, 'Geocoder', geocoder);
  await act(async () => tree?.update(<Probe query="봉천동" />));
  await act(async () => ready());
  await flushSearch();
  replyKeyword([], kakao.maps.services.Status.ZERO_RESULT);
  replyAddress([address()]);
  assert.equal(current.status, 'success');
});

for (const failedProvider of ['keyword', 'address']) {
  test(`a synchronous ${failedProvider} exception keeps the other search usable`, async () => {
    if (failedProvider === 'keyword') {
      kakao.maps.services.Places.prototype.keywordSearch = () => {
        throw new Error('Search unavailable');
      };
    } else {
      kakao.maps.services.Geocoder.prototype.addressSearch = () => {
        throw new Error('Search unavailable');
      };
    }
    await search();
    if (failedProvider === 'keyword') replyAddress([address()]);
    else replyKeyword([place('봉천역')]);
    assert.equal(current.status, 'success');
    assert.equal(current.places.length, 1);
  });
}
