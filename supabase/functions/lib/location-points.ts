import type { SupabaseClient } from 'jsr:@supabase/supabase-js';
import { getCenterCoordinates, getCenterLocations } from './distance.ts';
import type {
  LocationPointsRequestBody,
  PopularLocationType,
  PopularMeetingLocation,
  RouteParticipant,
  StationInfoInsert,
  StationItineraryResult,
} from './location-types.ts';
import { isRouteParticipantList } from './location-types.ts';
import { callGoogleMapItineraries } from './mapapi.ts';
import { responseJson } from './utils.ts';

interface LocationPointsRequest {
  participants: RouteParticipant[];
  priority: number;
}

interface LocationResultRow {
  map_id: string;
  map_host_id: string;
}

export const isResponse = (value: unknown): value is Response =>
  value instanceof Response;

export async function parseLocationPointsRequest(
  req: Request,
): Promise<LocationPointsRequest | Response> {
  let body: LocationPointsRequestBody | null = null;

  try {
    body = (await req.json()) as LocationPointsRequestBody;
  } catch {
    return responseJson({ error: 'invalid JSON body' }, 400);
  }

  const participants = body?.participant;
  if (!isRouteParticipantList(participants)) {
    return responseJson({ error: 'invalid participant' }, 400);
  }

  const priority = Number(new URL(req.url).searchParams.get('priority') ?? '4');

  return {
    participants,
    priority,
  };
}

export function resolveRecommendType(
  participants: RouteParticipant[],
): PopularLocationType {
  const hasNonSeoulGyeonggi = participants.some(
    participant => !isSeoulOrGyeonggi(participant.full_address),
  );

  return hasNonSeoulGyeonggi ? 'terminal' : 'station';
}

export async function fetchPopularMeetingLocations(
  supabase: SupabaseClient,
  type: PopularLocationType,
): Promise<PopularMeetingLocation[] | Response> {
  const { data, error } = await supabase
    .from('popular_meeting_location')
    .select('*')
    .eq('type', type)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);

  const locations = (data ?? []) as PopularMeetingLocation[];
  if (!locations.length) {
    return responseJson({ error: 'popular_meeting_location is empty' }, 500);
  }

  return locations;
}

export async function buildStationItineraries(
  participants: RouteParticipant[],
  locations: PopularMeetingLocation[],
  priority: number,
): Promise<StationItineraryResult[] | Response> {
  const centerCoordinates = getCenterCoordinates(participants);
  const centerLocationDataList = getCenterLocations(
    centerCoordinates,
    locations,
    priority,
  );
  const stationInfoList = await callGoogleMapItineraries(
    participants,
    centerLocationDataList,
  );

  if (
    !stationInfoList.length ||
    stationInfoList.every(station => station.itinerary.length === 0)
  ) {
    return responseJson({ error: 'no route result' }, 500);
  }

  return stationInfoList;
}

export async function createLocationResult(
  supabase: SupabaseClient,
  participants: RouteParticipant[],
): Promise<LocationResultRow | Response> {
  const mapId = crypto.randomUUID();
  const mapHostId = toMapHostId(mapId);

  const { data, error } = await supabase
    .from('location_result')
    .insert({
      map_id: mapId,
      map_host_id: mapHostId,
      request_info: { participant: participants },
      confirmed: null,
    })
    .select('map_id, map_host_id')
    .maybeSingle();

  if (error || !data) {
    return responseJson(
      { msg: 'location_result insert error', detail: error?.message },
      500,
    );
  }

  return data as LocationResultRow;
}

export function buildStationInfoInserts(
  mapId: string,
  participants: RouteParticipant[],
  stationInfoList: StationItineraryResult[],
): StationInfoInsert[] {
  return stationInfoList.map(station => ({
    map_id: mapId,
    share_key: crypto.randomUUID(),
    vote: 0,
    end_x: station.end_x,
    end_y: station.end_y,
    address_name: station.address_name,
    station_name: station.station_name,
    itinerary: station.itinerary,
    request_info: { participant: participants },
  }));
}

export async function insertStationInfo(
  supabase: SupabaseClient,
  mapId: string,
  stationInfoBulk: StationInfoInsert[],
): Promise<Response | null> {
  const { error } = await supabase.from('station_info').insert(stationInfoBulk);

  if (!error) return null;

  await supabase.from('location_result').delete().eq('map_id', mapId);
  return responseJson(
    { msg: 'station_info insert error', detail: error.message },
    500,
  );
}

function isSeoulOrGyeonggi(fullAddress: string): boolean {
  return fullAddress.includes('서울') || fullAddress.includes('경기');
}

function toMapHostId(mapId: string): string {
  return mapId.replace(/-/g, '').slice(0, 8).split('').reverse().join('');
}
