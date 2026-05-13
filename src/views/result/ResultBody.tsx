'use client';

import { useSetAtom } from 'jotai';
import { bottomSheetState } from '@/jotai/global/store';

import styled from 'styled-components';
import DistanceSummary from './components/DistanceSummary';
import HotPlaceModal from './components/HotPlaceModal';
import ResultMap from './components/ResultMap';

import { useRouter } from 'next/navigation';
import { Button } from '@nextui-org/react';
import useResultPageState from '@/hooks/result/useResultPageState';
import { DistanceSummaryItem } from '@/types/location';

interface ResultBodyProps {
  queryMapId: string | null;
}

export default function ResultBody({ queryMapId }: ResultBodyProps) {
  const router = useRouter();
  const setBottomSheet = useSetAtom(bottomSheetState);
  const {
    activeMapId,
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

  const handleHotplaceBtnClick = (station: DistanceSummaryItem) => {
    setBottomSheet(prevState => ({
      ...prevState,
      isOpen: true,
      title: (
        <>
          <span style={{ fontWeight: '800' }}>{station.stationName}</span>의
          <div>핫플레이스를 추천해요!</div>
        </>
      ),
      contents: <HotPlaceModal station={station} />,
      height: 60,
    }));
  };

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
          queryMapId={queryMapId}
          sortOption={sortOption}
          onSortChange={setSortOption}
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
        <ResultMap
          station={currentStation}
          participants={participants}
          itinerary={currentStation.itinerary}
          stationName={currentStation.stationName}
        />
        <FloatingButton
          radius="full"
          size="lg"
          color="success"
          variant="shadow"
          onClick={() => handleHotplaceBtnClick(currentStation)}
        >
          {currentStation.stationName} 핫플레이스는 어디?
        </FloatingButton>
      </Container>
    </>
  );
}

const Container = styled.main`
  position: relative;
  width: 100%;
  height: 100vh;
`;

const FloatingButton = styled(Button)`
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  font-weight: 600;
  z-index: 2;
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
  color: #777;
  line-height: 1.5;
`;
