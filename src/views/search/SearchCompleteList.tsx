'use client';

import PageHeader from '@/components/PageHeader';

import { useRouter } from 'next/navigation';

import { useEffect, useRef, useState } from 'react';

import styled from 'styled-components';
import { CirclePlus } from 'lucide-react';

import PeopleCard, { ParticipantRow } from './components/PeopleCard';
import { buttonFeedback } from '@/components/Button';
import DepartureEditor from './components/DepartureEditor';
import SearchLoading from './components/SearchLoading';
import MeetingPurposeSelector from './components/MeetingPurposeSelector';
import RecommendationOptionSelector from './components/RecommendationOptionSelector';

import { useAtom } from 'jotai';
import { meetingDestinationState } from '@/jotai/meeting/store';
import MeetingDestinationField from './components/MeetingDestinationField';
import { searchState, SearchState } from '@/jotai/global/store';
import { useReducedMotion } from 'framer-motion';

import { Button as FloatingButton } from '@nextui-org/react';

import useCreateResultFlow from '@/hooks/search/useCreateResultFlow';
import { MeetingPurpose } from '@/types/meetingPurpose';
import {
  DEFAULT_RECOMMENDATION_OPTIONS,
  RecommendationOptions,
} from '@/types/recommendationOptions';

export default function SearchCompleteList({
  destinationMode = false,
}: {
  destinationMode?: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [searchList, setSearchList] = useAtom(searchState);
  const [destination, setDestination] = useAtom(meetingDestinationState);
  const [changingDestination, setChangingDestination] = useState(false);
  const minimumParticipants = destinationMode ? 1 : 2;
  const [editingParticipantKey, setEditingParticipantKey] = useState<
    string | null
  >(null);
  // UI keys stay local; duplicate names and the stored/request payload stay intact.
  const participantKeys = useRef(new WeakMap<SearchState, string>());
  const nextParticipantKey = useRef(0);
  const rows = searchList.map(search => {
    let key = participantKeys.current.get(search);
    if (key === undefined) {
      key = String(nextParticipantKey.current++);
      participantKeys.current.set(search, key);
    }
    return { key, search };
  });
  const editingKey = rows.some(row => row.key === editingParticipantKey)
    ? editingParticipantKey
    : null;
  const layoutDependency = `${rows.map(row => row.key).join(',')}:${editingKey}`;
  const [meetingPurpose, setMeetingPurpose] = useState<MeetingPurpose>();
  const [recommendationOptions, setRecommendationOptions] =
    useState<RecommendationOptions>(DEFAULT_RECOMMENDATION_OPTIONS);
  const { requestResult, isLoading, loadingPhase } = useCreateResultFlow();

  const handleSearchBtnClick = () => {
    if (
      editingKey !== null ||
      isLoading ||
      changingDestination ||
      searchList.length < minimumParticipants ||
      (destinationMode && !destination)
    )
      return;
    requestResult(
      searchList,
      destinationMode ? undefined : meetingPurpose,
      undefined,
      recommendationOptions,
      destinationMode && destination
        ? { meetingDestination: destination }
        : undefined,
    );
  };

  const updateParticipant = (
    key: string,
    update: (person: SearchState) => SearchState,
  ) => {
    setSearchList(list =>
      list.map(person => {
        if (participantKeys.current.get(person) !== key) return person;
        const next = update(person);
        participantKeys.current.set(next, key);
        return next;
      }),
    );
  };

  const handleDeleteIconClick = (key: string) => {
    setSearchList(list =>
      list.filter(person => participantKeys.current.get(person) !== key),
    );
  };

  useEffect(() => {
    const image = new Image();
    image.src = '/loading.gif';
  }, []);

  return (
    <Container>
      <Wrapper>
        <PageHeader
          onBack={() => router.back()}
          backLabel="이전 화면으로 돌아가기"
        />
        <Section>
          <Title>
            {searchList.length === 0
              ? '함께 만날 친구들의\n출발지를 추가해주세요.'
              : '입력이 완료된\n출발지 목록입니다.'}
          </Title>
          {destinationMode && destination && (
            <MeetingDestinationField
              destination={destination}
              onChange={value => setDestination(value)}
              disabled={isLoading || editingKey !== null}
              onBusyChange={setChangingDestination}
            />
          )}
          {destinationMode && !destination && (
            <Hint>
              모임 장소를 먼저 선택해주세요.{' '}
              <button
                type="button"
                className="min-h-11 underline"
                onClick={() => router.push('/meeting')}
              >
                장소 선택하기
              </button>
            </Hint>
          )}
          {rows.map(({ search, key }, index) => {
            return (
              <ParticipantRow key={key} layoutDependency={layoutDependency}>
                <PeopleCard
                  name={search.name}
                  place={search.address.regionName}
                  index={index}
                  travelMode={search.travelMode ?? 'transit'}
                  onEdit={
                    editingKey === null && !isLoading
                      ? () => setEditingParticipantKey(key)
                      : undefined
                  }
                  onTravelModeChange={
                    editingKey === null && !isLoading
                      ? mode =>
                          updateParticipant(key, person => ({
                            ...person,
                            travelMode: mode,
                          }))
                      : undefined
                  }
                  onDeleteIconClick={
                    editingKey === null && !isLoading
                      ? () => handleDeleteIconClick(key)
                      : undefined
                  }
                />
                {editingKey === key && (
                  <DepartureEditor
                    initialValue={search}
                    onCancel={() => setEditingParticipantKey(null)}
                    onSave={value => {
                      updateParticipant(key, () => value);
                    }}
                  />
                )}
              </ParticipantRow>
            );
          })}
        </Section>
        <AddButton
          type="button"
          disabled={editingKey !== null || isLoading}
          onClick={() =>
            router.push(
              destinationMode ? '/meeting/individual' : '/search/individual',
            )
          }
        >
          출발지 추가하기 <CirclePlus size={18} aria-hidden="true" />
        </AddButton>
        {!destinationMode && (
          <>
            <MeetingPurposeSelector
              value={meetingPurpose}
              onChange={setMeetingPurpose}
            />
            <RecommendationOptionSelector
              value={recommendationOptions}
              onChange={setRecommendationOptions}
            />
          </>
        )}
      </Wrapper>
      <Footer>
        {searchList.length < minimumParticipants && (
          <Hint>
            {destinationMode
              ? '이동시간을 확인할 출발지를 추가해주세요.'
              : '추천을 받으려면 출발지를 두 곳 이상 추가해주세요.'}
          </Hint>
        )}
        <SubmitButton
          disableAnimation={Boolean(reduceMotion)}
          disableRipple
          size="lg"
          color="success"
          onClick={handleSearchBtnClick}
          isDisabled={
            searchList.length < minimumParticipants ||
            isLoading ||
            editingKey !== null ||
            changingDestination ||
            (destinationMode && !destination)
          }
        >
          {destinationMode
            ? '이 장소까지 이동시간 확인하기'
            : '이대로 추천 받기'}
        </SubmitButton>
      </Footer>
      {isLoading && (
        <SearchLoading
          destinationMode={destinationMode}
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
  padding: max(12px, env(safe-area-inset-top))
    max(20px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom))
    max(20px, env(safe-area-inset-left));
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

const Title = styled.h1`
  margin-top: 24px;
  margin-bottom: 12px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.45;
  text-align: left;
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
  ${buttonFeedback}
  @media (hover: hover) and (pointer: fine) {
    &:not(:disabled):hover {
      background: var(--surface-raised);
      border-color: var(--text-primary);
    }
  }
  &:disabled {
    color: var(--text-muted);
    border-color: var(--border);
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
  font-size: var(--font-body);
  line-height: 1.5;
`;

const SubmitButton = styled(FloatingButton)`
  ${buttonFeedback}
  width: 100%;
  min-height: 48px;
  border-radius: 10px;
  background: var(--primary);
  color: var(--button-text-on-primary);
  font-size: 16px;
  font-weight: 600;
  @media (hover: hover) and (pointer: fine) {
    &:not(:disabled):hover {
      background: var(--primary-hover);
    }
  }
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }
`;
