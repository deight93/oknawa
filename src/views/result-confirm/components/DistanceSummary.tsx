'use client';

import type { ReactNode } from 'react';

import { useRouter } from 'next/navigation';
import { Check, Share2 } from 'lucide-react';

import useModal from '@/hooks/common/useModal';
import useHostControlFlow from '@/hooks/result/useHostControlFlow';
import useKakaoShare from '@/hooks/result/useKakaoShare';

import { convertToKoreanTime } from '@/utils/date';
import { getConfirmTitle } from '@/utils/recommendationDisplay';
import { ResultLocationType } from '@/types/location';
import { RecommendationOptions } from '@/types/recommendationOptions';

import { useResetAtom } from 'jotai/utils';
import { modalState } from '@/jotai/global/store';

import {
  Container,
  ArrivalTime,
  AverageArrivalTime,
  ExpandBody,
  ContentWrapper,
  Header,
  SharingButton,
  StationName,
  TitleWrapper,
  RetrySelectButton,
  ConfirmedLabel,
  SummaryRow,
} from '../style';

interface DistanceSummaryProps {
  children?: ReactNode;
  activeMapId: string;
  stationName: string;
  shareKey: string;
  averageTravelTime: number;
  recommendationOptions?: RecommendationOptions;
  resultType?: ResultLocationType;
}

export default function DistanceSummary({
  children,
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
      <Header home onBack={clickHome} backLabel="홈으로 이동">
        <SharingButton type="button" onClick={handleKakaoSharingBtnClick}>
          <Share2 size={18} aria-hidden="true" />
          공유하기
        </SharingButton>
      </Header>
      <ExpandBody>
        <ContentWrapper>
          <TitleWrapper>
            <StationName>{title}</StationName>
            <ConfirmedLabel>
              <span aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
              장소 확정
            </ConfirmedLabel>
          </TitleWrapper>
          <SummaryRow>
            <AverageArrivalTime>
              도착하는데 평균{' '}
              <ArrivalTime>{averageTravelTimeLabel}</ArrivalTime> 걸려요!
            </AverageArrivalTime>
            {canManage && (
              <RetrySelectButton type="button" onClick={requestResetVote}>
                다시 고르기
              </RetrySelectButton>
            )}
          </SummaryRow>
          {children}
        </ContentWrapper>
      </ExpandBody>
    </Container>
  );
}
