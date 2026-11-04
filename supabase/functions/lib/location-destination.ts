import type { SupabaseClient } from 'jsr:@supabase/supabase-js';
import type {
  PopularMeetingLocation,
  RouteItinerary,
  RouteParticipant,
} from './location-types.ts';
import {
  getParticipantTravelMode,
  isRouteParticipantList,
} from './location-types.ts';
import { fetchRouteItinerary } from './route-providers.ts';
import { responseApiError, responseJson } from './utils.ts';

export interface MeetingDestination {
  name: string;
  address: string;
  x: number;
  y: number;
}

export type DestinationRoute =
  | { participantIndex: number; status: 'ok'; route: RouteItinerary }
  | { participantIndex: number; status: 'unavailable' };

interface DestinationInput {
  participant: RouteParticipant[];
  meetingDestination: MeetingDestination;
}

interface RoomContext {
  roomId: string;
  hostId: string;
  runId: string;
}

type DestinationRequest =
  | { kind: 'direct'; input: DestinationInput }
  | { kind: 'shared'; roomContext: RoomContext };

interface DestinationRequestInfo extends DestinationInput {
  destinationRoutes: DestinationRoute[];
  destinationRoom?: Pick<RoomContext, 'roomId' | 'runId'>;
}

const MAX_PARTICIPANTS = 50;
const ROUTE_CONCURRENCY_LIMIT = 4;

