'use client';

import { useRouter } from 'next/navigation';

import { useState, type ReactNode } from 'react';
import {
  ChevronDown as DisclosureChevron,
  ExternalLink,
  Route,
} from 'lucide-react';
import Avatar, { AVATAR_COLORS } from '@/components/Avatar';
import { TRAVEL_MODE_OPTIONS } from '@/types/recommendationOptions';

import { modalState } from '@/jotai/global/store';

import { useResetAtom } from 'jotai/utils';

import useModal from '@/hooks/common/useModal';
import useHostControlFlow from '@/hooks/result/useHostControlFlow';
import useResultShare from '@/hooks/result/useResultShare';
import useVoteFlow from '@/hooks/result/useVoteFlow';
import useKakaoDirections from '@/hooks/result/useKakaoDirections';
import { getParticipantDirections } from '@/utils/kakaoDirections';

import { Share2 } from 'lucide-react';
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
import SearchLoading from '@/views/search/components/SearchLoading';

import { convertToKoreanTime } from '@/utils/date';
import { RecommendationOptions } from '@/types/recommendationOptions';
import {
  DistanceSummaryItem,
  Participant,
  ResultSortOption,
} from '@/types/location';
import {
  getResultTitleLabel,
  getRouteStatText,
  getVisibleSortOptions,
  isCarRecommendation,
} from '@/utils/recommendationDisplay';

