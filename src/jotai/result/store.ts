import { atomWithStorage, createJSONStorage } from 'jotai/utils';

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
  createJSONStorage(() => sessionStorage),
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
  createJSONStorage(() => sessionStorage),
);
