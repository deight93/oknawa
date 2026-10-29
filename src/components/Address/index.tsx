import { useRef, useState } from 'react';
import styled from 'styled-components';
import { useResetAtom } from 'jotai/utils';
import { UseFormSetValue } from 'react-hook-form';
import { ChevronLeft, CircleX, Clock3, MapPin } from 'lucide-react';
import { useSetAtom } from 'jotai';

import Place from './components/Place';
import useKakaoPlaceService from '@/hooks/common/useKakaoPlaceService';
import { KakaoPlace } from './types';
import { bottomSheetState, SearchState } from '@/jotai/global/store';
import { SearchHistoryItem, searchHistoryState } from '@/jotai/search/store';

interface AddressProps {
  setValue: UseFormSetValue<SearchState>;
}

const isSearchHistoryItem = (item: unknown): item is SearchHistoryItem => {
  if (!item || typeof item !== 'object') return false;
  return (
    'fullAddress' in item &&
    typeof item.fullAddress === 'string' &&
    'regionName' in item &&
    typeof item.regionName === 'string' &&
    'latitude' in item &&
    typeof item.latitude === 'number' &&
    'longitude' in item &&
    typeof item.longitude === 'number'
  );
};

const readSearchHistory = (): SearchHistoryItem[] => {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem('searchHistory') ?? '[]',
    );
    return Array.isArray(stored) ? stored.filter(isSearchHistoryItem) : [];
  } catch {
    return [];
  }
};

export default function Address({ setValue }: AddressProps) {
  const resetBottomSheet = useResetAtom(bottomSheetState);
  const [input, setInput] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const setSearchHistory = useSetAtom(searchHistoryState);
  const [recentSearches] = useState(readSearchHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const { places, status } = useKakaoPlaceService(input);

  const selectAddress = (address: SearchHistoryItem) => {
    setValue('address', address);
    resetBottomSheet();
  };

  const handlePlaceItemClick = (place: KakaoPlace) => {
    const address = {
      fullAddress: place.address_name,
      latitude: Number(place.y),
      longitude: Number(place.x),
      regionName: place.place_name,
    };
    selectAddress(address);
    try {
      setSearchHistory([address, ...recentSearches]);
    } catch {
      // Optional search history must not prevent choosing an address when storage is blocked.
    }
  };

  return (
    <Container>
      <SearchHeader>
        <BackButton
          type="button"
          aria-label="출발지 검색 닫기"
          onClick={resetBottomSheet}
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </BackButton>
        <Title>출발지 검색</Title>
      </SearchHeader>
      <SearchField>
        <SearchInput
          ref={inputRef}
          type="text"
          aria-label="출발지 검색"
          aria-describedby="address-search-hint"
          autoComplete="off"
          value={input}
          placeholder="출발지를 입력해주세요."
          onChange={event => setInput(event.target.value)}
          onFocus={() => setIsHistoryOpen(true)}
          onKeyDown={event => {
            if (event.key === 'Escape') resetBottomSheet();
          }}
        />
        {input && (
          <ClearButton
            type="button"
            aria-label="검색어 지우기"
            onClick={() => {
              setInput('');
              inputRef.current?.focus();
            }}
          >
            <CircleX size={20} aria-hidden="true" />
          </ClearButton>
        )}
      </SearchField>
      {isHistoryOpen && !input.trim() && recentSearches.length > 0 && (
        <RecentSearch>
          <RecentTitle>최근 검색</RecentTitle>
          <PlacesList aria-label="최근 검색한 출발지">
            {recentSearches.map((item, index) => (
              <Place
                key={`${item.fullAddress}-${index}`}
                onClick={() => selectAddress(item)}
              >
                <Clock3 size={20} aria-hidden="true" />
                <PlaceText>
                  <Place.Title>{item.regionName}</Place.Title>
                  <Place.SubTitle>{item.fullAddress}</Place.SubTitle>
                </PlaceText>
              </Place>
            ))}
          </PlacesList>
        </RecentSearch>
      )}
      {status === 'success' && (
        <PlacesList aria-label="주소 검색 결과">
          {places.map(place => (
            <Place key={place.id} onClick={() => handlePlaceItemClick(place)}>
              <MapPin size={23} aria-hidden="true" />
              <PlaceText>
                <Place.Title>{place.place_name}</Place.Title>
                <Place.SubTitle>
                  {place.road_address_name || place.address_name}
                </Place.SubTitle>
              </PlaceText>
            </Place>
          ))}
        </PlacesList>
      )}
      <SearchStatus role="status" aria-live="polite">
        {status === 'loading' && '출발지를 검색하고 있어요.'}
        {status === 'empty' &&
          '검색 결과가 없습니다. 장소명이나 주소를 다시 입력해주세요.'}
        {status === 'error' &&
          '검색 결과를 불러오지 못했어요. 잠시 후 다시 입력해주세요.'}
        {status === 'sdk-error' &&
          '주소 검색을 준비하지 못했어요. 네트워크 연결을 확인하고 화면을 새로고침해주세요.'}
      </SearchStatus>
      <SearchHint id="address-search-hint">
        정확한 출발지를 선택해주세요.
      </SearchHint>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 64px);
  padding: 20px 4px 16px;
  background: var(--app-bg);
  color: var(--text-primary);
  button:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }
`;

const SearchHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 20px -12px;
`;

const BackButton = styled.button`
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  flex-shrink: 0;
  &:hover {
    background: var(--surface-muted);
  }
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
`;

const SearchField = styled.div`
  display: flex;
  align-items: center;
  min-height: 48px;
  margin-bottom: 20px;
  padding-left: 16px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface-muted);
  &:focus-within {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 2px;
  }
`;

const SearchInput = styled.input`
  &[type='text'] {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 46px;
    padding-right: 12px;
    font-size: 16px;
    transform: none;
    background: transparent;
    color: var(--text-primary);
    caret-color: var(--primary);
    border: 0;
    outline: 0;
  }
  &::placeholder {
    color: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
  }
`;

const ClearButton = styled(BackButton)`
  color: var(--text-muted);
  margin-right: 2px;
`;

const PlacesList = styled.ul`
  display: flex;
  flex-direction: column;
`;

const PlaceText = styled.div`
  min-width: 0;
`;

const RecentSearch = styled.section`
  margin-top: 8px;
`;

const RecentTitle = styled.h2`
  font-size: 14px;
  color: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
`;

const SearchStatus = styled.p`
  color: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
  font-size: 14px;
  line-height: 1.6;
  &:not(:empty) {
    padding: 36px 12px;
    text-align: center;
  }
`;

const SearchHint = styled.p`
  margin-top: auto;
  padding-top: 32px;
  color: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
  font-size: 13px;
  line-height: 1.5;
`;
