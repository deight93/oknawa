import type { SupabaseClient } from 'jsr:@supabase/supabase-js';
import { selectRouteCandidates } from './distance.ts';
import type {
  LocationPointsRequestBody,
  MeetingPurpose,
  MidpointBasis,
  PopularLocationType,
  PopularMeetingLocation,
  RecommendationOptions,
  RouteParticipant,
  StationInfoInsert,
  StationItineraryResult,
} from './location-types.ts';
import {
  getParticipantTravelMode,
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
const FAIRNESS_WINDOW_SECONDS = 300;
const CAR_DISTANCE_TIME_SPREAD_PENALTY_METERS_PER_SECOND = 3;
const DEFAULT_RECOMMENDATION_OPTIONS: RecommendationOptions = {
  travelMode: 'transit',
  midpointBasis: 'time',
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
    participants: participants.map(participant => ({
      ...participant,
      travel_mode: getParticipantTravelMode(participant, travelMode),
    })),
    priority,
    meetingPurpose,
    recommendationOptions: {
      travelMode: participants.every(
        participant =>
          getParticipantTravelMode(participant, travelMode) ===
          getParticipantTravelMode(participants[0], travelMode),
      )
        ? getParticipantTravelMode(participants[0], travelMode)
        : 'mixed',
      midpointBasis,
    },
  });
}

