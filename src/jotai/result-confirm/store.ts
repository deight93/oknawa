import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { StationInfo } from '@/types/location';

const initialState: StationInfo = {
  address_name: '',
  end_x: 0,
  end_y: 0,
  itinerary: [],
  station_name: '',
  share_key: '',
  request_info: { participant: [] },
  vote: 0,
};

export const resultConfirmState = atomWithStorage<StationInfo>(
  'result-confirm',
  initialState,
  createJSONStorage(() => sessionStorage),
);
