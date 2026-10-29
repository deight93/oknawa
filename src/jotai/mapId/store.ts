import { createSafeJSONStorage } from '@/utils/browserStorage';
import { atomWithStorage } from 'jotai/utils';

export interface MapIdState {
  mapId: string;
  mapHostId: string;
}

const initialState: MapIdState = {
  mapId: '',
  mapHostId: '',
};

export const mapIdState = atomWithStorage<MapIdState>(
  'mapIdInfo',
  initialState,
  createSafeJSONStorage<MapIdState>(() => sessionStorage),
);
