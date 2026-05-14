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
  HostControlDescription,
  HostControlPanel,
  HostControlTitle,
} from '../style';
import styled from 'styled-components';

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
  const { canManage, requestCancelConfirm } = useHostControlFlow(activeMapId);

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
            <HostControlTitle>약속 지역 관리</HostControlTitle>
            <HostControlDescription>
              확정을 취소하고 후보 화면으로 돌아가 다시 고를 수 있어요.
            </HostControlDescription>
            <HostControlButtonWrapper>
              <CancelConfirmButton
                label="확정 취소하고 다시 고르기"
                size="large"
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

const CancelConfirmButton = styled(Button)`
  height: 48px;
  border: 1px solid #52525b;
  background-color: transparent;
  color: #f4f4f5;
  font-weight: 800;

  &:hover {
    border-color: #18c964;
    background-color: rgba(24, 201, 100, 0.1);
    color: #18c964;
  }
`;
