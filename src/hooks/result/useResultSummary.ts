import { useAtomValue } from 'jotai';

import { resultState } from '@/jotai/result/store';
import { DistanceSummaryItem } from '@/types/location';

export default function useResultSummary() {
  const result = useAtomValue(resultState);
  const { station_info = [], request_info } = result;

  const distanceSummaries: DistanceSummaryItem[] = station_info.map(station => {
    const stationName = station.station_name?.split(' ')[0] ?? '';
    const itinerary = station.itinerary ?? [];
    const shareKey = station.share_key;
    const stationParticipants = station.request_info?.participant ?? [];
    const totalTravelTime = itinerary.reduce(
      (sum, itinerary) => sum + itinerary.itinerary.totalTime,
      0,
    );
    const vote = station.vote;
    const averageTravelTime = itinerary.length
      ? totalTravelTime / itinerary.length
      : 0;

    return {
      station,
      stationName,
      itinerary,
      shareKey,
      stationParticipants,
      totalTravelTime,
      averageTravelTime,
      vote,
    };
  });

  return {
    distanceSummaries,
    participants: request_info?.participant ?? [],
  };
}
