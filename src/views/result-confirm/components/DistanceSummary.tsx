'use client';

import { useRouter } from 'next/navigation';

import useModal from '@/hooks/common/useModal';
import useHostControlFlow from '@/hooks/result/useHostControlFlow';
import useKakaoShare from '@/hooks/result/useKakaoShare';

import { convertToKoreanTime } from '@/utils/date';
import { getConfirmTitle } from '@/utils/recommendationDisplay';
import { ResultLocationType } from '@/types/location';
import { RecommendationOptions } from '@/types/recommendationOptions';

import { ShareIcon } from '@/assets/icons/Share';
import { HomeIcon } from '@/assets/icons/Home';

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
  RetrySelectButton,
} from '../style';

interface DistanceSummaryProps {
  activeMapId: string;
  stationName: string;
  shareKey: string;
  averageTravelTime: number;
  recommendationOptions?: RecommendationOptions;
  resultType?: ResultLocationType;
}

export default function DistanceSummary({
  activeMapId,
  stationName,
  shareKey,
  averageTravelTime,
  recommendationOptions,
  resultType,
}: DistanceSummaryProps) {
  const router = useRouter();

  const { shareConfirmedResult } = useKakaoShare();
  const { canManage, requestResetVote } = useHostControlFlow(activeMapId);

  const reset = useResetAtom(modalState);

  const { setModalContents } = useModal();
  const averageTravelTimeLabel = convertToKoreanTime(averageTravelTime);
  const title = getConfirmTitle(stationName, recommendationOptions, resultType);

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
            <StationName>{title}</StationName>
            <AverageArrivalTime>
              도착하는데 평균{' '}
              <ArrivalTime>{averageTravelTimeLabel}</ArrivalTime> 걸려요!
            </AverageArrivalTime>
          </TitleWrapper>
          {canManage && (
            <RetrySelectButton type="button" onClick={requestResetVote}>
              다시 고르기
            </RetrySelectButton>
          )}
        </ContentWrapper>
      </ExpandBody>
    </Container>
  );
}
