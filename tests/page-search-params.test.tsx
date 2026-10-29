import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';

let ResultPage: typeof import('../src/app/result/page').default;
let ResultConfirmPage: typeof import('../src/app/result/confirm/page').default;
let TogetherPage: typeof import('../src/app/search/together/page').default;

const originalReact = Object.getOwnPropertyDescriptor(globalThis, 'React');

before(async () => {
  Object.defineProperty(globalThis, 'React', {
    configurable: true,
    value: React,
  });
  ResultPage = (await import('../src/app/result/page')).default;
  ResultConfirmPage = (await import('../src/app/result/confirm/page')).default;
  TogetherPage = (await import('../src/app/search/together/page')).default;
});

after(() => {
  if (originalReact) Object.defineProperty(globalThis, 'React', originalReact);
  else Reflect.deleteProperty(globalThis, 'React');
});

const cases: Array<{
  value: string | string[] | undefined;
  expected: string | null;
}> = [
  {
    value: '11111111-1111-4111-8111-111111111111',
    expected: '11111111-1111-4111-8111-111111111111',
  },
  { value: ['first', 'second'], expected: 'first' },
  { value: '', expected: '' },
  { value: [], expected: null },
  { value: undefined, expected: null },
];

test('result links resolve asynchronous map IDs and keep the first repeated value', async () => {
  for (const { value, expected } of cases) {
    const page = await ResultPage({
      searchParams: Promise.resolve({ mapId: value }),
    });
    assert.equal(page.props.queryMapId, expected);
  }
  assert.equal((await ResultPage({})).props.queryMapId, null);
});

test('confirmation links resolve asynchronous share keys without losing the selected result', async () => {
  for (const { value, expected } of cases) {
    const page = await ResultConfirmPage({
      searchParams: Promise.resolve({ sharekey: value }),
    });
    assert.equal(page.props.queryShareKey, expected);
  }
  assert.equal((await ResultConfirmPage({})).props.queryShareKey, null);
});

test('invitation links resolve asynchronous room IDs while new meetings have no room', async () => {
  for (const { value, expected } of cases) {
    const page = await TogetherPage({
      searchParams: Promise.resolve({ roomId: value }),
    });
    assert.equal(page.props.shareRoomId, expected);
    assert.equal(page.props.type, 'together');
  }
  assert.equal((await TogetherPage({})).props.shareRoomId, null);
});
