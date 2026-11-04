import { TravelMode } from '@/types/recommendationOptions';
import { Participant } from '@/types/location';
import type { MeetingDestination } from '@/types/meetingDestination';

export interface RoomRecommendationRun {
  recommendation_run_id: string;
  participant: Participant[];
  meeting_destination?: MeetingDestination | null;
}

export interface CreatedResult {
  map_id: string;
  map_host_id: string;
}

export interface DepartureRegistration {
  // Optional while an older backend is still deployed.
  participant_id?: number;
  participant_token?: string;
}

export interface CreatedRoom extends DepartureRegistration {
  room_id: string;
  room_host_id: string;
}

export interface RoomParticipant extends Participant {
  id: number;
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
  meeting_destination?: MeetingDestination | null;
  confirmed_share_key?: string | null;
  result_map_id?: string | null;
  recommendation_status?: RoomRecommendationStatus;
  meeting_purpose?: string | null;
  recommendation_options?: unknown;
  participant?: RoomParticipant[];
}
