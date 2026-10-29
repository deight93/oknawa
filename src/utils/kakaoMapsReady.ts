let scriptFailed = false;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();

export const onKakaoMapsScriptLoad = () => {
  scriptFailed = false;
  listeners.forEach(listener => listener());
};

export const onKakaoMapsScriptError = () => {
  scriptFailed = true;
  listeners.forEach(listener => listener());
};

// BaseHead owns the only SDK script, including the services library. Consumers
// may mount before that script or its internal libraries have finished loading.
export const waitForKakaoMaps = (): Promise<void> => {
  if (pending) return pending;
  const request = new Promise<void>((resolve, reject) => {
    let settled = false;
    let initializing = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      listeners.delete(initialize);
      if (error) reject(error);
      else resolve();
    };
    const initialize = () => {
      if (scriptFailed) {
        finish(new Error('Kakao Maps script failed to load'));
        return;
      }
      if (initializing || typeof kakao === 'undefined' || !kakao.maps?.load)
        return;
      initializing = true;
      try {
        kakao.maps.load(() => {
          if (typeof kakao.maps.services?.Places !== 'function') {
            finish(new Error('Kakao Maps services are unavailable'));
          } else finish();
        });
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new Error('Kakao Maps initialization failed'),
        );
      }
    };
    const timeout = setTimeout(
      () => finish(new Error('Kakao Maps loading timed out')),
      10_000,
    );
    listeners.add(initialize);
    initialize();
  });
  pending = request;
  const clearPending = () => {
    if (pending === request) pending = undefined;
  };
  void request.then(clearPending, clearPending);
  return request;
};
