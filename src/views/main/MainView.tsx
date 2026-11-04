import styled from 'styled-components';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';

import PageHeader from '@/components/PageHeader';

import SearchTypeSelector from '@/components/SearchTypeSelector';
import { PeopleIcon } from '@/assets/icons/People';
import { PlusIcon } from '@/assets/icons/Plus';
import { searchState } from '@/jotai/global/store';
import { meetingDestinationState } from '@/jotai/meeting/store';

export default function MainView() {
  const [, setSearchList] = useAtom(searchState);
  const [, setDestination] = useAtom(meetingDestinationState);

  useEffect(() => {
    setSearchList([]);
    setDestination(null);
  }, [setSearchList, setDestination]);

  return (
    <Container>
      <PageHeader />
      <Introduction>
        <MeetingIllustration
          src="/images/meeting-friends.webp"
          alt=""
          width={680}
          height={340}
          sizes="(max-width: 378px) calc(100vw - 38px), 340px"
          priority
        />
        <Title>{'우리,\n어디서 만날까요?'}</Title>
        <Description>
          출발지를 알려주면
          <br />
          만나기 편한 중간지점을 추천해드려요.
        </Description>
      </Introduction>
      <EntrySection>
        <SectionLabel>중간지점 찾기</SectionLabel>
        <SearchTypeSelectorBox aria-label="출발지 입력 방식">
          <SearchTypeSelector
            type="individual"
            icon={<PlusIcon width="42" height="42" />}
          />
          <SearchTypeSelector
            type="together"
            icon={<PeopleIcon width="42" height="42" />}
          />
        </SearchTypeSelectorBox>
        <DestinationEntry href="/meeting">
          <MapPin size={24} aria-hidden="true" />
          <span>
            <strong>정해진 장소로 모이기</strong>
            <small>약속 장소까지 이동시간을 확인해요</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </DestinationEntry>
      </EntrySection>
    </Container>
  );
}

const Container = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding: max(12px, env(safe-area-inset-top))
    max(20px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom))
    max(20px, env(safe-area-inset-left));
  min-height: 100dvh;

  @media (max-width: 500px) and (max-height: 640px) {
    gap: 24px;
    padding-top: max(12px, env(safe-area-inset-top));
  }
`;

const Introduction = styled.header`
  margin-top: clamp(0px, 3vh, 24px);
  width: 100%;
  text-align: center;
`;

const MeetingIllustration = styled(Image)`
  display: block;
  width: min(100%, clamp(224px, 40dvh, 340px));
  height: auto;
  margin: 0 auto 12px;

  @media (max-width: 500px) and (max-height: 640px) {
    margin-bottom: 16px;
  }
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  white-space: pre-line;
  line-height: 43px;

  @media (max-width: 500px) and (max-height: 640px) {
    font-size: 30px;
    line-height: 40px;
  }
`;

const Description = styled.p`
  margin-top: 12px;
  color: var(--text-secondary);
  color: color-mix(in srgb, var(--text-muted) 85%, var(--text-primary));
  font-size: var(--font-body);
  line-height: 1.6;
  word-break: keep-all;
`;

const SearchTypeSelectorBox = styled.nav`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  max-width: 324px;
  gap: 20px;

  @media (max-width: 359px) {
    gap: 16px;
  }
`;

const EntrySection = styled.section`
  width: 100%;
  max-width: 324px;
`;
const SectionLabel = styled.h2`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
`;
const DestinationEntry = styled(Link)`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
  padding: 18px 0 4px;
  border-top: 1px solid var(--border-strong);
  min-height: 82px;
  color: var(--text-primary);
  > svg {
    flex-shrink: 0;
  }
  > svg:first-child {
    color: var(--primary);
  }
  > span {
    flex: 1;
    min-width: 0;
  }
  strong {
    display: block;
    font-size: 18px;
    line-height: 1.5;
    font-weight: 600;
    word-break: keep-all;
  }
  small {
    display: block;
    margin-top: 4px;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
    word-break: keep-all;
  }
  &:hover {
    background: var(--surface-muted);
  }
  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 4px;
  }
`;
