'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import styled from 'styled-components';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { Link, CirclePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button as FloatingButton } from '@nextui-org/react';

import PageHeader from '@/components/PageHeader';
import { SearchState, searchState } from '@/jotai/global/store';
import { useInputStatusListQuery } from '@/hooks/query/search';
import PeopleCard, { ParticipantRow } from './components/PeopleCard';
import DepartureEditor from './components/DepartureEditor';
import Button, { buttonFeedback } from '@/components/Button';
import { APP_BASE_URL } from '@/config/env';
import SearchLoading from './components/SearchLoading';
import MeetingPurposeSelector from './components/MeetingPurposeSelector';
import RecommendationOptionSelector from './components/RecommendationOptionSelector';
import MeetingDestinationField from './components/MeetingDestinationField';
import { participantEditCapabilityState, roomState } from '@/jotai/global/room';
import { Participant } from '@/types/location';
import useCreateResultFlow from '@/hooks/search/useCreateResultFlow';
import { MeetingPurpose } from '@/types/meetingPurpose';
import SearchService from '@/services/search/SearchService';
import { RoomRecommendationRun } from '@/services/search/types';
import {
  DEFAULT_RECOMMENDATION_OPTIONS,
  RecommendationOptions,
  TravelMode,
  isTravelMode,
} from '@/types/recommendationOptions';

const toRecommendationOptions = (
  value: unknown,
): RecommendationOptions | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (
    'travelMode' in value &&
    'midpointBasis' in value &&
    (isTravelMode(value.travelMode) || value.travelMode === 'mixed') &&
    (value.midpointBasis === 'time' || value.midpointBasis === 'distance')
  ) {
    return {
      travelMode: value.travelMode,
      midpointBasis: value.midpointBasis,
    };
  }

  return undefined;
};

