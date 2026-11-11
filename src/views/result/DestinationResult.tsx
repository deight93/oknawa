'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom, useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import styled from 'styled-components';
import PageHeader from '@/components/PageHeader';
import MeetingMap from '@/components/MeetingMap';
import RouteDetails from '@/components/RouteDetails';
import MeetingDestinationField from '@/views/search/components/MeetingDestinationField';
import useKakaoDirections from '@/hooks/result/useKakaoDirections';
import useRouteInteraction from '@/hooks/result/useRouteInteraction';
import useModal from '@/hooks/common/useModal';
import { useInputStatusListQuery } from '@/hooks/query/search';
import { searchState } from '@/jotai/global/store';
import { roomState } from '@/jotai/global/room';
import { meetingDestinationState } from '@/jotai/meeting/store';
import SearchService from '@/services/search/SearchService';
import { getApiErrorMessage } from '@/api/errors';
import type { LocationResult } from '@/types/location';
import type { MeetingDestination } from '@/types/meetingDestination';
import {
  isTravelMode,
  TRAVEL_MODE_OPTIONS,
} from '@/types/recommendationOptions';
import { buildKakaoDirections } from '@/utils/kakaoDirections';
import { convertToKoreanTime } from '@/utils/date';

interface Props {
  result: LocationResult;
  activeMapId: string;
  activeMapHostId: string;
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export default function DestinationResult({
  result,
  activeMapId,
  activeMapHostId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setModalContents } = useModal();
  const setSearchList = useSetAtom(searchState);
  const setDestination = useSetAtom(meetingDestinationState);
  const [storedRoom, setStoredRoom] = useAtom(roomState);
  const [busy, setBusy] = useState(false);
  const [fieldBusy, setFieldBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<symbol | null>(null);
  const {
    meetingDestination: destination,
    destinationRoom,
    destinationRoutes,
    participant: participants,
    recommendationOptions,
  } = result.request_info;
  const mapItinerary = useMemo(
    () =>
      participants.map((_, index) => {
        const entry = destinationRoutes?.find(
          route => route.participantIndex === index,
        );
        return entry?.status === 'ok' ? entry.route : null;
      }),
    [participants, destinationRoutes],
  );
  const routeKey = JSON.stringify([activeMapId, destination]);
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
    itinerary: mapItinerary,
  });
  const { data: roomStatus } = useInputStatusListQuery(
    destinationRoom?.roomId ?? '',
  );
  const currentRoom =
    roomStatus?.room_id === destinationRoom?.roomId ? roomStatus : undefined;
  const canManage = destinationRoom
    ? storedRoom.roomId === destinationRoom.roomId &&
      isUuid(storedRoom.hostId) &&
      currentRoom?.result_map_id === activeMapId &&
      currentRoom.recommendation_status !== 'generating'
    : Boolean(activeMapHostId);
  const isOutdated = Boolean(
    destinationRoom && currentRoom && currentRoom.result_map_id !== activeMapId,
  );
  const latestMapId =
    isOutdated &&
    currentRoom?.result_map_id &&
    isUuid(currentRoom.result_map_id)
      ? currentRoom.result_map_id
      : null;
  const { openDirections, cancelPendingDirections } =
    useKakaoDirections(activeMapId);

  useEffect(() => {
    setBusy(false);
    setFieldBusy(false);
    setError('');
    return () => {
      pending.current = null;
    };
  }, [activeMapId, activeMapHostId, storedRoom.roomId, storedRoom.hostId]);

