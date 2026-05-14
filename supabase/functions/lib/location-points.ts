import type { SupabaseClient } from 'jsr:@supabase/supabase-js';
import {
  getBalancedMeetingLocations,
  getCenterCoordinates,
} from './distance.ts';
import type {
  LocationPointsRequestBody,
  MeetingPurpose,
  PopularLocationType,
  PopularMeetingLocation,
  RouteParticipant,
  StationInfoInsert,
  StationItineraryResult,
} from './location-types.ts';
import { isMeetingPurpose, isRouteParticipantList } from './location-types.ts';
import { callGoogleMapItineraries } from './mapapi.ts';
import { attachPlaceQualities } from './place-quality.ts';
import { responseApiError, responseJson } from './utils.ts';

export interface LocationPointsRequest {
  participants: RouteParticipant[];
  priority: number;
  meetingPurpose?: MeetingPurpose;
}

interface LocationResultRow {
  map_id: string;
  map_host_id: string;
}

const CANDIDATE_POOL_MULTIPLIER = 2;
const MAX_CANDIDATE_POOL_SIZE = 12;
const MISSING_PARTICIPANT_TIME_PENALTY_SECONDS = 7200;

const RECOMMEND_SCORE_WEIGHTS: Record<
  MeetingPurpose | 'default',
  {
    averageTravelTime: number;
    maxTravelTime: number;
    placeQualityBenefit: number;
    transferPenalty: number;
    walkingTimePenalty: number;
  }
> = {
  default: {
    averageTravelTime: 1,
    maxTravelTime: 0.35,
    placeQualityBenefit: 420,
    transferPenalty: 600,
    walkingTimePenalty: 0.45,
  },
  meal: {
    averageTravelTime: 1,
    maxTravelTime: 0.35,
    placeQualityBenefit: 600,
    transferPenalty: 600,
    walkingTimePenalty: 0.45,
  },
  cafe: {
    averageTravelTime: 0.95,
    maxTravelTime: 0.35,
    placeQualityBenefit: 600,
    transferPenalty: 600,
    walkingTimePenalty: 0.6,
  },
  drink: {
    averageTravelTime: 1,
    maxTravelTime: 0.4,
    placeQualityBenefit: 600,
    transferPenalty: 750,
    walkingTimePenalty: 0.65,
  },
  study: {
    averageTravelTime: 0.9,
    maxTravelTime: 0.55,
    placeQualityBenefit: 480,
    transferPenalty: 650,
    walkingTimePenalty: 0.45,
  },
  date: {
    averageTravelTime: 0.85,
    maxTravelTime: 0.45,
    placeQualityBenefit: 540,
    transferPenalty: 650,
    walkingTimePenalty: 0.7,
  },
  meeting: {
    averageTravelTime: 1,
    maxTravelTime: 0.55,
    placeQualityBenefit: 420,
    transferPenalty: 700,
    walkingTimePenalty: 0.4,
  },
};

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
    return fail(
      responseApiError('invalid_json_body', 'invalid JSON body', 400),
    );
  }

  const participants = body?.participant;
  if (!isRouteParticipantList(participants)) {
    return fail(
      responseApiError('invalid_participant', 'invalid participant', 400),
    );
  }

  const priority = parsePriority(req.url);
  const meetingPurpose = isMeetingPurpose(body?.meetingPurpose)
    ? body.meetingPurpose
    : undefined;

  return ok({
    participants,
    priority,
    meetingPurpose,
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
      responseApiError(
        'candidate_location_empty',
        'popular_meeting_location is empty',
        503,
        { type },
      ),
    );
  }

  return ok(locations);
}

export async function fetchCandidateMeetingLocations(
  supabase: SupabaseClient,
  preferredType: PopularLocationType,
): Promise<StepResult<PopularMeetingLocation[]>> {
  const preferredLocations = await fetchPopularMeetingLocations(
    supabase,
    preferredType,
  );

  if (preferredLocations.ok) {
    return preferredLocations;
  }

  const fallbackType = preferredType === 'station' ? 'terminal' : 'station';
  const fallbackLocations = await fetchPopularMeetingLocations(
    supabase,
    fallbackType,
  );

  if (fallbackLocations.ok) {
    console.error(
      `candidate fallback used: ${preferredType} -> ${fallbackType}`,
    );
    return fallbackLocations;
  }

  return preferredLocations;
}

export async function buildStationItineraries(
  supabase: SupabaseClient,
  participants: RouteParticipant[],
  locations: PopularMeetingLocation[],
  priority: number,
  meetingPurpose?: MeetingPurpose,
): Promise<StepResult<StationItineraryResult[]>> {
  const centerCoordinates = getCenterCoordinates(participants);
  const candidatePoolSize = getCandidatePoolSize(priority, locations.length);
  const centerLocationDataList = getBalancedMeetingLocations(
    centerCoordinates,
    participants,
    locations,
    candidatePoolSize,
  );
  const qualityAdjustedLocationDataList = await attachPlaceQualities(
    supabase,
    centerLocationDataList,
    meetingPurpose,
  );
  const stationInfoList = await callGoogleMapItineraries(
    supabase,
    participants,
    qualityAdjustedLocationDataList,
  );
  const bestStationInfoList = selectBestStationItineraries(
    stationInfoList,
    participants.length,
    priority,
    meetingPurpose,
  );

  if (
    !bestStationInfoList.length ||
    bestStationInfoList.every(station => station.itinerary.length === 0)
  ) {
    return fail(responseApiError('no_route_result', 'no route result', 503));
  }

  return ok(bestStationInfoList);
}