export default function SearchCompleteListWithTogetherView() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();

  const setSearchList = useSetAtom(searchState);
  const [storageRoomData, setStorageRoomData] = useAtom(roomState);
  const [editing, setEditing] = useState<{
    roomId: string;
    participantId: number;
  } | null>(null);
  const [meetingPurpose, setMeetingPurpose] = useState<MeetingPurpose>();
  const [changingDestinationRoom, setChangingDestinationRoom] = useState<
    string | null
  >(null);
  const changingDestination =
    changingDestinationRoom === storageRoomData.roomId;
  const [recommendationOptions, setRecommendationOptions] =
    useState<RecommendationOptions>(DEFAULT_RECOMMENDATION_OPTIONS);
  const { requestResult, isLoading, loadingPhase } = useCreateResultFlow(
    storageRoomData.roomId,
  );

  const { data: roomStatus, participant: participants } =
    useInputStatusListQuery(storageRoomData.roomId || '');
  const participantList = participants ?? [];
  const destination = roomStatus?.meeting_destination;
  const participantCapabilities = useAtomValue(
    useMemo(
      () =>
        atom(
          get =>
            new Map(
              (participants ?? []).map(({ id }) => [
                id,
                get(participantEditCapabilityState(storageRoomData.roomId, id)),
              ]),
            ),
        ),
      [participants, storageRoomData.roomId],
    ),
  );
  const isHost = Boolean(storageRoomData.hostId);
  const isRoomGenerating = roomStatus?.recommendation_status === 'generating';
  const isRoomFailed = roomStatus?.recommendation_status === 'failed';
  const resultMapId = roomStatus
    ? roomStatus.result_map_id
    : storageRoomData.resultMapId;
  const roomRecommendationOptions =
    toRecommendationOptions(roomStatus?.recommendation_options) ??
    recommendationOptions;
  const roomTravelMode = isTravelMode(roomRecommendationOptions.travelMode)
    ? roomRecommendationOptions.travelMode
    : 'transit';
  const shouldShowLoading = isLoading || isRoomGenerating;
  const canEdit =
    Boolean(roomStatus) &&
    !shouldShowLoading &&
    !resultMapId &&
    roomStatus?.recommendation_status !== 'completed';
  const editingParticipantId =
    editing?.roomId === storageRoomData.roomId ? editing.participantId : null;
  const layoutDependency = `${storageRoomData.roomId}:${participantList
    .map(participant => participant.id)
    .join(',')}:${editingParticipantId}`;

  useEffect(() => {
    setChangingDestinationRoom(null);
  }, [storageRoomData.roomId]);

  useEffect(() => {
    if (!resultMapId) return;

    setStorageRoomData(prevState => ({
      ...prevState,
      resultMapId,
    }));
    router.replace(`/result?mapId=${resultMapId}`);
  }, [resultMapId, router, setStorageRoomData]);

  const toSearchState = (
    participant: Participant,
    fallbackMode: TravelMode,
  ): SearchState => ({
    name: participant.name,
    travelMode: participant.travel_mode ?? fallbackMode,
    address: {
      fullAddress: participant.full_address ?? participant.region_name,
      latitude: participant.start_y,
      longitude: participant.start_x,
      regionName: participant.region_name,
    },
  });

  const handleInviteBtnClick = () => {
    navigator.clipboard
      .writeText(
        `${APP_BASE_URL}/search/together?roomId=${storageRoomData.roomId}`,
      )
      .then(() => {
        toast.success('링크가 복사되었습니다.');
      });
  };

  const handleAddBtnClick = () => {
    if (!isHost) {
      return toast.error('방장의 권한입니다.');
    }

    setSearchList(
      participantList.map(participant =>
        toSearchState(participant, roomTravelMode),
      ),
    );
    router.push('/search/together');
  };

  const handleSearchBtnClick = () => {
    if (
      editingParticipantId !== null ||
      shouldShowLoading ||
      changingDestination ||
      !roomStatus ||
      participantList.length < (destination ? 1 : 2)
    )
      return;
    if (!isHost) {
      return toast.error('방장의 권한입니다.');
    }

    const selectedTravelMode = isTravelMode(recommendationOptions.travelMode)
      ? recommendationOptions.travelMode
      : 'transit';
    const transformedParticipants = participantList.map(participant =>
      toSearchState(participant, selectedTravelMode),
    );
    let run: RoomRecommendationRun | undefined;

    setStorageRoomData(prevState => ({
      ...prevState,
      resultMapId: undefined,
    }));

    requestResult(
      transformedParticipants,
      meetingPurpose,
      {
        destinationRequest: destination
          ? () => {
              if (!run?.meeting_destination)
                throw new Error(
                  '모임 장소가 변경됐어요. 목록을 새로고침하고 다시 시도해주세요.',
                );
              return {
                roomContext: {
                  roomId: storageRoomData.roomId,
                  hostId: storageRoomData.hostId,
                  runId: run.recommendation_run_id,
                },
              };
            }
          : undefined,
        beforeCreate: async () => {
          run = await SearchService.startRoomRecommendation(
            storageRoomData.roomId,
            storageRoomData.hostId,
            destination ? undefined : meetingPurpose,
            destination ? undefined : recommendationOptions,
          );
          return run.participant.map(participant =>
            toSearchState(participant, selectedTravelMode),
          );
        },
        onReady: async data => {
          if (!run)
            throw new Error(
              '추천 실행 정보를 찾을 수 없습니다. 다시 시도해주세요.',
            );
          await SearchService.completeRoomRecommendation(
            storageRoomData.roomId,
            storageRoomData.hostId,
            data.map_id,
            run.recommendation_run_id,
          );
        },
        onError: async () => {
          if (!run) return;
          await SearchService.failRoomRecommendation(
            storageRoomData.roomId,
            storageRoomData.hostId,
            run.recommendation_run_id,
          );
        },
      },
      recommendationOptions,
    );
  };

  const handleQuiteRoomBtnClick = () => {
    router.push('/');
    setStorageRoomData({ roomId: '', hostId: '' });
  };

  return (
    <Container>
      <Wrapper>
        <PageHeader onBack={() => router.push('/')} />
        <Section>
          <TitleBox>
            <Title>{'입력이 완료된\n출발지 목록입니다.'}</Title>
            <Desc>링크를 공유하고 팀원들을 초대해보세요.</Desc>
          </TitleBox>
        </Section>
        {destination && (
          <MeetingDestinationField
            key={storageRoomData.roomId}
            destination={destination}
            disabled={!canEdit || editingParticipantId !== null}
            onBusyChange={busy =>
              setChangingDestinationRoom(previous =>
                busy
                  ? storageRoomData.roomId
                  : previous === storageRoomData.roomId
                    ? null
                    : previous,
              )
            }
            onChange={
              isHost
                ? async next => {
                    await SearchService.updateMeetingDestination(
                      storageRoomData.roomId,
                      storageRoomData.hostId,
                      next,
                    );
                    await queryClient.invalidateQueries({
                      queryKey: ['inputStatusList', storageRoomData.roomId],
                    });
                  }
                : undefined
            }
          />
        )}
        <div className="flex flex-col gap-3">
          {participantList.map((participant, index) => {
            return (
              <ParticipantRow
                key={`${storageRoomData.roomId}:${participant.id ?? index}`}
                layoutDependency={layoutDependency}
              >
                <PeopleCard
                  name={participant.name}
                  place={participant.region_name}
                  index={index}
                  type="together"
                  travelMode={participant.travel_mode ?? roomTravelMode}
                  onEdit={
                    canEdit &&
                    editingParticipantId === null &&
                    participantCapabilities.get(participant.id)
                      ? () =>
                          setEditing({
                            roomId: storageRoomData.roomId,
                            participantId: participant.id,
                          })
                      : undefined
                  }
                />
                {canEdit && editingParticipantId === participant.id && (
                  <DepartureEditor
                    key={`${storageRoomData.roomId}:${participant.id}`}
                    initialValue={toSearchState(participant, roomTravelMode)}
                    onCancel={() => setEditing(null)}
                    onSave={async value => {
                      const roomId = storageRoomData.roomId;
                      const token = participantCapabilities.get(participant.id);
                      if (!token)
                        throw new Error(
                          '이 출발지를 등록한 브라우저에서 수정해주세요.',
                        );
                      await SearchService.updateDeparturePoint(
                        roomId,
                        participant.id,
                        token,
                        value,
                      );
                      await queryClient.invalidateQueries({
                        queryKey: ['inputStatusList', roomId],
                      });
                    }}
                  />
                )}
              </ParticipantRow>
            );
          })}
        </div>
        <ButtonWrapper>
          <Button
            label="추가하기"
            onClick={handleAddBtnClick}
            className="flex items-center flex-1"
          >
            <CirclePlus width={20} height={20} />
          </Button>
          <Button
            label="초대하기"
            className="flex items-center flex-1"
            onClick={handleInviteBtnClick}
          >
            <Link width={20} height={20} />
          </Button>
        </ButtonWrapper>
        {isHost && !destination && (
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
        {!isHost && (
          <WaitingText>
            {destination
              ? isRoomFailed
                ? '이동시간 조회에 실패했어요. 방장이 다시 시작할 수 있어요.'
                : '방장이 이동시간을 확인하면 함께 결과로 이동해요.'
              : isRoomFailed
                ? '추천 생성에 실패했어요. 방장이 다시 추천을 시작하면 이동해요.'
                : '방장이 목적을 정하고 추천을 시작하면 자동으로 이동해요.'}
          </WaitingText>
        )}
      </Wrapper>

      <Footer>
        <QuitRoom type="button" onClick={handleQuiteRoomBtnClick}>
          방 나가기
        </QuitRoom>
        <SubmitButton
          disableAnimation={Boolean(reduceMotion)}
          disableRipple
          size="lg"
          color="success"
          onClick={handleSearchBtnClick}
          isDisabled={
            !isHost ||
            participantList.length < (destination ? 1 : 2) ||
            !roomStatus ||
            changingDestination ||
            shouldShowLoading ||
            editingParticipantId !== null
          }
          className="w-full"
        >
          {destination
            ? isHost
              ? '이 장소까지 이동시간 확인하기'
              : '방장 이동시간 확인 대기 중'
            : isHost
              ? '만나기 편한 장소 추천받기'
              : '방장 추천 대기 중'}
        </SubmitButton>
      </Footer>
      {shouldShowLoading && (
        <SearchLoading
          destinationMode={Boolean(destination)}
          phase={loadingPhase}
          recommendationOptions={roomRecommendationOptions}
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
  gap: 12px;
  margin-bottom: 12px;
`;

const TitleBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 24px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  line-height: 1.45;
  white-space: pre-line;
  @media (max-width: 359px) {
    font-size: 24px;
  }
`;

const Desc = styled.p`
  margin-top: 8px;
  font-size: var(--font-body);
  line-height: 1.5;
  word-break: keep-all;
  color: var(--text-secondary);
`;

const ButtonWrapper = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
`;

const SubmitButton = styled(FloatingButton)`
  ${buttonFeedback}
  min-height: 48px;
  height: auto;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--primary);
  color: var(--button-text-on-primary);
  font-weight: 600;
  white-space: normal;
  @media (hover: hover) and (pointer: fine) {
    &:not(:disabled):hover {
      background: var(--primary-hover);
    }
  }
`;

const Footer = styled.div`
  margin-top: 24px;
`;

const QuitRoom = styled.button`
  display: flex;
  margin-left: auto;
  align-items: center;
  min-height: 44px;
  cursor: pointer;
  padding: 8px 0;
  font-size: var(--font-body);
  color: var(--text-secondary);
  ${buttonFeedback}

  @media (hover: hover) and (pointer: fine) {
    &:not(:disabled):hover {
      color: var(--text-primary);
    }
  }
`;

const WaitingText = styled.p`
  color: var(--text-muted);
  line-height: 1.5;
  text-align: center;
`;
