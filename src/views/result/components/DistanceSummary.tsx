'use client';

import { useRouter } from 'next/navigation';

import { useState } from 'react';

import { modalState } from '@/jotai/global/store';

import { useResetAtom } from 'jotai/utils';

import useModal from '@/hooks/common/useModal';
import useResultShare from '@/hooks/result/useResultShare';
import useVoteFlow from '@/hooks/result/useVoteFlow';

import { ShareIcon } from '@/assets/icons/Share';
import { HomeIcon } from '@/assets/icons/Home';
import { ChevronLeft } from '@/assets/icons/ChevronLeft';
import { ChevronRight } from '@/assets/icons/ChevronRight';
import { LikeIconInactive } from '@/assets/icons/LikeInactive';
import { LikeIconActive } from '@/assets/icons/LikeActive';

import { ChevronBottom } from '@/assets/icons/ChevronBottom';
import { ChevronTop } from '@/assets/icons/ChevronTop';
import { Clock } from '@/assets/icons/Clock';
import { Check } from '@/assets/icons/Check';

import ButtonPrimary from '@/components/ButtonPrimary';
import Button from '@/components/Button';

import { convertToKoreanTime } from '@/utils/date';
import {
  DistanceSummaryItem,
  Participant,
  ResultSortOption,
} from '@/types/location';

import {
  Container,
  ArrivalTime,
  AverageArrivalTime,
  ExpandBody,
  ButtonWrapper,
  ContentWrapper,
  Count,
  Header,
  HomeButton,
  Indicator,
  IndicatorWrapper,
  Label,
  LikeItem,
  LikeWrapper,
  PreffertWrapper,
  SharingButton,
  StationName,
  TitleWrapper,
  VoteTitle,
  VoteWrapper,
  ChevronButton,
  Tail,
  TailWrapper,
  FoldBody,
  FoldLabel,
  FoldLabelWrapper,
  DividerVertical,
  ChevronWrapper,
  LeftWrapper,
  RightWrapper,
  LikeButton,
  ConfirmButton,
  CompareCard,
  CompareHeader,
  CompareList,
  CompareMetric,
  CompareMetricLabel,
  CompareMetricValue,
  CompareMetrics,
  CompareStationName,
  CompareTitle,
  SortButton,
  SortWrapper,
} from '../style';
import styled from 'styled-components';

const SORT_OPTIONS: { label: string; value: ResultSortOption }[] = [
  { label: '평균 빠른순', value: 'averageTime' },
  { label: '최장 짧은순', value: 'maxTime' },
  { label: '득표 많은순', value: 'vote' },
];

interface DistanceSummaryProps {
  station: DistanceSummaryItem;
  stations: DistanceSummaryItem[];
  queryMapId: string | null;
  sortOption: ResultSortOption;
  onSortChange: (sortOption: ResultSortOption) => void;
  currentIndex: number;
  stationName: string;
  shareKey: string;
  stationIndex: string;
  stationLength: string;
  stationParticipants: Participant[];
  vote: number;
  onNext: () => void;
  onPrev: () => void;
  onSelectStation: (stationIndex: number) => void;
}

