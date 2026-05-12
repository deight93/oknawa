'use client';

import { useEffect, useState } from 'react';

import { usePlaceSearchMapIdQuery } from '@/hooks/query/search';
import useDistanceSummary from '@/hooks/useDistanceSummary';

import { useAtom, useSetAtom } from 'jotai';
import { resultState } from '@/jotai/result/store';
import { mapIdState } from '@/jotai/mapId/store';
import { bottomSheetState } from '@/jotai/global/store';

import styled from 'styled-components';
import DistanceSummary from './components/DistanceSummary';
import HotPlaceModal from './components/HotPlaceModal';
import ResultMap from './components/ResultMap';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@nextui-org/react';
import { DistanceSummaryItem } from '@/types/location';

export default function ResultBody() {
  const router = useRouter();
  const queryMapId = useSearchParams().get('mapId');

  const [mapIdInfo] = useAtom(mapIdState);
  const setBottomSheet = useSetAtom(bottomSheetState);
  const setResult = useSetAtom(resultState);

  const [currentIndex, setCurrentIndex] = useState(0);

  const { distanceSummaries, participants } = useDistanceSummary();

  const currentStation = distanceSummaries[currentIndex];
  const activeMapId = (mapIdInfo.mapId || queryMapId) ?? '';

  const { data, isLoading, clearRefetchInterval } =
    usePlaceSearchMapIdQuery(activeMapId);

  useEffect(() => {
    if (data) {
      setResult(data);
    }
  }, [data, setResult]);

  useEffect(() => {
    if (queryMapId) localStorage.removeItem('isVote');
  }, [queryMapId]);

  useEffect(() => {
    if (data?.confirmed) {
      clearRefetchInterval();
    }
  }, [data, clearRefetchInterval]);

  useEffect(() => {
    if (currentIndex >= distanceSummaries.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, distanceSummaries.length]);

  const handleNext = () => {
    setCurrentIndex(prevIndex => (prevIndex + 1) % distanceSummaries.length);
  };

  const handlePrev = () => {
    setCurrentIndex(
      prevIndex =>
        (prevIndex - 1 + distanceSummaries.length) % distanceSummaries.length,
    );
  };

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
          stationIndex={`0${currentIndex + 1}`}
          stationLength={`0${distanceSummaries.length}`}
          stationName={currentStation.stationName}
          stationParticipants={currentStation.stationParticipants}
          shareKey={currentStation.shareKey}
          vote={currentStation.vote}
          onNext={handleNext}
          onPrev={handlePrev}
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
