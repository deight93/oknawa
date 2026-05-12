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

export interface LocationPointsRequest {
  participants: RouteParticipant[];
  priority: number;
}

interface LocationResultRow {
  map_id: string;
  map_host_id: string;
}

export type StepResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

const ok = <T>(data: T): StepResult<T> => ({ ok: true, data });
const fail = (response: Response): StepResult<never> => ({
  ok: false,
  response,
});

export async function parseLocationPointsRequest(
  req: Request,
): Promise<StepResult<LocationPointsRequest>> {
  let body: LocationPointsRequestBody | null = null;

  try {
    body = (await req.json()) as LocationPointsRequestBody;
  } catch {
    return fail(responseJson({ error: 'invalid JSON body' }, 400));
  }

  const participants = body?.participant;
  if (!isRouteParticipantList(participants)) {
    return fail(responseJson({ error: 'invalid participant' }, 400));
  }

  const priority = Number(new URL(req.url).searchParams.get('priority') ?? '4');

  return ok({
    participants,
    priority,
  });
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
): Promise<StepResult<PopularMeetingLocation[]>> {
  const { data, error } = await supabase
    .from('popular_meeting_location')
    .select('*')
    .eq('type', type)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);

  const locations = (data ?? []) as PopularMeetingLocation[];
  if (!locations.length) {
    return fail(
      responseJson({ error: 'popular_meeting_location is empty' }, 500),
    );
  }

  return ok(locations);
}

export async function buildStationItineraries(
  participants: RouteParticipant[],
  locations: PopularMeetingLocation[],
  priority: number,
): Promise<StepResult<StationItineraryResult[]>> {
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
    return fail(responseJson({ error: 'no route result' }, 500));
  }

  return ok(stationInfoList);
}

export async function createLocationResult(
  supabase: SupabaseClient,
  participants: RouteParticipant[],
): Promise<StepResult<LocationResultRow>> {
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
    return fail(
      responseJson(
        { msg: 'location_result insert error', detail: error?.message },
        500,
      ),
    );
  }

  return ok(data as LocationResultRow);
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
): Promise<StepResult<null>> {
  const { error } = await supabase.from('station_info').insert(stationInfoBulk);

  if (!error) return ok(null);

  await supabase.from('location_result').delete().eq('map_id', mapId);
  return fail(
    responseJson(
      { msg: 'station_info insert error', detail: error.message },
      500,
    ),
  );
}

export async function runLocationPointsFlow(
  supabase: SupabaseClient,
  request: LocationPointsRequest,
): Promise<StepResult<LocationResultRow>> {
  const recommendType = resolveRecommendType(request.participants);
  const locations = await fetchPopularMeetingLocations(supabase, recommendType);
  if (!locations.ok) return locations;

  const stationInfoList = await buildStationItineraries(
    request.participants,
    locations.data,
    request.priority,
  );
  if (!stationInfoList.ok) return stationInfoList;

  const locationResult = await createLocationResult(
    supabase,
    request.participants,
  );
  if (!locationResult.ok) return locationResult;

  const stationInfoBulk = buildStationInfoInserts(
    locationResult.data.map_id,
    request.participants,
    stationInfoList.data,
  );

  const stationInsert = await insertStationInfo(
    supabase,
    locationResult.data.map_id,
    stationInfoBulk,
  );
  if (!stationInsert.ok) return stationInsert;

  return locationResult;
}

function isSeoulOrGyeonggi(fullAddress: string): boolean {
  return fullAddress.includes('서울') || fullAddress.includes('경기');
}

function toMapHostId(mapId: string): string {
  return mapId.replace(/-/g, '').slice(0, 8).split('').reverse().join('');
}
