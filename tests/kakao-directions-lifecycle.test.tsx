import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import useKakaoDirections from '../src/hooks/result/useKakaoDirections';

const links = {
  appUrl: 'kakaomap://route?sp=37.4,127&ep=37.5,127.1&by=publictransit',
  webUrl: 'https://map.kakao.com/link/by/traffic/A,37.4,127/B,37.5,127.1',
  travelMode: 'transit' as const,
};
function click(overrides = {}) {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...overrides,
  };
}

function advance(t: TestContext, duration: number) {
  for (let elapsed = 0; elapsed < duration; elapsed += 250) {
    t.mock.timers.tick(Math.min(250, duration - elapsed));
  }
}

function mount(t: TestContext, userAgent = 'iPhone', throwApp = false) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const navigations: string[] = [];
  const win = Object.assign(new EventTarget(), {
    location: {
      assign(url: string) {
        navigations.push(url);
        if (throwApp && url.startsWith('kakaomap:')) throw new Error('Blocked');
      },
    },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  });
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
    hasFocus: () => true,
  });
  const restoreGlobals: Array<() => void> = [];
  for (const [key, value] of Object.entries({
    window: win,
    document: doc,
    navigator: { userAgent, maxTouchPoints: 5 },
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    restoreGlobals.push(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  let hook!: ReturnType<typeof useKakaoDirections>;
  let renderer!: ReactTestRenderer;
  function Probe({ context }: { context: string }) {
    hook = useKakaoDirections(context);
    return null;
  }
  act(() => {
    renderer = create(
      React.createElement(Probe, { context: 'candidate-a:expanded' }),
    );
  });
  const close = () => act(() => renderer.unmount());
  // Dispose listeners while the fake browser is still installed.
  t.after(() => {
    close();
    restoreGlobals.forEach(restore => restore());
  });
  return {
    win,
    doc,
    navigations,
    get hook() {
      return hook;
    },
    close,
    change(context: string) {
      act(() => renderer.update(React.createElement(Probe, { context })));
    },
  };
}

test('mobile app launch happens during the click and falls back once when the page stays active', t => {
  const m = mount(t);
  const event = click();
  m.hook.openDirections(event, links);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(m.navigations, [links.appUrl]);
  advance(t, 2000);
  assert.deepEqual(m.navigations, [links.appUrl, links.webUrl]);
  advance(t, 2000);
  assert.equal(m.navigations.length, 2);
});

for (const signal of ['visibilitychange', 'pagehide', 'blur'] as const) {
  test(`${signal} cancels fallback even after returning to the page`, t => {
    const m = mount(t);
    m.hook.openDirections(click(), links);
    if (signal === 'visibilitychange') {
      m.doc.visibilityState = 'hidden';
      m.doc.dispatchEvent(new Event(signal));
      m.doc.visibilityState = 'visible';
      m.doc.dispatchEvent(new Event(signal));
    } else m.win.dispatchEvent(new Event(signal));
    advance(t, 5000);
    assert.deepEqual(m.navigations, [links.appUrl]);
  });
}

for (const action of ['candidate', 'collapse', 'web', 'unmount'] as const) {
  test(`${action} cancels pending web navigation`, t => {
    const m = mount(t);
    m.hook.openDirections(click(), links);
    if (action === 'candidate') m.change('candidate-b:expanded');
    if (action === 'collapse') m.change('candidate-a:collapsed');
    if (action === 'web') m.hook.cancelPendingDirections();
    if (action === 'unmount') m.close();
    advance(t, 2000);
    assert.deepEqual(m.navigations, [links.appUrl]);
  });
}

test('a second participant cancels the first pending fallback', t => {
  const m = mount(t);
  const second = {
    ...links,
    appUrl: links.appUrl.replace('37.4,127', '37.6,127.2'),
    webUrl: links.webUrl.replace('37.4,127', '37.6,127.2'),
  };
  m.hook.openDirections(click(), links);
  advance(t, 1000);
  m.hook.openDirections(click(), second);
  advance(t, 1000);
  assert.deepEqual(m.navigations, [links.appUrl, second.appUrl]);
  advance(t, 1000);
  assert.deepEqual(m.navigations, [links.appUrl, second.appUrl, second.webUrl]);
});

for (const delay of [1250, 2500, 14000]) {
  for (const beforePause of [0, 1500]) {
    test(`a ${delay}ms dialog suspension after ${beforePause}ms cancels fallback without lifecycle events`, t => {
      const m = mount(t);
      m.hook.openDirections(click(), links);
      advance(t, beforePause);
      t.mock.timers.setTime(Date.now() + delay);
      t.mock.timers.tick(1);
      advance(t, 3000);
      assert.deepEqual(m.navigations, [links.appUrl]);
    });
  }
}

test('desktop and modified clicks preserve normal browser link behavior', t => {
  const m = mount(t, 'Windows NT 10.0');
  const event = click();
  m.hook.openDirections(event, links);
  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(m.navigations, []);
});

test('modified mobile clicks cancel pending fallback and preserve normal link behavior', t => {
  const m = mount(t);
  for (const modifiers of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { defaultPrevented: true },
  ]) {
    m.hook.openDirections(click(), links);
    const event = click(modifiers);
    m.hook.openDirections(event, links);
    assert.equal(event.defaultPrevented, 'defaultPrevented' in modifiers);
  }
  advance(t, 2000);
  assert.ok(m.navigations.every(url => url === links.appUrl));
});

test('a synchronously blocked scheme opens the web and clears its timer', t => {
  const m = mount(t, 'iPhone', true);
  m.hook.openDirections(click(), links);
  advance(t, 2000);
  assert.deepEqual(m.navigations, [links.appUrl, links.webUrl]);
});

test('Android starts an intent with the web fallback in the same user gesture', t => {
  const m = mount(t, 'Android');
  m.hook.openDirections(click(), links);
  assert.match(m.navigations[0], /^intent:\/\/route\?/);
  assert.ok(
    m.navigations[0].includes(
      `S.browser_fallback_url=${encodeURIComponent(links.webUrl)}`,
    ),
  );
});
