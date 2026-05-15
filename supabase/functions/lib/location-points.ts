import type { SupabaseClient } from 'jsr:@supabase/supabase-js';
import {
  getCenterCoordinates,
  getScoredMeetingLocationCandidates,
} from './distance.ts';
import type {
  LocationPointsRequestBody,
  MidpointBasis,
  MeetingPurpose,
  PopularLocationType,
  PopularMeetingLocation,
  RecommendationOptions,
  RouteParticipant,
  StationInfoInsert,
  StationItineraryResult,
} from './location-types.ts';
import {
  isMeetingPurpose,
  isMidpointBasis,
  isRouteParticipantList,
  isTravelMode,
} from './location-types.ts';
import { callGoogleMapItineraries } from './mapapi.ts';
import { attachPlaceQualities } from './place-quality.ts';
import { responseApiError, responseJson } from './utils.ts';

export interface LocationPointsRequest {
  participants: RouteParticipant[];
  priority: number;
  meetingPurpose?: MeetingPurpose;
  recommendationOptions: RecommendationOptions;
}

interface LocationResultRow {
  map_id: string;
  map_host_id: string;
}

const CANDIDATE_POOL_MULTIPLIER = 2;
const MAX_CANDIDATE_POOL_SIZE = 12;
const CAR_TIME_CANDIDATE_POOL_MULTIPLIER = 4;
const MAX_CAR_TIME_CANDIDATE_POOL_SIZE = 20;
const MISSING_PARTICIPANT_TIME_PENALTY_SECONDS = 7200;
const MISSING_PARTICIPANT_DISTANCE_PENALTY_METERS = 100000;
const CAR_DISTANCE_TIME_SPREAD_PENALTY_METERS_PER_SECOND = 3;
const DEFAULT_RECOMMENDATION_OPTIONS: RecommendationOptions = {
  travelMode: 'transit',
  midpointBasis: 'time',
};

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
  const travelMode = isTravelMode(body?.travelMode)
    ? body.travelMode
    : DEFAULT_RECOMMENDATION_OPTIONS.travelMode;
  const midpointBasis = isMidpointBasis(body?.midpointBasis)
    ? body.midpointBasis
    : DEFAULT_RECOMMENDATION_OPTIONS.midpointBasis;

  return ok({
    participants,
    priority,
    meetingPurpose,
    recommendationOptions: {
      travelMode,
      midpointBasis,
    },
  });
}

export function resolveRecommendType(
  participants: RouteParticipant[],
  recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
): PopularLocationType {
  const hasNonSeoulGyeonggi = participants.some(
    participant => !isSeoulOrGyeonggi(participant.full_address),
  );

  if (recommendationOptions.travelMode === 'car') {
    return hasNonSeoulGyeonggi ? 'city' : 'local_area';
  }

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
  const fallbackTypes = getCandidateFallbackTypes(preferredType);

  for (const candidateType of [preferredType, ...fallbackTypes]) {
    const locations = await fetchPopularMeetingLocations(
      supabase,
      candidateType,
    );

    if (!locations.ok) continue;

    if (candidateType !== preferredType) {
      console.error(
        `candidate fallback used: ${preferredType} -> ${candidateType}`,
      );
    }
    return locations;
  }

  return fetchPopularMeetingLocations(supabase, preferredType);
}

