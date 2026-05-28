import { atomWithReset, atomWithStorage, createJSONStorage } from 'jotai/utils';
import { ReactNode } from 'react';

interface ModalState {
  isOpen: boolean;
  title?: string;
  buttonLabel?: string;
  buttonLabel02?: string;
  contents: string;
  onConfirm?: () => void;
}

export interface SearchState {
  name: string;
  address: {
    fullAddress: string;
    latitude: number;
    longitude: number;
    regionName: string;
  };
}

interface BottomSheetState {
  isOpen: boolean;
  title: string | ReactNode;
  contents: ReactNode;
  height: number;
  isFullContents: boolean;
}

interface StringStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, newValue: string) => void;
  removeItem: (key: string) => void;
}

const initialState: ModalState = {
  isOpen: false,
  title: '',
  buttonLabel: '',
  buttonLabel02: '',
  contents: '',
};

const bottomSheetInitialState: BottomSheetState = {
  isOpen: false,
  title: null,
  contents: null,
  height: 52,
  isFullContents: false,
};

const noopStringStorage: StringStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const searchStorage = createJSONStorage<SearchState[]>(() =>
  typeof window === 'undefined' ? noopStringStorage : window.sessionStorage,
);

export const modalState = atomWithReset<ModalState>(initialState);

export const searchState = atomWithStorage<SearchState[]>(
  'searchList',
  [],
  searchStorage,
  { getOnInit: true },
);

export const bottomSheetState = atomWithReset<BottomSheetState>(
  bottomSheetInitialState,
);