import {
  Container,
  ArrivalTime,
  ExpandBody,
  ButtonWrapper,
  ContentWrapper,
  CandidateMeta,
  Count,
  Header,
  Indicator,
  IndicatorWrapper,
  Label,
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
  DetailPanel,
  DetailSection,
  DetailSectionTitle,
  DetailToggleButton,
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
  QualityMetric,
  QualityMetricLabel,
  QualityMetricValue,
  QualityMetrics,
  SortWrapper,
  SortSelect,
  SummaryMetric,
  SummaryMetricLabel,
  SummaryMetrics,
  SummaryMetricValue,
  ParticipantList,
  ParticipantName,
  ParticipantRow,
  ParticipantStats,
  ParticipantIdentity,
  ParticipantMode,
  ParticipantTime,
  ParticipantInfo,
  ParticipantOrigin,
  ParticipantDirections,
  DirectionsLink,
  DirectionsWebLink,
  DirectionsHint,
  ParticipantSectionHeader,
  ComparisonToggle,
  CompareSelectButton,
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
      '가장 오래 걸리는 시간을 줄이고, 비슷한 후보 중 이동시간 차이가 작은 곳을 우선해요.',
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

const getPreferenceOption = (
  sortOption: ResultSortOption,
  recommendationOptions?: RecommendationOptions,
) => {
  if (
    recommendationOptions?.midpointBasis === 'distance' &&
    sortOption === 'recommended'
  ) {
    return {
      ...PREFERENCE_OPTIONS.recommended,
      description: '위치와 거리 균형을 함께 보고 좋은 후보를 우선해요.',
    };
  }

  return PREFERENCE_OPTIONS[sortOption];
};

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

const getVisiblePreferences = (
  preferences: ResultSortOption[],
  visibleCount: number,
) => preferences.slice(0, visibleCount);

interface DistanceSummaryProps {
  children?: ReactNode;
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
  children,
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

  const [isExpandTail, setExpandTail] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [openedCompareShareKey, setOpenedCompareShareKey] = useState<
    string | null
  >(null);

  const { setModalContents } = useModal();
  const { copyInvitationLink } = useResultShare(queryMapId);
  const { isVote, isConfirming, requestVote, requestConfirm, canConfirm } =
    useVoteFlow(shareKey, queryMapId, voteRound);
  const { canManage, requestResetVote } = useHostControlFlow(activeMapId);
  const { openDirections, cancelPendingDirections } = useKakaoDirections(
    `${activeMapId}:${shareKey}:${isExpandTail}`,
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

  const isCarResult = isCarRecommendation(station.recommendationOptions);
  const selectedPreference = getPreferenceOption(
    sortOption,
    station.recommendationOptions,
  );
  const sortOptions = getVisibleSortOptions(
    SORT_OPTIONS,
    station.recommendationOptions,
  );
  const resultTitleLabel = getResultTitleLabel(
    station.recommendationOptions,
    station.resultType,
  );

  const toggleCompareDetail = (shareKey: string) => {
    setOpenedCompareShareKey(currentShareKey =>
      currentShareKey === shareKey ? null : shareKey,
    );
  };

  return (
    <Container>
      <Header home onBack={clickHome}>
        <SharingButton type="button" onClick={copyInvitationLink}>
          <Share2 size={18} aria-hidden="true" />
          초대하기
        </SharingButton>
      </Header>
      {isExpandTail ? (
        <>
          <ExpandBody id="expanded-result">
            <ContentWrapper>
              <StationName>{stationName}</StationName>
              <CandidateMeta>
                <Label>{resultTitleLabel}</Label>
                <IndicatorWrapper>
                  <ChevronButton
                    type="button"
                    aria-label="이전 후보"
                    onClick={onPrev}
                  >
                    <ChevronLeft />
                  </ChevronButton>
                  <Indicator>
                    {stationIndex}/{stationLength}
                  </Indicator>
                  <ChevronButton
                    type="button"
                    aria-label="다음 후보"
                    onClick={onNext}
                  >
                    <ChevronRight />
                  </ChevronButton>
                </IndicatorWrapper>
              </CandidateMeta>
            </ContentWrapper>
            <SummaryMetrics>
              <SummaryMetric>
                <SummaryMetricLabel>평균</SummaryMetricLabel>
                <SummaryMetricValue>
                  {convertToKoreanTime(station.averageTravelTime)}
                </SummaryMetricValue>
              </SummaryMetric>
              <SummaryMetric>
                <SummaryMetricLabel>최장</SummaryMetricLabel>
                <SummaryMetricValue>
                  {convertToKoreanTime(station.maxTravelTime)}
                </SummaryMetricValue>
              </SummaryMetric>
              <SummaryMetric>
                <SummaryMetricLabel>득표</SummaryMetricLabel>
                <SummaryMetricValue>{vote}표</SummaryMetricValue>
              </SummaryMetric>
            </SummaryMetrics>
            <SortWrapper>
              <label htmlFor="result-sort">추천 기준</label>
              <SortSelect
                id="result-sort"
                value={sortOption}
                onChange={event => {
                  const option = sortOptions.find(
                    item => item.value === event.target.value,
                  );
                  if (option) onSortChange(option.value);
                }}
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SortSelect>
              <PreferenceDescription>
                {selectedPreference.description}
              </PreferenceDescription>
            </SortWrapper>
            <DetailSection>
              <ParticipantSectionHeader>
                <DetailSectionTitle>참가자별 이동 시간</DetailSectionTitle>
                <DetailToggleButton
                  type="button"
                  aria-expanded={isDetailOpen}
                  aria-controls="route-details"
                  onClick={() => setIsDetailOpen(isOpen => !isOpen)}
                >
                  {isDetailOpen ? '상세 접기' : '이동 상세'}
                </DetailToggleButton>
              </ParticipantSectionHeader>
              <DirectionsHint>
                내 출발지에서 이 후보까지 길찾기를 확인해요.
              </DirectionsHint>
              <ParticipantList aria-label="참가자별 이동 시간">
                {station.itinerary.map((route, index) => {
                  const directions = getParticipantDirections(
                    station.station,
                    index,
                    station.recommendationOptions?.travelMode,
                  );
                  const travelMode =
                    directions?.travelMode ??
                    route.travel_mode ??
                    station.recommendationOptions?.travelMode;
                  const modeLabel =
                    TRAVEL_MODE_OPTIONS.find(
                      option => option.value === travelMode,
                    )?.label ?? '대중교통';
                  return (
                    <ParticipantRow
                      key={`${route.name}-${route.region_name}-${index}`}
                    >
                      <ParticipantIdentity>
                        <span aria-hidden="true">
                          <Avatar
                            name={route.name}
                            color={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                          />
                        </span>
                        <ParticipantInfo>
                          <ParticipantName>{route.name}</ParticipantName>
                          <ParticipantOrigin>
                            {route.region_name}
                          </ParticipantOrigin>
                        </ParticipantInfo>
                      </ParticipantIdentity>
                      <ParticipantMode>{modeLabel}</ParticipantMode>
                      <ParticipantTime>
                        {convertToKoreanTime(route.itinerary.totalTime)}
                      </ParticipantTime>
                      <ParticipantDirections>
                        {directions ? (
                          <>
                            <DirectionsLink
                              href={directions.webUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`${route.name}, ${route.region_name}에서 ${stationName}까지 ${modeLabel} 카카오맵 길찾기`}
                              onClick={event =>
                                openDirections(event, directions)
                              }
                              onAuxClick={cancelPendingDirections}
                            >
                              <Route size={18} aria-hidden="true" />
                              카카오맵 길찾기
                            </DirectionsLink>
                            <DirectionsWebLink
                              href={directions.webUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`${route.name}, ${route.region_name}에서 ${stationName}까지 ${modeLabel} 길찾기 웹으로 보기 (새 탭)`}
                              onClick={cancelPendingDirections}
                              onAuxClick={cancelPendingDirections}
                            >
                              웹으로 보기
                              <ExternalLink size={14} aria-hidden="true" />
                            </DirectionsWebLink>
                          </>
                        ) : (
                          <DirectionsHint>
                            출발지 정보가 없어 길찾기를 열 수 없어요.
                          </DirectionsHint>
                        )}
                      </ParticipantDirections>
                    </ParticipantRow>
                  );
                })}
              </ParticipantList>
            </DetailSection>
            {children}
            {isDetailOpen && (
              <DetailPanel id="route-details">
                <DetailSection>
                  <DetailSectionTitle>추천 기준</DetailSectionTitle>
                  <QualityMetrics>
                    {isCarResult ? (
                      <>
                        <QualityMetric>
                          <QualityMetricLabel>평균 이동</QualityMetricLabel>
                          <QualityMetricValue>
                            {convertToKoreanTime(station.averageTravelTime)}
                          </QualityMetricValue>
                        </QualityMetric>
                        <QualityMetric>
                          <QualityMetricLabel>최장 이동</QualityMetricLabel>
                          <QualityMetricValue>
                            {convertToKoreanTime(station.maxTravelTime)}
                          </QualityMetricValue>
                        </QualityMetric>
                      </>
                    ) : (
                      <>
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
                              formatWalkingDistance(
                                station.averageWalkingDistance,
                              ),
                            )}
                          </QualityMetricValue>
                        </QualityMetric>
                      </>
                    )}
                  </QualityMetrics>
                </DetailSection>
                <DetailSection>
                  <DetailSectionTitle>선호 조건</DetailSectionTitle>
                  <ConditionBadgeList>
                    {station.preferenceMatches.map(preference => (
                      <ConditionBadge key={preference}>
                        {PREFERENCE_OPTIONS[preference].badgeLabel}
                      </ConditionBadge>
                    ))}
                  </ConditionBadgeList>
                </DetailSection>
                <DetailSection>
                  <DetailSectionTitle>참가자별 이동</DetailSectionTitle>
                  <RouteDetailList>
                    {station.itinerary.map(route => (
                      <RouteDetailRow
                        key={`${route.name}-${route.region_name}`}
                      >
                        <ParticipantName>{route.name}</ParticipantName>
                        <ParticipantStats>
                          {getRouteStatText(
                            convertToKoreanTime(route.itinerary.totalTime),
                            formatTransferCount(
                              route.itinerary.transferCount ?? 0,
                            ),
                            convertToKoreanTime(
                              route.itinerary.walkingTime ?? 0,
                            ),
                            station.recommendationOptions,
                            route.travel_mode,
                          )}
                        </ParticipantStats>
                      </RouteDetailRow>
                    ))}
                  </RouteDetailList>
                </DetailSection>
              </DetailPanel>
            )}
            {stations.length > 1 && (
              <ComparisonToggle
                type="button"
                aria-expanded={isComparisonOpen}
                aria-controls="candidate-comparison"
                onClick={() => setIsComparisonOpen(isOpen => !isOpen)}
              >
                후보 {stations.length}곳 비교하기
                <DisclosureChevron
                  size={20}
                  aria-hidden="true"
                  style={{
                    transform: isComparisonOpen
                      ? 'rotate(180deg)'
                      : 'rotate(-90deg)',
                  }}
                />
              </ComparisonToggle>
            )}
            {isComparisonOpen && stations.length > 1 && (
              <>
                <CompareHeader>
                  <CompareTitle>후보 비교</CompareTitle>
                </CompareHeader>
                <Label>후보별 평균, 최장, 득표를 바로 비교해요.</Label>
                <CompareList id="candidate-comparison">
                  {stations.map((candidate, index) => {
                    const candidateVisiblePreferences = getVisiblePreferences(
                      candidate.preferenceMatches,
                      2,
                    );
                    const isCompareDetailOpen =
                      openedCompareShareKey === candidate.shareKey;

                    return (
                      <CompareCard
                        key={candidate.shareKey}
                        $isActive={index === currentIndex}
                      >
                        <CompareSelectButton
                          type="button"
                          aria-label={`${candidate.stationName} 후보 선택`}
                          aria-pressed={index === currentIndex}
                          onClick={() => onSelectStation(index)}
                        >
                          <CompareStationName>
                            {index + 1}. {candidate.stationName}
                          </CompareStationName>
                          <CompareBadgeList>
                            {candidateVisiblePreferences.map(preference => (
                              <ConditionBadge key={preference}>
                                {PREFERENCE_OPTIONS[preference].badgeLabel}
                              </ConditionBadge>
                            ))}
                          </CompareBadgeList>
                          <CompareMetrics>
                            <CompareMetric>
                              <CompareMetricLabel>평균</CompareMetricLabel>
                              <CompareMetricValue>
                                {convertToKoreanTime(
                                  candidate.averageTravelTime,
                                )}
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
                        </CompareSelectButton>
                        <DetailToggleButton
                          type="button"
                          aria-expanded={isCompareDetailOpen}
                          onClick={() =>
                            toggleCompareDetail(candidate.shareKey)
                          }
                        >
                          {isCompareDetailOpen ? '근거 접기' : '근거 보기'}
                        </DetailToggleButton>
                        {isCompareDetailOpen && (
                          <QualityMetrics>
                            {isCarRecommendation(
                              candidate.recommendationOptions,
                            ) ? (
                              <QualityMetric>
                                <QualityMetricLabel>
                                  최장 이동
                                </QualityMetricLabel>
                                <QualityMetricValue>
                                  {convertToKoreanTime(candidate.maxTravelTime)}
                                </QualityMetricValue>
                              </QualityMetric>
                            ) : (
                              <>
                                <QualityMetric>
                                  <QualityMetricLabel>
                                    평균 환승
                                  </QualityMetricLabel>
                                  <QualityMetricValue>
                                    {formatQualityValue(candidate, () =>
                                      formatTransferCount(
                                        candidate.averageTransferCount,
                                      ),
                                    )}
                                  </QualityMetricValue>
                                </QualityMetric>
                                <QualityMetric>
                                  <QualityMetricLabel>
                                    평균 도보
                                  </QualityMetricLabel>
                                  <QualityMetricValue>
                                    {formatQualityValue(candidate, () =>
                                      convertToKoreanTime(
                                        candidate.averageWalkingTime,
                                      ),
                                    )}
                                  </QualityMetricValue>
                                </QualityMetric>
                              </>
                            )}
                          </QualityMetrics>
                        )}
                      </CompareCard>
                    );
                  })}
                </CompareList>
              </>
            )}

            {canManage && (
              <HostControlPanel>
                <HostControlTitle>방장 관리</HostControlTitle>
                <Button label="재투표 시작" onClick={requestResetVote} />
              </HostControlPanel>
            )}
          </ExpandBody>
          <PreffertWrapper>
            <VoteWrapper>
              <VoteTitle>
                <Label>선호도 결과</Label>
                <Count>
                  {vote}표 · {stationParticipants.length}명 참여
                </Count>
              </VoteTitle>
            </VoteWrapper>
            <ButtonWrapper>
              <LikeButtonWithVote
                label="좋아요"
                onClick={requestVote}
                $isVote={isVote}
                aria-pressed={isVote}
              >
                {isVote ? <LikeIconActive /> : <LikeIconInactive />}
              </LikeButtonWithVote>
              {canConfirm && (
                <ButtonPrimary label="확정하기" onClick={requestConfirm} />
              )}
            </ButtonWrapper>
          </PreffertWrapper>
        </>
      ) : (
        <FoldBody>
          <ContentWrapper $isExpand={isExpandTail}>
            <LeftWrapper>
              <ChevronWrapper
                type="button"
                aria-label="이전 후보"
                onClick={onPrev}
              >
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
                <LikeButton
                  type="button"
                  aria-label="좋아요"
                  aria-pressed={isVote}
                  onClick={requestVote}
                >
                  {isVote ? <LikeIconActive /> : <LikeIconInactive />}
                </LikeButton>
                {canConfirm && (
                  <ConfirmButton
                    type="button"
                    aria-label="확정하기"
                    onClick={requestConfirm}
                  >
                    <Check />
                  </ConfirmButton>
                )}
              </ButtonWrapper>
              <ChevronWrapper
                type="button"
                aria-label="다음 후보"
                onClick={onNext}
              >
                <ChevronRight />
              </ChevronWrapper>
            </RightWrapper>
          </ContentWrapper>
        </FoldBody>
      )}

      <TailWrapper>
        <Tail
          type="button"
          aria-label={isExpandTail ? '결과 패널 접기' : '결과 패널 펼치기'}
          aria-expanded={isExpandTail}
          onClick={clickTail}
        >
          {isExpandTail ? <ChevronBottom /> : <ChevronTop />}
        </Tail>
      </TailWrapper>
      {isConfirming && <SearchLoading phase="fetching" />}
    </Container>
  );
}

const LikeButtonWithVote = styled(Button)<{ $isVote: boolean }>`
  border: ${({ $isVote }) =>
    $isVote ? '1px solid var(--primary)' : '1px solid var(--text-subtle)'};
  color: ${({ $isVote }) =>
    $isVote ? 'var(--result-accent)' : 'var(--result-muted)'};
`;

const RouteDetailList = styled.div`
  display: flex;
  flex-direction: column;
`;

const RouteDetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  &:last-child {
    border-bottom: 0;
  }
`;
