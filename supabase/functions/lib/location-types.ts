export type PopularLocationType = 'station' | 'terminal';

export interface RouteParticipant {
  name: string;
  region_name: string;
  full_address: string;
  start_x: number;
  start_y: number;
}

export interface LocationPointsRequestBody {
  participant?: unknown;
}

export interface PopularMeetingLocation {
  name: string;
  type: PopularLocationType;
  url?: string | null;
  address: string;
  location_x: number | string;
  location_y: number | string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface PolylinePoint {
  lat: number;
  lng: number;
}

export interface RouteItinerary {
  name: string;
  region_name: string;
  itinerary: {
    totalTime: number;
    total_polyline: PolylinePoint[];
  };
}

export interface StationItineraryResult {
  station_name: string;
  address_name: string;
  end_x: number;
  end_y: number;
  itinerary: RouteItinerary[];
}

export interface StationInfoInsert {
  map_id: string;
  share_key: string;
  vote: number;
  end_x: number;
  end_y: number;
  address_name: string;
  station_name: string;
  itinerary: RouteItinerary[];
  request_info: {
    participant: RouteParticipant[];
  };
}

export interface KakaoKeywordDocument {
  place_name: string;
  place_url: string;
  road_address_name?: string;
  x: string;
  y: string;
  category_group_name?: string;
  category_name?: string;
}

export interface KakaoPlaceDocument extends Record<string, unknown> {
  place_url?: string;
  main_photo_url?: string | null;
  day_business_hours_infos?: unknown[];
}

export interface KakaoPlaceSearchResponse {
  documents?: KakaoPlaceDocument[];
  meta?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function isRouteParticipantList(
  value: unknown,
): value is RouteParticipant[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      participant =>
        isRecord(participant) &&
        typeof participant.name === 'string' &&
        typeof participant.region_name === 'string' &&
        typeof participant.full_address === 'string' &&
        typeof participant.start_x === 'number' &&
        Number.isFinite(participant.start_x) &&
        typeof participant.start_y === 'number' &&
        Number.isFinite(participant.start_y),
    )
  );
}