export default function DistanceSummary({
  station,
  stations,
  queryMapId,
  sortOption,
  onSortChange,
  currentIndex,
  stationName,
  shareKey,
  stationIndex,
  stationLength,
  stationParticipants,
  vote,
  onNext,
  onPrev,
  onSelectStation,
}: DistanceSummaryProps) {
  const router = useRouter();

  const reset = useResetAtom(modalState);

  const [isExpandTail, setExpandTail] = useState(true);

  const { setModalContents } = useModal();
  const { copyInvitationLink } = useResultShare(queryMapId);
  const { isVote, requestVote, requestConfirm, canConfirm } = useVoteFlow(
    shareKey,
    queryMapId,
  );

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

  const clickTail = () => {
    setExpandTail(!isExpandTail);
  };

  const voteCount = Array(stationParticipants.length)
    .fill(true, 0, vote)
    .fill(false, vote);

  return (
    <Container>
      <Header>
        <HomeButton onClick={clickHome}>
          <HomeIcon />
        </HomeButton>
        <SharingButton onClick={copyInvitationLink}>
          <ShareIcon />
          초대하기
        </SharingButton>
      </Header>
      {isExpandTail ? (
        <ExpandBody>
          <ContentWrapper>
            <TitleWrapper>
              <StationName>{stationName}</StationName>
              <AverageArrivalTime>
                도착하는데 평균{' '}
                <ArrivalTime>
                  {convertToKoreanTime(station.averageTravelTime)}
                </ArrivalTime>{' '}
                걸려요!
              </AverageArrivalTime>
            </TitleWrapper>
            <IndicatorWrapper>
              <ChevronButton onClick={onPrev}>
                <ChevronLeft />
              </ChevronButton>
              <Indicator>
                {stationIndex}/{stationLength}
              </Indicator>
              <ChevronButton onClick={onNext}>
                <ChevronRight />
              </ChevronButton>
            </IndicatorWrapper>
          </ContentWrapper>
          <SortWrapper>
            {SORT_OPTIONS.map(option => (
              <SortButton
                key={option.value}
                type="button"
                $isActive={sortOption === option.value}
                onClick={() => onSortChange(option.value)}
              >
                {option.label}
              </SortButton>
            ))}
          </SortWrapper>
          {stations.length > 1 && (
            <>
              <CompareHeader>
                <CompareTitle>후보 비교</CompareTitle>
                <Label>카드를 누르면 해당 후보로 이동해요.</Label>
              </CompareHeader>
              <CompareList>
                {stations.map((candidate, index) => (
                  <CompareCard
                    key={candidate.shareKey}
                    type="button"
                    $isActive={index === currentIndex}
                    onClick={() => onSelectStation(index)}
                  >
                    <CompareStationName>
                      {index + 1}. {candidate.stationName}
                    </CompareStationName>
                    <CompareMetrics>
                      <CompareMetric>
                        <CompareMetricLabel>평균</CompareMetricLabel>
                        <CompareMetricValue>
                          {convertToKoreanTime(candidate.averageTravelTime)}
                        </CompareMetricValue>
                      </CompareMetric>
                      <CompareMetric>
                        <CompareMetricLabel>최장</CompareMetricLabel>
                        <CompareMetricValue>
                          {convertToKoreanTime(candidate.maxTravelTime)}
                        </CompareMetricValue>
                      </CompareMetric>
                      <CompareMetric>
                        <CompareMetricLabel>득표</CompareMetricLabel>
                        <CompareMetricValue>
                          {candidate.vote}표
                        </CompareMetricValue>
                      </CompareMetric>
                    </CompareMetrics>
                  </CompareCard>
                ))}
              </CompareList>
            </>
          )}
          <PreffertWrapper>
            <VoteWrapper>
              <VoteTitle>
                <Label>선호도 결과</Label>
                <Count>{vote}표</Count>
              </VoteTitle>
              <LikeWrapper>
                {voteCount.map((item: boolean, index: number) => (
                  <LikeItem key={index}>
                    {item ? <LikeIconActive /> : <LikeIconInactive />}
                  </LikeItem>
                ))}
              </LikeWrapper>
            </VoteWrapper>
            <ButtonWrapper>
              <LikeButtonWithVote
                label={'좋아요'}
                onClick={requestVote}
                isVote={isVote}
              >
                {isVote ? <LikeIconActive /> : <LikeIconInactive />}
              </LikeButtonWithVote>
              {canConfirm && (
                <ButtonPrimary label={'확정하기'} onClick={requestConfirm} />
              )}
            </ButtonWrapper>
          </PreffertWrapper>
        </ExpandBody>
      ) : (
        <FoldBody>
          <ContentWrapper $isExpand={isExpandTail}>
            <LeftWrapper>
              <ChevronWrapper onClick={onPrev}>
                <ChevronLeft />
              </ChevronWrapper>
              <TitleWrapper>
                <StationName $isExpand={isExpandTail}>
                  {stationName}
                </StationName>
                <FoldLabelWrapper>
                  <FoldLabel>
                    <Clock />
                    <ArrivalTime $isExpand={isExpandTail}>
                      {convertToKoreanTime(station.averageTravelTime)}
                    </ArrivalTime>
                  </FoldLabel>
                  <DividerVertical />
                  <FoldLabel>
                    <LikeIconInactive />
                    <Count>{vote}표</Count>
                  </FoldLabel>
                </FoldLabelWrapper>
              </TitleWrapper>
            </LeftWrapper>
            <RightWrapper>
              <ButtonWrapper>
                <LikeButton onClick={requestVote}>
                  {isVote ? <LikeIconActive /> : <LikeIconInactive />}
                </LikeButton>
                {canConfirm && (
                  <ConfirmButton onClick={requestConfirm}>
                    <Check />
                  </ConfirmButton>
                )}
              </ButtonWrapper>
              <ChevronWrapper onClick={onNext}>
                <ChevronRight />
              </ChevronWrapper>
            </RightWrapper>
          </ContentWrapper>
        </FoldBody>
      )}

      <TailWrapper>
        <Tail onClick={clickTail}>
          {isExpandTail ? <ChevronTop /> : <ChevronBottom />}
        </Tail>
      </TailWrapper>
    </Container>
  );
}

const LikeButtonWithVote = styled(Button)<{ isVote: boolean }>`
  border: ${({ isVote }) =>
    isVote ? '1px solid var(--primary)' : '1px solid #777780'};
  color: ${({ isVote }) => (isVote ? ' var(--primary)' : '#777780')};
`;
