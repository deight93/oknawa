'use client';

import MeetingMap from '@/components/MeetingMap';
import {
  DistanceSummaryItem,
  ItineraryItem,
  Participant,
  StationInfo,
} from '@/types/location';

interface ResultMapProps {
  station?: DistanceSummaryItem | StationInfo;
  stationName: string;
  itinerary?: ItineraryItem[];
  participants?: Participant[];
}

const getStationInfo = (station?: DistanceSummaryItem | StationInfo) => {
  if (!station) return null;
  return 'station' in station ? station.station : station;
};

export default function ResultMap({
  station,
  stationName,
  itinerary,
  participants,
}: ResultMapProps) {
  const stationInfo = getStationInfo(station);

  return (
    <MeetingMap
      stationName={stationName}
      endX={stationInfo?.end_x}
      endY={stationInfo?.end_y}
      participants={participants}
      itinerary={itinerary}
    />
  );
}
