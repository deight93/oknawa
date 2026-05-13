'use client';

import { useRouter } from 'next/navigation';

import useModal from '@/hooks/common/useModal';
import useHostControlFlow from '@/hooks/result/useHostControlFlow';
import useKakaoShare from '@/hooks/result/useKakaoShare';

import { convertToKoreanTime } from '@/utils/date';

import { ShareIcon } from '@/assets/icons/Share';
import { HomeIcon } from '@/assets/icons/Home';
import Button from '@/components/Button';

import { useResetAtom } from 'jotai/utils';
import { modalState } from '@/jotai/global/store';

import {
  Container,
  ArrivalTime,
  AverageArrivalTime,
  ExpandBody,
  ContentWrapper,
  Header,
  HomeButton,
  SharingButton,
  StationName,
  TitleWrapper,
  HostControlButtonWrapper,
  HostControlPanel,
  HostControlTitle,
} from '../style';

interface DistanceSummaryProps {
  activeMapId: string;
  stationName: string;
  shareKey: string;
  averageTravelTime: number;
}

export default function DistanceSummary({
  activeMapId,
  stationName,
  shareKey,
  averageTravelTime,
}: DistanceSummaryProps) {
  const router = useRouter();

  const { shareConfirmedResult } = useKakaoShare();
  const { canManage, requestCancelConfirm, requestResetVote } =
    useHostControlFlow(activeMapId);

  const reset = useResetAtom(modalState);

  const { setModalContents } = useModal();
  const averageTravelTimeLabel = convertToKoreanTime(averageTravelTime);

  const handleKakaoSharingBtnClick = () => {
    shareConfirmedResult(stationName, shareKey);
  };

  const clickHome = () => {
    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '확인',
      contents: '홈으로 돌아가시겠어요?',
      onConfirm: goToHome,
    });
  };

  const goToHome = () => {
    router.push('/');
    reset();
  };

  return (
    <Container>
      <Header>
        <HomeButton onClick={clickHome}>
          <HomeIcon />
        </HomeButton>
        <SharingButton onClick={handleKakaoSharingBtnClick}>
          <ShareIcon />
          공유하기
        </SharingButton>
      </Header>
      <ExpandBody>
        <ContentWrapper>
          <TitleWrapper>
            <StationName>{stationName}을 추천해요</StationName>
            <AverageArrivalTime>
              도착하는데 평균{' '}
              <ArrivalTime>{averageTravelTimeLabel}</ArrivalTime> 걸려요!
            </AverageArrivalTime>
          </TitleWrapper>
        </ContentWrapper>
        {canManage && (
          <HostControlPanel>
            <HostControlTitle>방장 관리</HostControlTitle>
            <HostControlButtonWrapper>
              <Button
                label="재투표 시작"
                size="small"
                onClick={requestResetVote}
                $widthFull
              />
              <Button
                label="확정 취소"
                size="small"
                onClick={requestCancelConfirm}
                $widthFull
              />
            </HostControlButtonWrapper>
          </HostControlPanel>
        )}
      </ExpandBody>
    </Container>
  );
}
