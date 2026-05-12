export interface PolylinePoint {
  lat: number;
  lng: number;
}

export interface ItineraryItem {
  name: string;
  itinerary: {
    totalTime: number;
    total_polyline: PolylinePoint[];
  };
  region_name: string;
}

export interface Participant {
  name: string;
  region_name: string;
  full_address?: string;
  start_x: number;
  start_y: number;
}

export interface RequestInfo {
  participant: Participant[];
}

export interface StationInfo {
  station_name: string;
  address_name: string;
  end_x: number;
  end_y: number;
  share_key: string;
  itinerary: ItineraryItem[];
  request_info: RequestInfo;
  vote: number;
}

export interface LocationResult {
  station_info: StationInfo[];
  request_info: RequestInfo;
  confirmed?: string | null;
}

export type ResultSortOption = 'averageTime' | 'maxTime' | 'vote';

export interface DistanceSummaryItem {
  station: StationInfo;
  stationName: string;
  itinerary: ItineraryItem[];
  shareKey: string;
  stationParticipants: Participant[];
  totalTravelTime: number;
  averageTravelTime: number;
  maxTravelTime: number;
  vote: number;
}
