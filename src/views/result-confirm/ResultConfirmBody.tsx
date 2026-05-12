'use client';

import { useEffect, useState } from 'react';

import { useAtom, useSetAtom } from 'jotai';
import { bottomSheetState } from '@/jotai/global/store';

import styled from 'styled-components';
import DistanceSummary from './components/DistanceSummary';
import HotPlaceModal from './components/HotPlaceModal';
import ResultMap from './components/ResultMap';

import { useSearchParams } from 'next/navigation';
import { Button } from '@nextui-org/react';

import { usePlaceSearchWithShareKeyMutation } from '@/hooks/mutation/search';
import { resultConfirmState } from '@/jotai/result-confirm/store';

export default function ResultConfirmBody() {
  const shareKey = useSearchParams().get('sharekey');

  const setBottomSheet = useSetAtom(bottomSheetState);
  const [resultConfirm, setResultConfirm] = useAtom(resultConfirmState);
  const [loadFailed, setLoadFailed] = useState(false);

  const { mutate: placeSearchWithShareKey, isPending } =
    usePlaceSearchWithShareKeyMutation();

  const { station_name, share_key, itinerary, request_info, end_x, end_y } =
    resultConfirm;

  const totalTravelTime = itinerary.reduce(
    (sum, itinerary) => sum + itinerary.itinerary.totalTime,
    0,
  );
  const averageTravelTime = itinerary.length
    ? totalTravelTime / itinerary.length
    : 0;
  const stationName = station_name.split(' ')[0];
  const shouldFetchShareResult = Boolean(shareKey && share_key !== shareKey);
  const hasResult =
    Boolean(station_name) &&
    itinerary.length > 0 &&
    Boolean(request_info?.participant?.length) &&
    !shouldFetchShareResult;

  const handleHotplaceBtnClick = (station: any) => {
    setBottomSheet(prevState => ({
      ...prevState,
      isOpen: true,
      title: (
        <>
          <span style={{ fontWeight: '800' }}>{stationName}</span>의
          <div>핫플레이스를 추천해요!</div>
        </>
      ),
      contents: <HotPlaceModal station={station} />,
      height: 60,
    }));
  };

  useEffect(() => {
    if (shouldFetchShareResult && shareKey) {
      setLoadFailed(false);
      placeSearchWithShareKey(shareKey, {
        onSuccess: data => {
          if (data) {
            setResultConfirm(data);
          } else {
            setLoadFailed(true);
          }
        },
        onError: () => {
          setLoadFailed(true);
        },
      });
    }
  }, [
    shareKey,
    shouldFetchShareResult,
    placeSearchWithShareKey,
    setResultConfirm,
  ]);

  if (!hasResult) {
    return (
      <EmptyContainer>
        {shareKey && !loadFailed && (isPending || shouldFetchShareResult) ? (
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
          stationName={stationName}
          shareKey={share_key}
          averageTravelTime={averageTravelTime}
        />
        <ResultMap
          participants={request_info?.participant}
          itinerary={itinerary}
          stationName={station_name}
          end_x={end_x}
          end_y={end_y}
        />

        <FloatingButton
          radius="full"
          size="lg"
          color="success"
          variant="shadow"
          onClick={() => handleHotplaceBtnClick(resultConfirm)}
        >
          {stationName} 핫플레이스는 어디?
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