export async function createLocationResult(
  supabase: SupabaseClient,
  participants: RouteParticipant[],
  meetingPurpose?: MeetingPurpose,
): Promise<StepResult<LocationResultRow>> {
  const mapId = crypto.randomUUID();
  const mapHostId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('location_result')
    .insert({
      map_id: mapId,
      map_host_id: mapHostId,
      request_info: { participant: participants, meetingPurpose },
      confirmed: null,
    })
    .select('map_id, map_host_id')
    .maybeSingle();

  if (error || !data) {
    return fail(
      responseApiError(
        'location_result_insert_failed',
        'location_result insert error',
        500,
        error?.message,
      ),
    );
  }

  return ok(data as LocationResultRow);
}

export function buildStationInfoInserts(
  mapId: string,
  participants: RouteParticipant[],
  stationInfoList: StationItineraryResult[],
  meetingPurpose?: MeetingPurpose,
): StationInfoInsert[] {
  return stationInfoList.map(station => ({
    map_id: mapId,
    share_key: crypto.randomUUID(),
    vote: 0,
    end_x: station.end_x,
    end_y: station.end_y,
    recommend_score: station.recommend_score,
    address_name: station.address_name,
    station_name: station.station_name,
    itinerary: station.itinerary,
    request_info: {
      participant: participants,
      meetingPurpose,
      placeQuality: station.place_quality,
    },
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
    responseApiError(
      'station_info_insert_failed',
      'station_info insert error',
      500,
      error.message,
    ),
  );
}

export async function runLocationPointsFlow(
  supabase: SupabaseClient,
  request: LocationPointsRequest,
): Promise<StepResult<LocationResultRow>> {
  const recommendType = resolveRecommendType(request.participants);
  const locations = await fetchCandidateMeetingLocations(
    supabase,
    recommendType,
  );
  if (!locations.ok) return locations;

  const stationInfoList = await buildStationItineraries(
    supabase,
    request.participants,
    locations.data,
    request.priority,
    request.meetingPurpose,
  );
  if (!stationInfoList.ok) return stationInfoList;

  const locationResult = await createLocationResult(
    supabase,
    request.participants,
    request.meetingPurpose,
  );
  if (!locationResult.ok) return locationResult;

  const stationInfoBulk = buildStationInfoInserts(
    locationResult.data.map_id,
    request.participants,
    stationInfoList.data,
    request.meetingPurpose,
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

function getCandidatePoolSize(priority: number, locationCount: number): number {
  return Math.min(
    locationCount,
    Math.max(
      priority,
      Math.min(priority * CANDIDATE_POOL_MULTIPLIER, MAX_CANDIDATE_POOL_SIZE),
    ),
  );
}

function selectBestStationItineraries(
  stationInfoList: StationItineraryResult[],
  participantCount: number,
  priority: number,
  meetingPurpose?: MeetingPurpose,
): StationItineraryResult[] {
  return stationInfoList
    .filter(station => station.itinerary.length > 0)
    .map(station => ({
      ...station,
      recommend_score: getStationItineraryScore(
        station,
        participantCount,
        meetingPurpose,
      ),
    }))
    .sort(
      (a, b) =>
        (a.recommend_score ?? Number.POSITIVE_INFINITY) -
          (b.recommend_score ?? Number.POSITIVE_INFINITY) ||
        a.station_name.localeCompare(b.station_name),
    )
    .slice(0, priority);
}

function getStationItineraryScore(
  station: StationItineraryResult,
  participantCount: number,
  meetingPurpose?: MeetingPurpose,
): number {
  const weights = RECOMMEND_SCORE_WEIGHTS[meetingPurpose ?? 'default'];
  const routeCount = station.itinerary.length;
  const travelTimes = station.itinerary.map(route => route.itinerary.totalTime);
  const totalTravelTime = travelTimes.reduce((sum, time) => sum + time, 0);
  const averageTravelTime = totalTravelTime / routeCount;
  const maxTravelTime = Math.max(...travelTimes);
  const averageTransferCount =
    station.itinerary.reduce(
      (sum, route) => sum + (route.itinerary.transferCount ?? 0),
      0,
    ) / routeCount;
  const averageWalkingTime =
    station.itinerary.reduce(
      (sum, route) => sum + (route.itinerary.walkingTime ?? 0),
      0,
    ) / routeCount;
  const placeQualityBenefit =
    (station.place_quality?.score ?? 0) * weights.placeQualityBenefit;
  const missingParticipantCount = Math.max(participantCount - routeCount, 0);

  return (
    averageTravelTime * weights.averageTravelTime +
    maxTravelTime * weights.maxTravelTime +
    averageTransferCount * weights.transferPenalty +
    averageWalkingTime * weights.walkingTimePenalty +
    missingParticipantCount * MISSING_PARTICIPANT_TIME_PENALTY_SECONDS -
    placeQualityBenefit
  );
}

function parsePriority(url: string): number {
  const parsedPriority = Number(new URL(url).searchParams.get('priority') ?? 4);

  if (!Number.isFinite(parsedPriority)) {
    return 4;
  }

  return Math.min(Math.max(Math.floor(parsedPriority), 1), 10);
}