  const returnToList = async (selected: MeetingDestination) => {
    if (!canManage || pending.current) return;
    const operation = Symbol();
    pending.current = operation;
    setBusy(true);
    setError('');
    cancelPendingDirections();
    try {
      if (destinationRoom) {
        const { roomId } = destinationRoom;
        const { hostId } = storedRoom;
        // Recheck the snapshot before a host can reset a newer room result.
        const latest = await SearchService.getInputStatusList(roomId);
        if (pending.current !== operation) return;
        if (
          latest?.room_id !== roomId ||
          latest.result_map_id !== activeMapId ||
          latest.recommendation_status === 'generating'
        ) {
          await queryClient.invalidateQueries({
            queryKey: ['inputStatusList', roomId],
          });
          throw new Error(
            '모임 정보가 변경되었어요. 최신 결과를 확인해주세요.',
          );
        }
        await SearchService.updateMeetingDestination(
          roomId,
          hostId,
          selected,
          activeMapId,
        );
        if (pending.current !== operation) return;
        setStoredRoom(previous =>
          previous.roomId === roomId && previous.hostId === hostId
            ? { ...previous, resultMapId: undefined }
            : previous,
        );
        await queryClient.invalidateQueries({
          queryKey: ['inputStatusList', roomId],
        });
        if (pending.current === operation) router.push('/search/list-together');
      } else {
        const fallbackMode = isTravelMode(recommendationOptions?.travelMode)
          ? recommendationOptions.travelMode
          : 'transit';
        setSearchList(
          participants.map(participant => ({
            name: participant.name,
            travelMode: participant.travel_mode ?? fallbackMode,
            address: {
              fullAddress: participant.full_address ?? participant.region_name,
              regionName: participant.region_name,
              latitude: participant.start_y,
              longitude: participant.start_x,
            },
          })),
        );
        setDestination(selected);
        router.push('/meeting/list');
      }
    } catch (cause) {
      if (pending.current === operation)
        setError(
          getApiErrorMessage(
            cause,
            '목록으로 이동하지 못했어요. 다시 시도해주세요.',
          ),
        );
    } finally {
      if (pending.current === operation) {
        pending.current = null;
        setBusy(false);
      }
    }
  };

  const shareResult = async () => {
    try {
      const url = new URL('/result', window.location.href);
      url.searchParams.set('mapId', activeMapId);
      await navigator.clipboard.writeText(url.toString());
      setModalContents({
        buttonLabel: '확인',
        contents: '링크가 복사되었습니다!',
      });
    } catch {
      setError('링크를 복사하지 못했어요. 브라우저 주소를 복사해주세요.');
    }
  };

  if (!destination) return null;

