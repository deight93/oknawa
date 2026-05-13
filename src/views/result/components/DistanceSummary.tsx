'use client';

import { useRouter } from 'next/navigation';

import { useState } from 'react';

import { modalState } from '@/jotai/global/store';

import { useResetAtom } from 'jotai/utils';

import useModal from '@/hooks/common/useModal';
import useHostControlFlow from '@/hooks/result/useHostControlFlow';
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
  HostControlButtonWrapper,
  HostControlPanel,
  HostControlTitle,
  DividerVertical,
  ChevronWrapper,
  LeftWrapper,
  RightWrapper,
  LikeButton,
  ConfirmButton,
  ConditionBadge,
  ConditionBadgeList,
  CompareCard,
  CompareBadgeList,
  CompareHeader,
  CompareList,
  CompareMetric,
  CompareMetricLabel,
  CompareMetricValue,
  CompareMetrics,
  CompareStationName,
  CompareTitle,
  PreferenceDescription,
  PreferenceHeader,
  PreferencePanel,
  PreferenceTitle,
  QualityMetric,
  QualityMetricLabel,
  QualityMetricValue,
  QualityMetrics,
  QualityText,
  SortButton,
  SortWrapper,
} from '../style';
import styled from 'styled-components';

const PREFERENCE_OPTIONS: Record<
  ResultSortOption,
  { badgeLabel: string; description: string; label: string }
> = {
  recommended: {
    label: '추천순',
    badgeLabel: '추천 1위',
    description:
      '이동시간, 환승, 도보 부담을 함께 보고 균형 좋은 후보를 우선해요.',
  },
  averageTime: {
    label: '평균 빠른순',
    badgeLabel: '평균 최단',
    description: '전체 인원이 평균적으로 가장 빨리 도착하는 후보를 우선해요.',
  },
  maxTime: {
    label: '최장 짧은순',
    badgeLabel: '최장 최단',
    description: '가장 오래 이동하는 사람의 시간을 줄이는 후보를 우선해요.',
  },
  transfer: {
    label: '환승 적은순',
    badgeLabel: '환승 적음',
    description: '참가자들의 평균 환승 부담이 낮은 후보를 우선해요.',
  },
  walking: {
    label: '도보 짧은순',
    badgeLabel: '도보 짧음',
    description: '참가자들의 평균 도보 시간이 짧은 후보를 우선해요.',
  },
  vote: {
    label: '득표 많은순',
    badgeLabel: '득표 1위',
    description: '참가자 선호도가 높은 후보를 우선해요.',
  },
};

const SORT_OPTIONS: { label: string; value: ResultSortOption }[] = [
  { label: PREFERENCE_OPTIONS.recommended.label, value: 'recommended' },
  { label: PREFERENCE_OPTIONS.averageTime.label, value: 'averageTime' },
  { label: PREFERENCE_OPTIONS.maxTime.label, value: 'maxTime' },
  { label: PREFERENCE_OPTIONS.transfer.label, value: 'transfer' },
  { label: PREFERENCE_OPTIONS.walking.label, value: 'walking' },
  { label: PREFERENCE_OPTIONS.vote.label, value: 'vote' },
];

const formatTransferCount = (count: number) => {
  const roundedCount = Math.round(count * 10) / 10;
  return `${Number.isInteger(roundedCount) ? roundedCount : roundedCount.toFixed(1)}회`;
};

const formatWalkingDistance = (distance: number) => {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)}km`;
  }

  return `${Math.round(distance)}m`;
};

const formatQualityValue = (
  station: DistanceSummaryItem,
  formatter: () => string,
) => {
  if (!station.hasRouteQualityMetrics) {
    return '정보 없음';
  }

  return formatter();
};

interface DistanceSummaryProps {
  station: DistanceSummaryItem;
  stations: DistanceSummaryItem[];
  activeMapId: string;
  queryMapId: string | null;
  sortOption: ResultSortOption;
  onSortChange: (sortOption: ResultSortOption) => void;
  voteRound: number;
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
  activeMapId,
  queryMapId,
  sortOption,
  onSortChange,
  voteRound,
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
    voteRound,
  );
  const { canManage, requestCancelConfirm, requestResetVote } =
    useHostControlFlow(activeMapId, shareKey);

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
  const selectedPreference = PREFERENCE_OPTIONS[sortOption];

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
          <PreferencePanel>
            <PreferenceHeader>
              <PreferenceTitle>선호 조건</PreferenceTitle>
              <ConditionBadge>{selectedPreference.label}</ConditionBadge>
            </PreferenceHeader>
            <PreferenceDescription>
              {selectedPreference.description}
            </PreferenceDescription>
            <ConditionBadgeList>
              {station.preferenceMatches.map(preference => (
                <ConditionBadge key={preference}>
                  {PREFERENCE_OPTIONS[preference].badgeLabel}
                </ConditionBadge>
              ))}
            </ConditionBadgeList>
          </PreferencePanel>
          <QualityMetrics>
            <QualityMetric>
              <QualityMetricLabel>추천 점수</QualityMetricLabel>
              <QualityMetricValue>
                {Math.round(station.recommendScore)}
              </QualityMetricValue>
            </QualityMetric>
            <QualityMetric>
              <QualityMetricLabel>평균 환승</QualityMetricLabel>
              <QualityMetricValue>
                {formatQualityValue(station, () =>
                  formatTransferCount(station.averageTransferCount),
                )}
              </QualityMetricValue>
            </QualityMetric>
            <QualityMetric>
              <QualityMetricLabel>최대 환승</QualityMetricLabel>
              <QualityMetricValue>
                {formatQualityValue(station, () =>
                  formatTransferCount(station.maxTransferCount),
                )}
              </QualityMetricValue>
            </QualityMetric>
            <QualityMetric>
              <QualityMetricLabel>평균 도보</QualityMetricLabel>
              <QualityMetricValue>
                {formatQualityValue(station, () =>
                  convertToKoreanTime(station.averageWalkingTime),
                )}
              </QualityMetricValue>
            </QualityMetric>
            <QualityMetric>
              <QualityMetricLabel>도보 거리</QualityMetricLabel>
              <QualityMetricValue>
                {formatQualityValue(station, () =>
                  formatWalkingDistance(station.averageWalkingDistance),
                )}
              </QualityMetricValue>
            </QualityMetric>
          </QualityMetrics>
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
                    <CompareBadgeList>
                      {candidate.preferenceMatches.map(preference => (
                        <ConditionBadge key={preference}>
                          {PREFERENCE_OPTIONS[preference].badgeLabel}
                        </ConditionBadge>
                      ))}
                    </CompareBadgeList>
                    {candidate.hasRouteQualityMetrics && (
                      <QualityText>
                        평균 환승{' '}
                        {formatTransferCount(candidate.averageTransferCount)}
                        {' · '}도보{' '}
                        {convertToKoreanTime(candidate.averageWalkingTime)}
                      </QualityText>
                    )}
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
