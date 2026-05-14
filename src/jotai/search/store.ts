import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { SearchState } from '../global/store';

export type SearchHistoryItem = SearchState['address'];

const initialState: SearchHistoryItem[] = [];

export const searchHistoryState = atomWithStorage(
  'searchHistory',
  initialState,
  createJSONStorage(() => localStorage),
);
