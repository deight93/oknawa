'use client';

import { useEffect } from 'react';
import styled from 'styled-components';
import DistanceSummary from './components/DistanceSummary';
import MeetingMap from '@/components/MeetingMap';

import { useRouter } from 'next/navigation';
import { Button } from '@nextui-org/react';
import useResultPageState from '@/hooks/result/useResultPageState';

interface ResultBodyProps {
  queryMapId: string | null;
}

export default function ResultBody({ queryMapId }: ResultBodyProps) {
  const router = useRouter();
  const {
    activeMapId,
    voteRound,
    confirmedShareKey,
    currentIndex,
    currentStation,
    distanceSummaries,
    participants,
    isLoading,
    sortOption,
    setSortOption,
    handleNext,
    handlePrev,
    handleSelectStation,
  } = useResultPageState(queryMapId);

  useEffect(() => {
    if (!confirmedShareKey) return;

    router.replace(`/result/confirm?sharekey=${confirmedShareKey}`);
  }, [confirmedShareKey, router]);

  if (!currentStation) {
    return (
      <EmptyContainer>
        {activeMapId && isLoading ? (
          <>
            <EmptyTitle>추천 결과를 불러오는 중입니다.</EmptyTitle>
            <EmptyText>잠시만 기다려주세요.</EmptyText>
          </>
        ) : (
          <>
            <EmptyTitle>추천 결과가 없습니다.</EmptyTitle>
            <EmptyText>출발지를 다시 입력한 뒤 추천을 요청해주세요.</EmptyText>
            <Button color="success" size="lg" onClick={() => router.push('/')}>
              다시 검색하기
            </Button>
          </>
        )}
      </EmptyContainer>
    );
  }

  return (
    <>
      <Container>
        <DistanceSummary
          station={currentStation}
          stations={distanceSummaries}
          activeMapId={activeMapId}
          queryMapId={queryMapId}
          sortOption={sortOption}
          onSortChange={setSortOption}
          voteRound={voteRound}
          currentIndex={currentIndex}
          stationIndex={`0${currentIndex + 1}`}
          stationLength={`0${distanceSummaries.length}`}
          stationName={currentStation.stationName}
          stationParticipants={currentStation.stationParticipants}
          shareKey={currentStation.shareKey}
          vote={currentStation.vote}
          onNext={handleNext}
          onPrev={handlePrev}
          onSelectStation={handleSelectStation}
        />
        <MeetingMap
          stationName={currentStation.stationName}
          endX={currentStation.station.end_x}
          endY={currentStation.station.end_y}
          participants={participants}
          itinerary={currentStation.itinerary}
        />
      </Container>
    </>
  );
}

const Container = styled.main`
  position: relative;
  width: 100%;
  height: 100vh;
`;

const EmptyContainer = styled.main`
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
`;

const EmptyTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
`;

const EmptyText = styled.p`
  color: var(--text-subtle);
  line-height: 1.5;
`;