function tooManyParticipants(): Response {
  return responseApiError(
    'too_many_participants',
    `한 번에 출발지 ${MAX_PARTICIPANTS}곳까지 조회할 수 있어요.`,
    400,
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function isDestination(value: unknown): value is MeetingDestination {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.address === 'string' &&
    value.address.trim().length > 0 &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    Math.abs(value.x) <= 180 &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    Math.abs(value.y) <= 90
  );
}

function isParticipants(value: unknown): value is RouteParticipant[] {
  return (
    isRouteParticipantList(value) &&
    value.every(participant => participant.name.trim().length > 0)
  );
}

function publicInput(
  participants: RouteParticipant[],
  destination: MeetingDestination,
): DestinationInput {
  // Preserve the snapshot's order and nullable modes for the completion RPC.
  // Pick fields explicitly so client or RPC extras cannot publish capabilities.
  return {
    participant: participants.map(participant => ({
      name: participant.name,
      region_name: participant.region_name,
      full_address: participant.full_address,
      start_x: participant.start_x,
      start_y: participant.start_y,
      ...(participant.travel_mode !== undefined
        ? { travel_mode: participant.travel_mode }
        : {}),
    })),
    meetingDestination: {
      name: destination.name,
      address: destination.address,
      x: destination.x,
      y: destination.y,
    },
  };
}

function parseBody(body: unknown): DestinationRequest | Response {
  if (!isRecord(body)) {
    return responseApiError(
      'invalid_request_body',
      'invalid request body',
      400,
    );
  }
  // A supplied roomContext always selects the capability-gated path. Never
  // fall back to direct client input when the room capability is invalid.
  if ('roomContext' in body) {
    const context = body.roomContext;
    if (
      !isRecord(context) ||
      !isUuid(context.roomId) ||
      !isUuid(context.runId) ||
      typeof context.hostId !== 'string' ||
      !context.hostId.trim() ||
      context.hostId.length > 512
    ) {
      return responseApiError(
        'invalid_room_context',
        'invalid room context',
        400,
      );
    }
    return {
      kind: 'shared',
      roomContext: {
        roomId: context.roomId.toLowerCase(),
        hostId: context.hostId,
        runId: context.runId.toLowerCase(),
      },
    };
  }
  if (
    Array.isArray(body.participant) &&
    body.participant.length > MAX_PARTICIPANTS
  ) {
    return tooManyParticipants();
  }
  if (!isParticipants(body.participant)) {
    return responseApiError('invalid_participant', 'invalid participant', 400);
  }
  if (!isDestination(body.meetingDestination)) {
    return responseApiError(
      'invalid_meeting_destination',
      'invalid meeting destination',
      400,
    );
  }
  return {
    kind: 'direct',
    input: publicInput(body.participant, body.meetingDestination),
  };
}

async function fetchRoomInput(
  supabase: SupabaseClient,
  context: RoomContext,
): Promise<DestinationInput | Response> {
  const failure = (status = 500) =>
    responseApiError(
      'destination_snapshot_failed',
      'Unable to load destination room snapshot',
      status,
    );
  try {
    // The RPC validates host + active run even for the service-role client.
    const { data, error } = await supabase.rpc(
      'location_destination_run_input',
      {
        p_room_id: context.roomId,
        p_room_host_id: context.hostId,
        p_recommendation_run_id: context.runId,
      },
    );
    if (error) {
      switch (error.code) {
        case '42501':
          return failure(403);
        case '22023':
          return failure(400);
        case '55000':
        case 'P0001':
          return failure(409);
        default:
          return failure();
      }
    }
    const snapshot: unknown = data;
    if (!isRecord(snapshot)) return failure();
    if (
      Array.isArray(snapshot.participant) &&
      snapshot.participant.length > MAX_PARTICIPANTS
    ) {
      return tooManyParticipants();
    }
    if (
      !isParticipants(snapshot.participant) ||
      !isDestination(snapshot.meeting_destination)
    )
      return failure();
    return publicInput(snapshot.participant, snapshot.meeting_destination);
  } catch {
    return failure();
  }
}

async function buildDestinationRoutes(
  participants: RouteParticipant[],
  destination: MeetingDestination,
): Promise<DestinationRoute[]> {
  const departureTime = new Date().toISOString();
  const target: PopularMeetingLocation = {
    name: destination.name,
    address: destination.address,
    type: 'local_area',
    location_x: destination.x,
    location_y: destination.y,
  };
  const pending = new Map<
    string,
    Promise<RouteItinerary['itinerary'] | null>
  >();
  const results: DestinationRoute[] = participants.map(
    (_, participantIndex) => ({
      participantIndex,
      status: 'unavailable',
    }),
  );
  let next = 0;
  async function worker() {
    while (next < participants.length) {
      const participantIndex = next++;
      const participant = participants[participantIndex];
      const mode = getParticipantTravelMode(participant);
      const key = JSON.stringify([
        mode,
        participant.start_x,
        participant.start_y,
        destination.x,
        destination.y,
      ]);
      let route = pending.get(key);
      if (!route) {
        route = fetchRouteItinerary(participant, target, mode, departureTime);
        pending.set(key, route);
      }
      const itinerary = await route;
      if (itinerary) {
        results[participantIndex] = {
          participantIndex,
          status: 'ok',
          route: {
            name: participant.name,
            region_name: participant.region_name,
            travel_mode: mode,
            itinerary,
          },
        };
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(ROUTE_CONCURRENCY_LIMIT, participants.length) },
      () => worker(),
    ),
  );
  return results;
}

async function insertResult(
  supabase: SupabaseClient,
  requestInfo: DestinationRequestInfo,
): Promise<Response> {
  const failure = () =>
    responseApiError(
      'location_result_insert_failed',
      'location_result insert error',
      500,
    );
  try {
    // Fixed destinations have no station_info candidates or votes.
    const { data, error } = await supabase
      .from('location_result')
      .insert({
        map_id: crypto.randomUUID(),
        map_host_id: crypto.randomUUID(),
        request_info: requestInfo,
        confirmed: null,
      })
      .select('map_id, map_host_id')
      .maybeSingle();
    const row: unknown = data;
    if (
      error ||
      !isRecord(row) ||
      !isUuid(row.map_id) ||
      !isUuid(row.map_host_id)
    )
      return failure();
    return responseJson({ map_id: row.map_id, map_host_id: row.map_host_id });
  } catch {
    return failure();
  }
}

export async function handleLocationDestinationRequest(
  req: Request,
  createSupabase: () => SupabaseClient,
): Promise<Response> {
  if (req.method === 'OPTIONS') return responseJson('ok');
  if (req.method !== 'POST') {
    return responseApiError('method_not_allowed', 'Method Not Allowed', 405);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return responseApiError('invalid_json_body', 'invalid JSON body', 400);
  }
  try {
    const request = parseBody(body);
    if (request instanceof Response) return request;
    const supabase = createSupabase();
    const input =
      request.kind === 'direct'
        ? request.input
        : await fetchRoomInput(supabase, request.roomContext);
    if (input instanceof Response) return input;
    const destinationRoutes = await buildDestinationRoutes(
      input.participant,
      input.meetingDestination,
    );
    return await insertResult(supabase, {
      ...input,
      destinationRoutes,
      ...(request.kind === 'shared'
        ? {
            destinationRoom: {
              roomId: request.roomContext.roomId,
              runId: request.roomContext.runId,
            },
          }
        : {}),
    });
  } catch {
    // SDK/configuration errors can include private request data.
    return responseApiError(
      'internal_error',
      'Unable to create destination result',
      500,
    );
  }
}
