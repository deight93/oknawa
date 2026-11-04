import type { ItineraryItem } from './location';

export interface MeetingDestination {
  name: string;
  address: string;
  x: number;
  y: number;
}

export type DestinationRoute =
  | { participantIndex: number; status: 'ok'; route: ItineraryItem }
  | { participantIndex: number; status: 'unavailable' };

export interface DestinationRoomContext {
  roomId: string;
  hostId: string;
  runId: string;
}

export type DestinationRequest =
  | { meetingDestination: MeetingDestination; roomContext?: never }
  | { roomContext: DestinationRoomContext; meetingDestination?: never };
