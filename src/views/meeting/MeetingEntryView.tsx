'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';
import styled from 'styled-components';
import PageHeader from '@/components/PageHeader';
import Address from '@/components/Address';
import SearchTypeSelector from '@/components/SearchTypeSelector';
import { PlusIcon } from '@/assets/icons/Plus';
import { PeopleIcon } from '@/assets/icons/People';
import { meetingDestinationState } from '@/jotai/meeting/store';
import { bottomSheetState, searchState } from '@/jotai/global/store';
import MeetingDestinationField from '@/views/search/components/MeetingDestinationField';

export default function MeetingEntryView() {
  const router = useRouter();
  const [destination, setDestination] = useAtom(meetingDestinationState);
  const setSearchList = useSetAtom(searchState);
  const setSheet = useSetAtom(bottomSheetState);
  const chooseDestination = () =>
    setSheet(previous => ({
      ...previous,
      isOpen: true,
      isFullContents: true,
      contents: (
        <Address
          label="모임 장소"
          onSelect={address => {
            setSearchList([]);
            setDestination({
              name: address.regionName,
              address: address.fullAddress,
              x: address.longitude,
              y: address.latitude,
            });
          }}
        />
      ),
    }));
  return (
    <Container>
      <PageHeader onBack={() => router.push('/')} />
      <Title>
        {destination ? '출발지를 어떻게\n입력할까요?' : '어디로 모일까요?'}
      </Title>
      <Description>
        {destination
          ? '정해진 장소까지 각자의 이동시간을 확인해요.'
          : '모두가 만날 장소를 먼저 선택해주세요.'}
      </Description>
      {destination ? (
        <>
          <MeetingDestinationField
            destination={destination}
            onChange={setDestination}
          />
          <Methods aria-label="출발지 입력 방식">
            <SearchTypeSelector
              type="individual"
              href="/meeting/individual"
              icon={<PlusIcon width="42" height="42" />}
            />
            <SearchTypeSelector
              type="together"
              href="/meeting/together"
              icon={<PeopleIcon width="42" height="42" />}
            />
          </Methods>
        </>
      ) : (
        <SearchButton type="button" onClick={chooseDestination}>
          <MapPin size={20} aria-hidden="true" />
          <span>모임 장소 검색</span>
          <Search size={20} aria-hidden="true" />
        </SearchButton>
      )}
    </Container>
  );
}
const Container = styled.main`
  min-height: 100dvh;
  padding: max(12px, env(safe-area-inset-top)) 20px
    max(28px, env(safe-area-inset-bottom));
`;
const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  line-height: 1.45;
  margin-top: 32px;
  white-space: pre-line;
`;
const Description = styled.p`
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 12px 0 24px;
  word-break: keep-all;
`;
const Methods = styled.nav`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
`;
const SearchButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 14px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font-size: 16px;
  text-align: left;
  span {
    flex: 1;
  }
  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 3px;
  }
`;
