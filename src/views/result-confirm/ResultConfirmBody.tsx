'use client';

import { useSetAtom } from 'jotai';
import { bottomSheetState } from '@/jotai/global/store';

import styled from 'styled-components';
import DistanceSummary from './components/DistanceSummary';
import HotPlaceModal from '@/components/HotPlaceModal';
import MeetingMap from '@/components/MeetingMap';
import RouteDetails from '@/components/RouteDetails';

import { Button } from '@nextui-org/react';

import useConfirmedResult from '@/hooks/result/useConfirmedResult';
import useRouteInteraction from '@/hooks/result/useRouteInteraction';
import { isCarRecommendation } from '@/utils/recommendationDisplay';

interface ResultConfirmBodyProps {
  queryShareKey: string | null;
}

export default function ResultConfirmBody({
  queryShareKey,
}: ResultConfirmBodyProps) {
  const setBottomSheet = useSetAtom(bottomSheetState);
  const {
    resultConfirm,
    stationName,
    shareKey,
    averageTravelTime,
    recommendationOptions,
    resultType,
    hasResult,
    isLoading,
  } = useConfirmedResult(queryShareKey);

  const { itinerary, request_info, end_x, end_y } = resultConfirm;
  const participants = request_info?.participant ?? [];
  const routeKey = JSON.stringify([
    resultConfirm.map_id,
    shareKey,
    end_x,
    end_y,
  ]);
  const {
    selectedParticipantIndex,
    isRouteFocused,
    selectedTransfer,
    selectParticipant,
    selectTransfer,
    showOverview,
  } = useRouteInteraction({
    resultKey: routeKey,
    participants,
    itinerary,
  });
  const shouldShowHotPlaceButton = !isCarRecommendation(recommendationOptions);

  const handleHotplaceBtnClick = () => {
    setBottomSheet(prevState => ({
      ...prevState,
      isOpen: true,
      title: <NearbyTitle>{stationName} 주변 장소</NearbyTitle>,
      contents: (
        <HotPlaceModal x={resultConfirm.end_x} y={resultConfirm.end_y} />
      ),
      height: 60,
      isFullContents: false,
    }));
  };

  if (!hasResult) {
    return (
      <EmptyContainer>
        {isLoading ? (
          <>
            <EmptyTitle>확정된 장소를 불러오는 중입니다.</EmptyTitle>
            <EmptyText>잠시만 기다려주세요.</EmptyText>
          </>
        ) : (
          <>
            <EmptyTitle>확정된 장소를 찾을 수 없습니다.</EmptyTitle>
            <EmptyText>공유 링크를 다시 확인해주세요.</EmptyText>
          </>
        )}
      </EmptyContainer>
    );
  }

  return (
    <>
      <Container>
        <DistanceSummary
          activeMapId={resultConfirm.map_id || ''}
          stationName={stationName}
          shareKey={shareKey}
          averageTravelTime={averageTravelTime}
          recommendationOptions={recommendationOptions}
          resultType={resultType}
        >
          <RouteDetails
            participants={participants}
            itinerary={itinerary}
            selectedParticipantIndex={selectedParticipantIndex}
            onSelectParticipant={selectParticipant}
            selectedTransfer={selectedTransfer}
            onSelectTransfer={selectTransfer}
          />
        </DistanceSummary>
        <MapBackground>
          <MeetingMap
            routeKey={routeKey}
            stationName={stationName}
            endX={end_x}
            endY={end_y}
            participants={request_info?.participant}
            itinerary={itinerary}
            selectedParticipantIndex={selectedParticipantIndex}
            onSelectParticipant={selectParticipant}
            isRouteFocused={isRouteFocused}
            selectedTransfer={selectedTransfer}
            onSelectTransfer={stepIndex => selectTransfer(stepIndex, 'map')}
            onShowOverview={showOverview}
          />
          {shouldShowHotPlaceButton && (
            <FloatingButton
              radius="md"
              size="lg"
              color="success"
              variant="solid"
              onClick={handleHotplaceBtnClick}
            >
              {stationName} 주변 장소 보기
            </FloatingButton>
          )}
        </MapBackground>
      </Container>
    </>
  );
}

const Container = styled.main`
  position: relative;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  width: 100%;
  height: 100vh;
  height: 100dvh;

  @media (orientation: landscape) and (max-height: 500px) {
    flex-direction: row;
  }
`;

const MapBackground = styled.div`
  position: relative;
  flex: 1;
  min-height: 180px;
  min-width: 0;
`;

const FloatingButton = styled(Button)`
  position: absolute;
  bottom: max(20px, env(safe-area-inset-bottom));
  left: max(20px, env(safe-area-inset-left));
  right: max(20px, env(safe-area-inset-right));
  margin: 0 auto;
  font-weight: 600;
  max-width: calc(min(100vw, 500px) - 40px);
  min-height: 48px;
  height: auto;
  padding: 12px 24px;
  white-space: normal;
  text-align: center;
  line-height: 1.45;
  background-color: var(--primary);
  color: var(--button-text-on-primary);
  box-shadow: none;
  z-index: 2;

  &:focus-visible {
    outline: 2px solid var(--text-primary);
    outline-offset: 4px;
  }
`;

const NearbyTitle = styled.h2`
  font-size: 22px;
  line-height: 1.35;
  font-weight: 700;
  word-break: keep-all;
  overflow-wrap: anywhere;
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
