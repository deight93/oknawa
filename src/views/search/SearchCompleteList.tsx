'use client';

import { useRouter } from 'next/navigation';

import { useEffect, useState } from 'react';

import styled from 'styled-components';
import { ChevronLeft, CirclePlus } from 'lucide-react';

import PeopleCard from './components/PeopleCard';
import SearchLoading from './components/SearchLoading';
import MeetingPurposeSelector from './components/MeetingPurposeSelector';
import RecommendationOptionSelector from './components/RecommendationOptionSelector';

import { useAtom } from 'jotai';
import { searchState } from '@/jotai/global/store';

import { Button as FloatingButton } from '@nextui-org/react';

import useCreateResultFlow from '@/hooks/search/useCreateResultFlow';
import { MeetingPurpose } from '@/types/meetingPurpose';
import {
  DEFAULT_RECOMMENDATION_OPTIONS,
  RecommendationOptions,
} from '@/types/recommendationOptions';

export default function SearchCompleteList() {
  const router = useRouter();

  const [searchList, setSearchList] = useAtom(searchState);
  const [meetingPurpose, setMeetingPurpose] = useState<MeetingPurpose>();
  const [recommendationOptions, setRecommendationOptions] =
    useState<RecommendationOptions>(DEFAULT_RECOMMENDATION_OPTIONS);
  const { requestResult, isLoading, loadingPhase } = useCreateResultFlow();

  const handleSearchBtnClick = () => {
    requestResult(searchList, meetingPurpose, undefined, recommendationOptions);
  };

  const handleDeleteIconClick = (index: number) => {
    setSearchList(prevList => prevList.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const image = new Image();
    image.src = '/loading.gif';
  }, []);

  return (
    <Container>
      <Wrapper>
        <BackButton
          type="button"
          aria-label="이전 화면으로 돌아가기"
          onClick={() => router.back()}
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </BackButton>
        <Section>
          <Title>
            {searchList.length === 0
              ? '함께 만날 친구들의\n출발지를 추가해주세요.'
              : '입력이 완료된\n출발지 목록입니다.'}
          </Title>
          {searchList.map((search, index) => {
            return (
              <PeopleCard
                key={index}
                name={search.name}
                place={search.address.regionName}
                index={index}
                travelMode={search.travelMode ?? 'transit'}
                onTravelModeChange={mode =>
                  setSearchList(list =>
                    list.map((person, i) =>
                      i === index ? { ...person, travelMode: mode } : person,
                    ),
                  )
                }
                onDeleteIconClick={() => handleDeleteIconClick(index)}
              />
            );
          })}
        </Section>
        <AddButton
          type="button"
          onClick={() => router.push('/search/individual')}
        >
          출발지 추가하기 <CirclePlus size={18} aria-hidden="true" />
        </AddButton>
        <MeetingPurposeSelector
          value={meetingPurpose}
          onChange={setMeetingPurpose}
        />
        <RecommendationOptionSelector
          value={recommendationOptions}
          onChange={setRecommendationOptions}
        />
      </Wrapper>
      <Footer>
        {searchList.length < 2 && (
          <Hint>추천을 받으려면 출발지를 두 곳 이상 추가해주세요.</Hint>
        )}
        <SubmitButton
          size="lg"
          color="success"
          onClick={handleSearchBtnClick}
          isDisabled={searchList.length < 2 || isLoading}
        >
          이대로 추천 받기
        </SubmitButton>
      </Footer>
      {isLoading && (
        <SearchLoading
          phase={loadingPhase}
          recommendationOptions={recommendationOptions}
        />
      )}
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px 19px 20px;
  min-height: 100dvh;
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const BackButton = styled.button`
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: 0 0 12px -10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 2px;
  }
`;

const Title = styled.h1`
  margin-bottom: 12px;
  font-size: 28px;
  font-weight: 700;
  line-height: 43px;
  text-align: center;
  white-space: pre-line;
  @media (max-width: 359px) {
    font-size: 24px;
    line-height: 1.5;
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 12px;
  border: 1px solid var(--text-muted);
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background: var(--surface-raised);
  }
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }
`;

const Footer = styled.div`
  margin-top: 24px;
`;

const Hint = styled.p`
  margin-bottom: 10px;
  text-align: center;
  color: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
  font-size: 13px;
  line-height: 1.5;
`;

const SubmitButton = styled(FloatingButton)`
  width: 100%;
  min-height: 48px;
  border-radius: 10px;
  background: var(--primary);
  color: var(--button-text-on-primary);
  font-size: 16px;
  font-weight: 600;
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }
`;
