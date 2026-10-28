import styled from 'styled-components';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import Image from 'next/image';

import SearchTypeSelector from '@/components/SearchTypeSelector';
import { PeopleIcon } from '@/assets/icons/People';
import { PlusIcon } from '@/assets/icons/Plus';
import { searchState } from '@/jotai/global/store';

export default function MainView() {
  const [, setSearchList] = useAtom(searchState);

  useEffect(() => {
    setSearchList([]);
  }, [setSearchList]);

  return (
    <Container>
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
    </Container>
  );
}

const Container = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding: clamp(80px, 12vh, 104px) 19px 40px;
  min-height: 100vh;

  @media (max-width: 500px) and (max-height: 640px) {
    gap: 24px;
    padding: 64px 16px 24px;
  }
`;

const Introduction = styled.header`
  width: 100%;
  text-align: center;
`;

const MeetingIllustration = styled(Image)`
  display: block;
  width: min(100%, 340px);
  height: auto;
  margin: 0 auto 12px;

  @media (max-width: 500px) and (max-height: 640px) {
    width: min(100%, 224px);
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
  font-size: 15px;
  line-height: 22px;
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
