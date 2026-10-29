import { createSafeJSONStorage } from '@/utils/browserStorage';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

interface InitialState {
  roomId: string;
  hostId: string;
  resultMapId?: string;
}

const initialState: InitialState = {
  roomId: '',
  hostId: '',
};

const activeRoomState = atomWithStorage(
  'room',
  initialState,
  createSafeJSONStorage<InitialState>(() => localStorage),
);

const roomHostCapabilities = atomWithStorage<Record<string, string>>(
  'roomHostCapabilities',
  {},
  createSafeJSONStorage<Record<string, string>>(() => localStorage),
);

// Keep the old active-room storage format, while retaining ownership when a
// host follows their own invite or visits another room on the same browser.
export const roomState = atom(
  get => {
    const room = get(activeRoomState);
    const capabilities = get(roomHostCapabilities);
    const hostId = room.hostId || capabilities[room.roomId] || '';
    return hostId === room.hostId ? room : { ...room, hostId };
  },
  (
    get,
    set,
    update: InitialState | ((previous: InitialState) => InitialState),
  ) => {
    const previous = get(roomState);
    const next = typeof update === 'function' ? update(previous) : update;
    const capabilities = { ...get(roomHostCapabilities) };
    if (previous.roomId && previous.hostId)
      capabilities[previous.roomId] = previous.hostId;
    if (next.roomId && next.hostId) capabilities[next.roomId] = next.hostId;
    set(roomHostCapabilities, capabilities);
    set(activeRoomState, {
      ...next,
      hostId: next.hostId || capabilities[next.roomId] || '',
    });
  },
);