export function resolveRecommendType(
  participants: RouteParticipant[],
  recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
): PopularLocationType {
  const hasNonMetropolitan = participants.some(
    participant => !isMetropolitanAddress(participant.full_address),
  );

  if (
    participants.every(
      participant =>
        getParticipantTravelMode(
          participant,
          recommendationOptions.travelMode,
        ) === 'car',
    )
  ) {
    return hasNonMetropolitan ? 'city' : 'local_area';
  }

  return hasNonMetropolitan ? 'terminal' : 'station';
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
  const metropolitanTypes: PopularLocationType[] =
    preferredType === 'station'
      ? ['station', 'local_area']
      : preferredType === 'local_area'
        ? ['local_area', 'station']
        : [];
  if (metropolitanTypes.length) {
    const pools = await Promise.all(
      metropolitanTypes.map(type =>
        fetchPopularMeetingLocations(supabase, type),
      ),
    );
    const combined = pools.flatMap(pool => (pool.ok ? pool.data : []));
    if (combined.length) return ok(combined);
  }

  for (const candidateType of [preferredType, ...fallbackTypes]) {
    if (metropolitanTypes.includes(candidateType)) continue;
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
  const candidatePoolSize = getCandidatePoolSize(
    priority,
    locations.length,
    recommendationOptions,
  );
  const rankedLocationDataList = selectRouteCandidates(
    participants,
    locations,
    candidatePoolSize,
    recommendationOptions,
  );
  const qualityAdjustedLocationDataList = await attachPlaceQualities(
    supabase,
    rankedLocationDataList,
    meetingPurpose,
  );
  const stationInfoList = await callGoogleMapItineraries(
    supabase,
    participants,
    qualityAdjustedLocationDataList,
    recommendationOptions.travelMode === 'mixed'
      ? 'transit'
      : recommendationOptions.travelMode,
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

function isMetropolitanAddress(fullAddress: string): boolean {
  return /^(서울|경기|인천)/.test(fullAddress.trim());
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
    Math.max(priority, Math.min(priority * multiplier, maxCandidatePoolSize)),
  );
}

export function selectBestStationItineraries(
  stationInfoList: StationItineraryResult[],
  participantCount: number,
  priority: number,
  _meetingPurpose?: MeetingPurpose,
  recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
): StationItineraryResult[] {
  if (participantCount < 1) return [];
  const complete = stationInfoList.filter(
    station =>
      station.itinerary.length === participantCount &&
      station.itinerary.every(
        route =>
          Number.isFinite(route.itinerary.totalTime) &&
          route.itinerary.totalTime >= 0,
      ),
  );
  const candidates =
    recommendationOptions.midpointBasis === 'distance'
      ? complete
      : complete.filter(
          candidate =>
            !complete.some(
              other =>
                other !== candidate &&
                other.itinerary.every(
                  (route, index) =>
                    route.itinerary.totalTime <=
                    candidate.itinerary[index].itinerary.totalTime,
                ) &&
                other.itinerary.some(
                  (route, index) =>
                    route.itinerary.totalTime <
                    candidate.itinerary[index].itinerary.totalTime,
                ),
            ),
        );
  const scored = candidates.map(station => ({
    station,
    metrics: getStationRouteMetrics(station, recommendationOptions),
  }));
  const bestMaxTime = Math.min(
    ...scored.map(item => item.metrics.maxTravelTime),
  );

  return scored
    .sort((a, b) => {
      const stableTie = () =>
        a.station.station_name.localeCompare(b.station.station_name) ||
        a.station.end_x - b.station.end_x ||
        a.station.end_y - b.station.end_y;
      if (recommendationOptions.midpointBasis === 'distance') {
        return (
          getDistanceBasisScore(a.station, a.metrics) -
            getDistanceBasisScore(b.station, b.metrics) || stableTie()
        );
      }
      // Compare against one group-wide threshold, not a pairwise tolerance:
      // pairwise "within five minutes" comparisons are not transitive.
      const aWithin =
        a.metrics.maxTravelTime <= bestMaxTime + FAIRNESS_WINDOW_SECONDS;
      const bWithin =
        b.metrics.maxTravelTime <= bestMaxTime + FAIRNESS_WINDOW_SECONDS;
      if (aWithin !== bWithin) return aWithin ? -1 : 1;
      return (
        (aWithin
          ? a.metrics.travelTimeSpread - b.metrics.travelTimeSpread ||
            a.metrics.maxTravelTime - b.metrics.maxTravelTime
          : a.metrics.maxTravelTime - b.metrics.maxTravelTime ||
            a.metrics.travelTimeSpread - b.metrics.travelTimeSpread) ||
        a.metrics.averageTravelTime - b.metrics.averageTravelTime ||
        a.metrics.averageTransferCount - b.metrics.averageTransferCount ||
        a.metrics.averageWalkingTime - b.metrics.averageWalkingTime ||
        (b.station.place_quality?.score ?? 0) -
          (a.station.place_quality?.score ?? 0) ||
        stableTie()
      );
    })
    .slice(0, priority)
    .map(({ station }, index) => ({
      ...station,
      // Existing result/share clients sort this numeric field ascending.
      recommend_score: index,
    }));
}

function getDistanceBasisScore(
  station: StationItineraryResult,
  metrics: StationRouteMetrics,
): number {
  return (
    (station.distance_score ?? Number.POSITIVE_INFINITY) +
    metrics.travelTimeSpread *
      CAR_DISTANCE_TIME_SPREAD_PENALTY_METERS_PER_SECOND
  );
}

interface StationRouteMetrics {
  averageTravelTime: number;
  maxTravelTime: number;
  averageTransferCount: number;
  averageWalkingTime: number;
  travelTimeSpread: number;
}

function getStationRouteMetrics(
  station: StationItineraryResult,
  options: RecommendationOptions,
): StationRouteMetrics {
  const routeCount = station.itinerary.length;
  const travelTimes = station.itinerary.map(route => route.itinerary.totalTime);
  const totalTravelTime = travelTimes.reduce((sum, time) => sum + time, 0);
  const averageTravelTime = routeCount ? totalTravelTime / routeCount : 0;
  const maxTravelTime = travelTimes.length ? Math.max(...travelTimes) : 0;
  const minTravelTime = travelTimes.length ? Math.min(...travelTimes) : 0;
  const averageTransferCount = routeCount
    ? station.itinerary.reduce(
        (sum, route) =>
          sum +
          (getParticipantTravelMode(route, options.travelMode) === 'transit'
            ? (route.itinerary.transferCount ?? 0)
            : 0),
        0,
      ) / routeCount
    : 0;
  const averageWalkingTime = routeCount
    ? station.itinerary.reduce(
        (sum, route) =>
          sum +
          (getParticipantTravelMode(route, options.travelMode) !== 'car'
            ? (route.itinerary.walkingTime ?? 0)
            : 0),
        0,
      ) / routeCount
    : 0;

  return {
    averageTravelTime,
    maxTravelTime,
    averageTransferCount,
    averageWalkingTime,
    travelTimeSpread: Math.max(maxTravelTime - minTravelTime, 0),
  };
}

function parsePriority(url: string): number {
  const parsedPriority = Number(new URL(url).searchParams.get('priority') ?? 4);

  if (!Number.isFinite(parsedPriority)) {
    return 4;
  }

  return Math.min(Math.max(Math.floor(parsedPriority), 1), 10);
}
