import { useAtomValue } from 'jotai';

import { resultState } from '@/jotai/result/store';
import { DistanceSummaryItem, ResultSortOption } from '@/types/location';
import { isCarRecommendation } from '@/utils/recommendationDisplay';

const compareBySortOption = (sortOption: ResultSortOption) => {
  return (a: DistanceSummaryItem, b: DistanceSummaryItem) => {
    switch (sortOption) {
      case 'recommended':
        return a.recommendScore - b.recommendScore;
      case 'maxTime':
        return a.maxTravelTime - b.maxTravelTime;
      case 'transfer':
        return (
          a.averageTransferCount - b.averageTransferCount ||
          a.averageTravelTime - b.averageTravelTime
        );
      case 'walking':
        return (
          a.averageWalkingTime - b.averageWalkingTime ||
          a.averageWalkingDistance - b.averageWalkingDistance ||
          a.averageTravelTime - b.averageTravelTime
        );
      case 'vote':
        return b.vote - a.vote || a.averageTravelTime - b.averageTravelTime;
      case 'averageTime':
      default:
        return a.averageTravelTime - b.averageTravelTime;
    }
  };
};

const getFallbackRecommendScore = ({
  averageTravelTime,
  maxTravelTime,
  averageTransferCount,
  averageWalkingTime,
  hasRouteQualityMetrics,
}: {
  averageTravelTime: number;
  maxTravelTime: number;
  averageTransferCount: number;
  averageWalkingTime: number;
  hasRouteQualityMetrics: boolean;
}) =>
  averageTravelTime +
  maxTravelTime * 0.35 +
  (hasRouteQualityMetrics ? averageTransferCount * 600 : 0) +
  (hasRouteQualityMetrics ? averageWalkingTime * 0.45 : 0);

export default function useResultSummary(
  sortOption: ResultSortOption,
  expectedMapId?: string,
) {
  const result = useAtomValue(resultState);
  const { station_info = [], request_info } = result;

  if (expectedMapId && result.map_id && result.map_id !== expectedMapId) {
    return {
      distanceSummaries: [],
      participants: [],
    };
  }

  const summaries = station_info.map(station => {
    const stationName = station.station_name?.split(' ')[0] ?? '';
    const itinerary = station.itinerary ?? [];
    const shareKey = station.share_key;
    const stationParticipants = station.request_info?.participant ?? [];
    const placeQuality = station.request_info?.placeQuality;
    const recommendationOptions =
      station.request_info?.recommendationOptions ??
      request_info?.recommendationOptions;
    const travelTimes = itinerary.map(
      itinerary => itinerary.itinerary.totalTime,
    );
    const transferCounts = itinerary.map(
      itinerary => itinerary.itinerary.transferCount ?? 0,
    );
    const walkingDistances = itinerary.map(
      itinerary => itinerary.itinerary.walkingDistance ?? 0,
    );
    const walkingTimes = itinerary.map(
      itinerary => itinerary.itinerary.walkingTime ?? 0,
    );
    const hasRouteQualityMetrics = itinerary.some(
      itinerary =>
        itinerary.itinerary.transferCount !== undefined ||
        itinerary.itinerary.walkingDistance !== undefined ||
        itinerary.itinerary.walkingTime !== undefined,
    );
    const totalTravelTime = travelTimes.reduce((sum, time) => sum + time, 0);
    const totalTransferCount = transferCounts.reduce(
      (sum, count) => sum + count,
      0,
    );
    const totalWalkingDistance = walkingDistances.reduce(
      (sum, distance) => sum + distance,
      0,
    );
    const totalWalkingTime = walkingTimes.reduce((sum, time) => sum + time, 0);
    const vote = station.vote;
    const averageTravelTime = itinerary.length
      ? totalTravelTime / itinerary.length
      : 0;
    const maxTravelTime = travelTimes.length ? Math.max(...travelTimes) : 0;
    const averageTransferCount = itinerary.length
      ? totalTransferCount / itinerary.length
      : 0;
    const maxTransferCount = transferCounts.length
      ? Math.max(...transferCounts)
      : 0;
    const averageWalkingDistance = itinerary.length
      ? totalWalkingDistance / itinerary.length
      : 0;
    const averageWalkingTime = itinerary.length
      ? totalWalkingTime / itinerary.length
      : 0;
    const recommendScore =
      station.recommend_score ??
      getFallbackRecommendScore({
        averageTravelTime,
        maxTravelTime,
        averageTransferCount,
        averageWalkingTime,
        hasRouteQualityMetrics,
      });

    return {
      station,
      stationName,
      itinerary,
      shareKey,
      stationParticipants,
      totalTravelTime,
      averageTravelTime,
      maxTravelTime,
      averageTransferCount,
      maxTransferCount,
      averageWalkingDistance,
      averageWalkingTime,
      hasRouteQualityMetrics,
      placeQuality,
      recommendScore,
      vote,
      preferenceMatches: [],
      recommendationOptions,
    };
  });

  const minRecommendScore = summaries.length
    ? Math.min(...summaries.map(summary => summary.recommendScore))
    : 0;
  const minAverageTravelTime = summaries.length
    ? Math.min(...summaries.map(summary => summary.averageTravelTime))
    : 0;
  const minMaxTravelTime = summaries.length
    ? Math.min(...summaries.map(summary => summary.maxTravelTime))
    : 0;
  const maxVote = summaries.length
    ? Math.max(...summaries.map(summary => summary.vote))
    : 0;
  const minAverageTransferCount = summaries.length
    ? Math.min(...summaries.map(summary => summary.averageTransferCount))
    : 0;
  const minAverageWalkingTime = summaries.length
    ? Math.min(...summaries.map(summary => summary.averageWalkingTime))
    : 0;

  const distanceSummaries: DistanceSummaryItem[] = summaries
    .map(summary => ({
      ...summary,
      preferenceMatches: [
        ...(summary.recommendScore === minRecommendScore
          ? (['recommended'] as const)
          : []),
        ...(summary.averageTravelTime === minAverageTravelTime
          ? (['averageTime'] as const)
          : []),
        ...(summary.maxTravelTime === minMaxTravelTime
          ? (['maxTime'] as const)
          : []),
        ...(!isCarRecommendation(summary.recommendationOptions) &&
        summary.hasRouteQualityMetrics &&
        summary.averageTransferCount === minAverageTransferCount
          ? (['transfer'] as const)
          : []),
        ...(!isCarRecommendation(summary.recommendationOptions) &&
        summary.hasRouteQualityMetrics &&
        summary.averageWalkingTime === minAverageWalkingTime
          ? (['walking'] as const)
          : []),
        ...(maxVote > 0 && summary.vote === maxVote ? (['vote'] as const) : []),
      ],
    }))
    .sort(compareBySortOption(sortOption));

  return {
    distanceSummaries,
    participants: request_info?.participant ?? [],
  };
}
