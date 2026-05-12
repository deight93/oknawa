import { useAtomValue } from 'jotai';

import { resultState } from '@/jotai/result/store';
import { DistanceSummaryItem, ResultSortOption } from '@/types/location';

const compareBySortOption = (sortOption: ResultSortOption) => {
  return (a: DistanceSummaryItem, b: DistanceSummaryItem) => {
    switch (sortOption) {
      case 'maxTime':
        return a.maxTravelTime - b.maxTravelTime;
      case 'vote':
        return b.vote - a.vote || a.averageTravelTime - b.averageTravelTime;
      case 'averageTime':
      default:
        return a.averageTravelTime - b.averageTravelTime;
    }
  };
};

export default function useResultSummary(sortOption: ResultSortOption) {
  const result = useAtomValue(resultState);
  const { station_info = [], request_info } = result;

  const distanceSummaries: DistanceSummaryItem[] = station_info
    .map(station => {
      const stationName = station.station_name?.split(' ')[0] ?? '';
      const itinerary = station.itinerary ?? [];
      const shareKey = station.share_key;
      const stationParticipants = station.request_info?.participant ?? [];
      const travelTimes = itinerary.map(
        itinerary => itinerary.itinerary.totalTime,
      );
      const totalTravelTime = travelTimes.reduce((sum, time) => sum + time, 0);
      const vote = station.vote;
      const averageTravelTime = itinerary.length
        ? totalTravelTime / itinerary.length
        : 0;
      const maxTravelTime = travelTimes.length ? Math.max(...travelTimes) : 0;

      return {
        station,
        stationName,
        itinerary,
        shareKey,
        stationParticipants,
        totalTravelTime,
        averageTravelTime,
        maxTravelTime,
        vote,
      };
    })
    .sort(compareBySortOption(sortOption));

  return {
    distanceSummaries,
    participants: request_info?.participant ?? [],
  };
}
