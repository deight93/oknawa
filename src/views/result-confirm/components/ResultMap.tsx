'use client';

import MeetingMap from '@/components/MeetingMap';
import { ItineraryItem, Participant } from '@/types/location';

interface ResultMapProps {
  stationName: string;
  itinerary?: ItineraryItem[];
  participants?: Participant[];
  end_x: number;
  end_y: number;
}

export default function ResultMap({
  stationName,
  itinerary,
  participants,
  end_x,
  end_y,
}: ResultMapProps) {
  return (
    <MeetingMap
      stationName={stationName}
      endX={end_x}
      endY={end_y}
      participants={participants}
      itinerary={itinerary}
    />
  );
}
