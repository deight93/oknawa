import { createSafeJSONStorage } from '@/utils/browserStorage';
import { atomWithStorage } from 'jotai/utils';

import { LocationResult, RequestInfo } from '@/types/location';

const InitialRequestInfo: RequestInfo = {
  participant: [],
};

const initialState: LocationResult = {
  station_info: [],
  request_info: InitialRequestInfo,
  vote_round: 1,
};

export const resultState = atomWithStorage<LocationResult>(
  'result',
  initialState,
  createSafeJSONStorage<LocationResult>(() => sessionStorage),
);

interface ShareKeyState {
  share_key: string;
}
const initialShareKeyState: ShareKeyState = {
  share_key: '',
};

export const shareKeyState = atomWithStorage<ShareKeyState>(
  'confirmShareKey',
  initialShareKeyState,
  createSafeJSONStorage<ShareKeyState>(() => sessionStorage),
);
