'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useAtom, useSetAtom } from 'jotai';
import { Link, CirclePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button as FloatingButton } from '@nextui-org/react';

import { ArrowBackIcon } from '@/assets/icons/ArrowBack';
import { SearchState, searchState } from '@/jotai/global/store';
import { useInputStatusListQuery } from '@/hooks/query/search';
import PeopleCard from './components/PeopleCard';
import Button from '@/components/Button';
import { APP_BASE_URL } from '@/config/env';
import SearchLoading from './components/SearchLoading';
import MeetingPurposeSelector from './components/MeetingPurposeSelector';
import RecommendationOptionSelector from './components/RecommendationOptionSelector';
import { roomState } from '@/jotai/global/room';
import { Participant } from '@/types/location';
import useCreateResultFlow from '@/hooks/search/useCreateResultFlow';
import { MeetingPurpose } from '@/types/meetingPurpose';
import SearchService from '@/services/search/SearchService';
import {
  DEFAULT_RECOMMENDATION_OPTIONS,
  RecommendationOptions,
} from '@/types/recommendationOptions';

export default function SearchCompleteListWithTogetherView() {
  const router = useRouter();

  const setSearchList = useSetAtom(searchState);
  const [storageRoomData, setStorageRoomData] = useAtom(roomState);
  const [meetingPurpose, setMeetingPurpose] = useState<MeetingPurpose>();
  const [recommendationOptions, setRecommendationOptions] =
    useState<RecommendationOptions>(DEFAULT_RECOMMENDATION_OPTIONS);
  const { requestResult, isLoading, loadingPhase } = useCreateResultFlow();

  const { data: roomStatus, participant: participants } =
    useInputStatusListQuery(storageRoomData.roomId || '');
  const participantList = (participants ?? []) as Participant[];
  const isHost = Boolean(storageRoomData.hostId);
  const isRoomGenerating = roomStatus?.recommendation_status === 'generating';
  const isRoomFailed = roomStatus?.recommendation_status === 'failed';
  const resultMapId = roomStatus
    ? roomStatus.result_map_id
    : storageRoomData.resultMapId;
  const shouldShowLoading = isLoading || isRoomGenerating;

  useEffect(() => {
    if (!resultMapId) return;

    setStorageRoomData(prevState => ({
      ...prevState,
      resultMapId,
    }));
    router.replace(`/result?mapId=${resultMapId}`);
  }, [resultMapId, router, setStorageRoomData]);

  const toSearchState = (participant: Participant): SearchState => ({
    name: participant.name,
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

    setSearchList(participantList.map(toSearchState));
    router.push('/search/together');
  };

  const handleSearchBtnClick = () => {
    if (!isHost) {
      return toast.error('방장의 권한입니다.');
    }

    const transformedParticipants: SearchState[] =
      participantList.map(toSearchState);

    setStorageRoomData(prevState => ({
      ...prevState,
      resultMapId: undefined,
    }));

    requestResult(
      transformedParticipants,
      meetingPurpose,
      {
        beforeCreate: () =>
          SearchService.startRoomRecommendation(
            storageRoomData.roomId,
            storageRoomData.hostId,
            meetingPurpose,
          ),
        onReady: async data => {
          await SearchService.completeRoomRecommendation(
            storageRoomData.roomId,
            storageRoomData.hostId,
            data.map_id,
          );
          setStorageRoomData(prevState => ({
            ...prevState,
            resultMapId: data.map_id,
          }));
        },
        onError: () =>
          SearchService.failRoomRecommendation(
            storageRoomData.roomId,
            storageRoomData.hostId,
          ),
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
        <IconBox onClick={() => router.push('/')}>
          <ArrowBackIcon />
        </IconBox>
        <Section>
          <TitleBox>
            <Title>입력이 완료된</Title>
            <Title>출발지 목록입니다.</Title>
            <Desc>링크를 공유하고 팀원들을 초대해보세요.</Desc>
          </TitleBox>
        </Section>
        <div className="flex flex-col gap-3">
          {participantList.map((participant, index) => {
            return (
              <PeopleCard
                key={index}
                name={participant.name}
                place={participant.region_name}
                index={index}
                type="together"
              />
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
        {isHost && (
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
            {isRoomFailed
              ? '추천 생성에 실패했어요. 방장이 다시 추천을 시작하면 이동해요.'
              : '방장이 목적을 정하고 추천을 시작하면 자동으로 이동해요.'}
          </WaitingText>
        )}
      </Wrapper>

      <div>
        <QuitRoom onClick={handleQuiteRoomBtnClick}>방 나가기</QuitRoom>
        <SubmitButton
          size="lg"
          color="success"
          onClick={handleSearchBtnClick}
          isDisabled={
            !isHost || participantList.length < 2 || shouldShowLoading
          }
          className="w-full"
        >
          {isHost ? '만나기 편한 장소 추천받기' : '방장 추천 대기 중'}
        </SubmitButton>
      </div>
      {shouldShowLoading && <SearchLoading phase={loadingPhase} />}
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 35px 19px 20px;
  min-height: 100dvh;
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 13px;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 13px;
  margin-bottom: 20px;
`;

const IconBox = styled.div`
  width: 50px;
  margin-bottom: 20px;
  cursor: pointer;
`;

const TitleBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  line-height: 43px;
`;

const Desc = styled.p`
  margin-top: 5px;
  color: #8d8d94;
`;

const ButtonWrapper = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
`;

const SubmitButton = styled(FloatingButton)`
  font-weight: 600;
`;

const QuitRoom = styled.div`
  display: flex;
  justify-content: flex-end;
  cursor: pointer;
  padding-bottom: 10px;
  font-size: 13px;
  color: #b91c1c;

  &:hover {
    opacity: 0.7;
  }
`;

const WaitingText = styled.p`
  color: #8d8d94;
  line-height: 1.5;
  text-align: center;
`;
