import { createSafeJSONStorage } from '@/utils/browserStorage';
import { atomWithStorage } from 'jotai/utils';
import { SearchState } from '../global/store';

export type SearchHistoryItem = SearchState['address'];

const initialState: SearchHistoryItem[] = [];

export const searchHistoryState = atomWithStorage(
  'searchHistory',
  initialState,
  createSafeJSONStorage<SearchHistoryItem[]>(() => localStorage),
);