export async function buildStationItineraries(
  supabase: SupabaseClient,
  participants: RouteParticipant[],
  locations: PopularMeetingLocation[],
  priority: number,
  meetingPurpose?: MeetingPurpose,
  recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
): Promise<StepResult<StationItineraryResult[]>> {
  const centerCoordinates = getCenterCoordinates(participants);
  const candidatePoolSize = getCandidatePoolSize(
    priority,
    locations.length,
    recommendationOptions,
  );
  const centerLocationDataList = getScoredMeetingLocationCandidates(
    centerCoordinates,
    participants,
    locations,
  );
  const rankedLocationDataList = centerLocationDataList
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.maxParticipantDistanceMeters - b.maxParticipantDistanceMeters ||
        a.centerDistanceMeters - b.centerDistanceMeters ||
        a.station.name.localeCompare(b.station.name),
    )
    .slice(0, candidatePoolSize)
    .map(item => ({
      ...item.station,
      distance_score: item.score,
    }));
  const qualityAdjustedLocationDataList = await attachPlaceQualities(
    supabase,
    rankedLocationDataList,
    meetingPurpose,
  );
  const stationInfoList = await callGoogleMapItineraries(
    supabase,
    participants,
    qualityAdjustedLocationDataList,
    recommendationOptions.travelMode,
  );
  const bestStationInfoList = selectBestStationItineraries(
    stationInfoList,
    participants.length,
    priority,
    meetingPurpose,
    recommendationOptions,
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
  recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
  resultType?: PopularLocationType,
): Promise<StepResult<LocationResultRow>> {
  const mapId = crypto.randomUUID();
  const mapHostId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('location_result')
    .insert({
      map_id: mapId,
      map_host_id: mapHostId,
      request_info: {
        participant: participants,
        meetingPurpose,
        recommendationOptions,
        resultType,
      },
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
  recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
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
      recommendationOptions,
      resultType: station.result_type,
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
  const recommendType = resolveRecommendType(
    request.participants,
    request.recommendationOptions,
  );
  const locations = await fetchCandidateMeetingLocations(
    supabase,
    recommendType,
  );
  if (!locations.ok) return locations;
  const actualRecommendType = locations.data[0]?.type ?? recommendType;

  const stationInfoList = await buildStationItineraries(
    supabase,
    request.participants,
    locations.data,
    request.priority,
    request.meetingPurpose,
    request.recommendationOptions,
  );
  if (!stationInfoList.ok) return stationInfoList;

  const locationResult = await createLocationResult(
    supabase,
    request.participants,
    request.meetingPurpose,
    request.recommendationOptions,
    actualRecommendType,
  );
  if (!locationResult.ok) return locationResult;

  const stationInfoBulk = buildStationInfoInserts(
    locationResult.data.map_id,
    request.participants,
    stationInfoList.data,
    request.meetingPurpose,
    request.recommendationOptions,
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

function getCandidateFallbackTypes(
  preferredType: PopularLocationType,
): PopularLocationType[] {
  switch (preferredType) {
    case 'local_area':
      return ['station', 'terminal'];
    case 'city':
      return ['terminal', 'station'];
    case 'station':
      return ['terminal', 'local_area'];
    case 'terminal':
      return ['city', 'station'];
  }
}

export function getCandidatePoolSize(
  priority: number,
  locationCount: number,
  recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
): number {
  const isCarTimeRecommendation =
    recommendationOptions.travelMode === 'car' &&
    recommendationOptions.midpointBasis === 'time';
  const multiplier = isCarTimeRecommendation
    ? CAR_TIME_CANDIDATE_POOL_MULTIPLIER
    : CANDIDATE_POOL_MULTIPLIER;
  const maxCandidatePoolSize = isCarTimeRecommendation
    ? MAX_CAR_TIME_CANDIDATE_POOL_SIZE
    : MAX_CANDIDATE_POOL_SIZE;

  return Math.min(
    locationCount,
    Math.max(
      priority,
      Math.min(priority * multiplier, maxCandidatePoolSize),
    ),
  );
}

export function selectBestStationItineraries(
  stationInfoList: StationItineraryResult[],
  participantCount: number,
  priority: number,
  meetingPurpose?: MeetingPurpose,
  recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
): StationItineraryResult[] {
  return stationInfoList
    .filter(station => station.itinerary.length > 0)
    .map(station => ({
      ...station,
      recommend_score: getStationItineraryScore(
        station,
        participantCount,
        meetingPurpose,
        recommendationOptions,
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
  recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
): number {
  const metrics = getStationRouteMetrics(station, participantCount);

  if (recommendationOptions.travelMode === 'car') {
    return getCarItineraryScore(station, metrics, recommendationOptions);
  }

  if (recommendationOptions.midpointBasis === 'distance') {
    return getDistanceBasisScore(station, metrics);
  }

  return getTransitTimeBasisScore(station, metrics, meetingPurpose);
}

function getTransitTimeBasisScore(
  station: StationItineraryResult,
  metrics: StationRouteMetrics,
  meetingPurpose?: MeetingPurpose,
): number {
  const weights = RECOMMEND_SCORE_WEIGHTS[meetingPurpose ?? 'default'];
  const placeQualityBenefit =
    (station.place_quality?.score ?? 0) * weights.placeQualityBenefit;

  return (
    metrics.averageTravelTime * weights.averageTravelTime +
    metrics.maxTravelTime * weights.maxTravelTime +
    metrics.averageTransferCount * weights.transferPenalty +
    metrics.averageWalkingTime * weights.walkingTimePenalty +
    metrics.missingParticipantCount * MISSING_PARTICIPANT_TIME_PENALTY_SECONDS -
    placeQualityBenefit
  );
}

function getCarItineraryScore(
  station: StationItineraryResult,
  metrics: StationRouteMetrics,
  recommendationOptions: RecommendationOptions,
): number {
  if (recommendationOptions.midpointBasis === 'distance') {
    return getDistanceBasisScore(station, metrics);
  }

  return (
    metrics.averageTravelTime +
    metrics.maxTravelTime * 0.35 +
    metrics.missingParticipantCount * MISSING_PARTICIPANT_TIME_PENALTY_SECONDS
  );
}

function getDistanceBasisScore(
  station: StationItineraryResult,
  metrics: StationRouteMetrics,
): number {
  return (
    (station.distance_score ?? Number.POSITIVE_INFINITY) +
    metrics.travelTimeSpread *
      CAR_DISTANCE_TIME_SPREAD_PENALTY_METERS_PER_SECOND +
    metrics.missingParticipantCount * MISSING_PARTICIPANT_DISTANCE_PENALTY_METERS
  );
}

interface StationRouteMetrics {
  averageTravelTime: number;
  maxTravelTime: number;
  averageTransferCount: number;
  averageWalkingTime: number;
  travelTimeSpread: number;
  missingParticipantCount: number;
}

function getStationRouteMetrics(
  station: StationItineraryResult,
  participantCount: number,
): StationRouteMetrics {
  const routeCount = station.itinerary.length;
  const travelTimes = station.itinerary.map(route => route.itinerary.totalTime);
  const totalTravelTime = travelTimes.reduce((sum, time) => sum + time, 0);
  const averageTravelTime = routeCount ? totalTravelTime / routeCount : 0;
  const maxTravelTime = travelTimes.length ? Math.max(...travelTimes) : 0;
  const minTravelTime = travelTimes.length ? Math.min(...travelTimes) : 0;
  const averageTransferCount = routeCount
    ? station.itinerary.reduce(
        (sum, route) => sum + (route.itinerary.transferCount ?? 0),
        0,
      ) / routeCount
    : 0;
  const averageWalkingTime = routeCount
    ? station.itinerary.reduce(
        (sum, route) => sum + (route.itinerary.walkingTime ?? 0),
        0,
      ) / routeCount
    : 0;

  return {
    averageTravelTime,
    maxTravelTime,
    averageTransferCount,
    averageWalkingTime,
    travelTimeSpread: Math.max(maxTravelTime - minTravelTime, 0),
    missingParticipantCount: Math.max(participantCount - routeCount, 0),
  };
}

function parsePriority(url: string): number {
  const parsedPriority = Number(new URL(url).searchParams.get('priority') ?? 4);

  if (!Number.isFinite(parsedPriority)) {
    return 4;
  }

  return Math.min(Math.max(Math.floor(parsedPriority), 1), 10);
}
