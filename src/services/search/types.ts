export interface SubmitDeparturePointRequestBody {
  room_id: string;
  name: string;
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
  room_host_id: string;
  confirmed_share_key?: string | null;
  result_map_id?: string | null;
  recommendation_status?: RoomRecommendationStatus;
  meeting_purpose?: string | null;
  participant?: unknown[];
}
