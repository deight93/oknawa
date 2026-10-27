import { TravelMode } from '@/types/recommendationOptions';

export interface CreatedResult {
  map_id: string;
  map_host_id: string;
}

export interface SubmitDeparturePointRequestBody {
  room_id: string;
  name: string;
  travel_mode?: TravelMode | null;
  region_name: string;
  full_address: string;
  start_x: number;
  start_y: number;
}

export interface MapIdType {
  mapId: string;
  mapHostId: string;
}

export type RoomRecommendationStatus =
  | 'idle'
  | 'generating'
  | 'completed'
  | 'failed';

export interface RoomStatusResponse {
  room_id: string;
  confirmed_share_key?: string | null;
  result_map_id?: string | null;
  recommendation_status?: RoomRecommendationStatus;
  meeting_purpose?: string | null;
  recommendation_options?: unknown;
  participant?: unknown[];
}
