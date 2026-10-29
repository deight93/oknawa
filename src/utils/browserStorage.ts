import { createJSONStorage } from 'jotai/utils';

const unavailableStorage = {
  getItem: () => null,
  setItem: () => {
    throw new Error('Storage unavailable');
  },
  removeItem: () => {
    throw new Error('Storage unavailable');
  },
};

// Browser caches are optional. Failed writes/deletes stay in this tab so a
// later mount does not resurrect stale persisted data. Never cache SSR data.
export const createSafeJSONStorage = <T>(getStorage: () => Storage) => {
  const fallback = new Map<string, { value: T } | null>();
  const getAvailableStorage = () => {
    try {
      return getStorage();
    } catch {
      return unavailableStorage;
    }
  };
  const persistent = createJSONStorage<T>(getAvailableStorage);
  return {
    getItem(key: string, initialValue: T): T {
      const cached =
        typeof window === 'undefined' ? undefined : fallback.get(key);
      if (cached !== undefined)
        return cached === null ? initialValue : cached.value;
      try {
        return persistent.getItem(key, initialValue);
      } catch {
        return initialValue;
      }
    },
    setItem(key: string, value: T) {
      try {
        persistent.setItem(key, value);
        fallback.delete(key);
      } catch {
        if (typeof window !== 'undefined') fallback.set(key, { value });
      }
    },
    removeItem(key: string) {
      try {
        persistent.removeItem(key);
        fallback.delete(key);
      } catch {
        if (typeof window !== 'undefined') fallback.set(key, null);
      }
    },
    subscribe(key: string, callback: (value: T) => void, initialValue: T) {
      try {
        return (
          persistent.subscribe?.(
            key,
            value => {
              fallback.delete(key);
              callback(value);
            },
            initialValue,
          ) ?? (() => {})
        );
      } catch {
        return () => {};
      }
    },
  };
};

// Do not create a server-side room/result if its creator capability cannot be
// retained. Optional cache writes use the adapter above; identity does not.
export const assertBrowserStorageWritable = (kind: 'local' | 'session') => {
  try {
    const storage = kind === 'local' ? localStorage : sessionStorage;
    const key = `oknawa:storage-check:${Math.random().toString(36).slice(2)}`;
    storage.setItem(key, '1');
    const saved = storage.getItem(key) === '1';
    storage.removeItem(key);
    if (!saved) throw new Error('Storage did not retain the value');
  } catch {
    throw new Error(
      '브라우저 저장소를 사용할 수 없습니다. 저장소 사용을 허용한 뒤 다시 시도해주세요.',
    );
  }
};