  return (
    <Container>
      <PageHeader home onBack={() => router.push('/')}>
        <Action type="button" onClick={shareResult} disabled={!activeMapId}>
          <Share2 size={18} aria-hidden="true" /> 결과 공유
        </Action>
      </PageHeader>
      <Title>정해진 장소로 모이기</Title>
      <Description>각 출발지에서 모임 장소까지의 이동 경로예요.</Description>
      <MeetingDestinationField
        key={`${activeMapId}:${canManage}`}
        destination={destination}
        onChange={canManage ? returnToList : undefined}
        disabled={busy}
        onBusyChange={setFieldBusy}
      />
      {isOutdated && (
        <Notice>
          <p>이전 장소의 결과예요. 모임 정보가 변경되었어요.</p>
          {latestMapId ? (
            <DirectionsLink
              href={`/result?mapId=${latestMapId}`}
              onClick={cancelPendingDirections}
            >
              최신 결과 보기
            </DirectionsLink>
          ) : (
            <DirectionsLink
              href={
                storedRoom.roomId === destinationRoom?.roomId
                  ? '/search/list-together'
                  : `/search/together?roomId=${destinationRoom?.roomId}`
              }
              onClick={() => {
                cancelPendingDirections();
                if (storedRoom.roomId === destinationRoom?.roomId)
                  setStoredRoom(previous => ({
                    ...previous,
                    resultMapId: undefined,
                  }));
              }}
            >
              모임 목록 확인하기
            </DirectionsLink>
          )}
        </Notice>
      )}
      <MapFrame id="destination-map" aria-label="출발지와 모임 장소 지도">
        <MeetingMap
          routeKey={routeKey}
          stationName={destination.name}
          endX={destination.x}
          endY={destination.y}
          participants={participants}
          itinerary={mapItinerary}
          focusMode="overview"
          selectedParticipantIndex={selectedParticipantIndex}
          onSelectParticipant={selectParticipant}
          isRouteFocused={isRouteFocused}
          selectedTransfer={selectedTransfer}
          onSelectTransfer={stepIndex => selectTransfer(stepIndex, 'map')}
          onShowOverview={showOverview}
        />
      </MapFrame>
      <RouteDetails
        participants={participants}
        itinerary={mapItinerary}
        selectedParticipantIndex={selectedParticipantIndex}
        onSelectParticipant={selectParticipant}
        selectedTransfer={selectedTransfer}
        onSelectTransfer={selectTransfer}
      />
      <SectionTitle>참가자별 예상 이동시간</SectionTitle>
      {destinationRoutes?.some(route => route.status === 'unavailable') && (
        <Description>
          조회 불가인 출발지도 카카오맵에서 길찾기를 확인할 수 있어요.
        </Description>
      )}
      <ParticipantList aria-label="참가자별 이동 시간">
        {participants.map((participant, index) => {
          const entry = destinationRoutes?.find(
            item => item.participantIndex === index,
          );
          const route = entry?.status === 'ok' ? entry.route : undefined;
          const mode =
            [
              route?.travel_mode,
              participant.travel_mode,
              recommendationOptions?.travelMode,
            ].find(isTravelMode) ?? 'transit';
          const directions = buildKakaoDirections(
            participant,
            destination,
            mode,
          );
          const seconds = route?.itinerary.totalTime;
          const time =
            seconds !== undefined && Number.isFinite(seconds) && seconds >= 0
              ? convertToKoreanTime(seconds)
              : '조회 불가';
          return (
            <ParticipantCard key={index}>
              <ParticipantName>{participant.name}</ParticipantName>
              <Description>
                {participant.full_address || participant.region_name}
              </Description>
              <Stats>
                <span>
                  {
                    TRAVEL_MODE_OPTIONS.find(option => option.value === mode)
                      ?.label
                  }
                </span>
                <strong>{time}</strong>
              </Stats>
              {directions ? (
                <Actions>
                  <DirectionsLink
                    href={directions.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={event => openDirections(event, directions)}
                    aria-label={`${index + 1}번 ${participant.name} 출발지에서 모임 장소까지 길찾기`}
                  >
                    카카오맵 길찾기
                  </DirectionsLink>
                  <DirectionsLink
                    href={directions.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={cancelPendingDirections}
                    aria-label={`${index + 1}번 ${participant.name} 출발지 길찾기를 웹에서 보기`}
                  >
                    웹에서 보기
                  </DirectionsLink>
                </Actions>
              ) : (
                <Description>
                  출발지 또는 모임 장소의 좌표를 확인해주세요.
                </Description>
              )}
            </ParticipantCard>
          );
        })}
      </ParticipantList>
      {error && <Notice role="alert">{error}</Notice>}
      {canManage && (
        <Footer>
          <RetryButton
            type="button"
            disabled={busy || fieldBusy}
            aria-busy={busy || fieldBusy}
            onClick={() => {
              if (!fieldBusy) return returnToList(destination);
            }}
          >
            {busy
              ? '목록으로 이동 중…'
              : destinationRoom
                ? '다시 계산하기'
                : '출발지 확인·다시 계산'}
          </RetryButton>
          <Description>
            출발지 목록에서 확인한 뒤 경로를 다시 계산해요.
          </Description>
        </Footer>
      )}
    </Container>
  );
}

const Container = styled.main`
  width: 100%;
  min-width: 0;
  min-height: 100dvh;
  padding: max(12px, env(safe-area-inset-top))
    max(20px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom))
    max(20px, env(safe-area-inset-left));
  background: var(--app-bg);
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1.6;
  overflow-wrap: anywhere;
`;
const Title = styled.h1`
  margin-top: 24px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.45;
`;
const SectionTitle = styled.h2`
  margin-top: 24px;
  font-size: 20px;
  font-weight: 700;
`;
const Description = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
`;
const Action = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--surface);
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;
const MapFrame = styled.div`
  width: 100%;
  height: clamp(200px, 40dvh, 320px);
  margin-top: 12px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--surface-muted);
`;
const ParticipantList = styled.ul`
  display: grid;
  gap: 12px;
  margin-top: 12px;
  list-style: none;
`;
const ParticipantCard = styled.li`
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface);
`;
const ParticipantName = styled.h3`
  font-size: 18px;
  font-weight: 700;
`;
const Stats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  margin: 12px 0;
  font-size: 16px;
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;
const DirectionsLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--surface-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
`;
const Notice = styled.div`
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  font-size: 14px;
  background: var(--surface-muted);
`;
const Footer = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 24px;
`;
const RetryButton = styled(Action)`
  width: 100%;
  min-height: 48px;
  font-size: 16px;
  font-weight: 600;
  background: var(--primary);
  color: var(--button-text-on-primary);
`;
