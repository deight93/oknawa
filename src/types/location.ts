import { MeetingPurpose } from './meetingPurpose';
import { RecommendationOptions } from './recommendationOptions';

export interface PolylinePoint {
  lat: number;
  lng: number;
}

export interface ItineraryItem {
  name: string;
  itinerary: {
    totalTime: number;
    transferCount?: number;
    walkingDistance?: number;
    walkingTime?: number;
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

export interface StationPlaceQuality {
  radius: number;
  foodCount: number;
  cafeCount: number;
  drinkCount: number;
  score: number;
}

export interface RequestInfo {
  participant: Participant[];
  meetingPurpose?: MeetingPurpose;
  recommendationOptions?: RecommendationOptions;
  placeQuality?: StationPlaceQuality;
}

export interface StationInfo {
  map_id?: string;
  station_name: string;
  address_name: string;
  end_x: number;
  end_y: number;
  recommend_score?: number;
  share_key: string;
  itinerary: ItineraryItem[];
  request_info: RequestInfo;
  vote: number;
  vote_round?: number;
}

export interface LocationResult {
  map_id?: string;
  station_info: StationInfo[];
  request_info: RequestInfo;
  confirmed?: string | null;
  vote_round?: number;
}

export type ResultSortOption =
  | 'recommended'
  | 'averageTime'
  | 'maxTime'
  | 'transfer'
  | 'walking'
  | 'vote';

export type ResultPreferenceMatch = ResultSortOption;

export interface DistanceSummaryItem {
  station: StationInfo;
  stationName: string;
  itinerary: ItineraryItem[];
  shareKey: string;
  stationParticipants: Participant[];
  totalTravelTime: number;
  averageTravelTime: number;
  maxTravelTime: number;
  averageTransferCount: number;
  maxTransferCount: number;
  averageWalkingDistance: number;
  averageWalkingTime: number;
  hasRouteQualityMetrics: boolean;
  placeQuality?: StationPlaceQuality;
  recommendScore: number;
  vote: number;
  preferenceMatches: ResultPreferenceMatch[];
  recommendationOptions?: RecommendationOptions;
}
