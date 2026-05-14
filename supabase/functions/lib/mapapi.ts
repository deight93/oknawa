import polyline from 'https://esm.sh/@mapbox/polyline';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js';
import { getEnv } from './env.ts';
import type {
  PopularMeetingLocation,
  RouteItinerary,
  RouteParticipant,
  StationItineraryResult,
} from './location-types.ts';
import { fetchJson } from './utils.ts';

interface GoogleRoute {
  duration?: string;
  legs?: GoogleRouteLeg[];
  polyline?: {
    encodedPolyline?: string;
  };
}

interface GoogleRouteLeg {
  steps?: GoogleRouteLegStep[];
}

interface GoogleRouteLegStep {
  distanceMeters?: number;
  staticDuration?: string;
  travelMode?: string;
}

interface GoogleRoutesResponse {
  routes?: GoogleRoute[];
}

interface RouteCacheRow {
  route_key: string;
  route_payload: RouteItinerary['itinerary'];
}

interface RouteCacheUpsert {
  route_key: string;
  route_payload: RouteItinerary['itinerary'];
  origin_x: number;
  origin_y: number;
  destination_x: number;
  destination_y: number;
  travel_mode: 'SUBWAY';
  expires_at: string;
  updated_at: string;
}

interface RouteRequest {
  routeKey: string;
  stationIndex: number;
  participantIndex: number;
  station: PopularMeetingLocation;
  participant: RouteParticipant;
}

interface RouteResult {
  stationIndex: number;
  participantIndex: number;
  route: RouteItinerary;
}

const ROUTE_CACHE_TTL_DAYS = 30;
const ROUTE_CONCURRENCY_LIMIT = 4;
const ROUTE_KEY_VERSION = 'v1';

export async function callGoogleMapItineraries(
  supabase: SupabaseClient,
  participants: RouteParticipant[],
  stations: PopularMeetingLocation[],
): Promise<StationItineraryResult[]> {
  const GOOGLE_API_KEY = getEnv('GOOGLE_API_KEY');
  const GOOGLE_API_URL = getEnv('GOOGLE_API_URL');

  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_API_KEY,
    'X-Goog-FieldMask':
      'routes.duration,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.polyline.encodedPolyline',
  };

  const routeRequests = buildRouteRequests(participants, stations);
  const routeCacheMap = await fetchRouteCacheMap(
    supabase,
    routeRequests.map(request => request.routeKey),
  );
  const cacheUpserts: RouteCacheUpsert[] = [];
  const routeResults = await mapWithConcurrency(
    routeRequests,
    ROUTE_CONCURRENCY_LIMIT,
    async request => {
      const cachedItinerary = routeCacheMap.get(request.routeKey);
      if (cachedItinerary) {
        return toRouteResult(request, cachedItinerary);
      }

      const itinerary = await fetchGoogleRouteItinerarySafely(
        request.participant,
        request.station,
        headers,
        GOOGLE_API_URL,
      );
      if (!itinerary) return null;

      cacheUpserts.push(toRouteCacheUpsert(request, itinerary));
      return toRouteResult(request, itinerary);
    },
  );
  const resultList = routeResults.some(Boolean)
    ? routeResults
    : routeRequests.map(request =>
        toRouteResult(
          request,
          createEstimatedRouteItinerary(request.participant, request.station),
        ),
      );

  if (cacheUpserts.length > 0) {
    await upsertRouteCache(supabase, cacheUpserts);
  }

  return stations.map((station, stationIndex) => {
    const itineraryList = resultList
      .filter(
        (result): result is RouteResult =>
          isRouteResult(result) && result.stationIndex === stationIndex,
      )
      .sort((a, b) => a.participantIndex - b.participantIndex)
      .map(result => result.route);

    return {
      station_name: station.name,
      address_name: station.address,
      end_x: Number(station.location_x),
      end_y: Number(station.location_y),
      itinerary: itineraryList,
      place_quality: station.place_quality,
    };
  });
}

function isRouteResult(result: RouteResult | null): result is RouteResult {
  return result !== null;
}

function parseDuration(durationStr: string): number {
  return parseInt(durationStr.replace('s', ''));
}

function summarizeRouteMetrics(route: GoogleRoute) {
  const steps = route.legs?.flatMap(leg => leg.steps ?? []) ?? [];
  const transitStepCount = steps.filter(
    step => step.travelMode === 'TRANSIT',
  ).length;
  const walkingSteps = steps.filter(step => step.travelMode === 'WALK');
  const walkingTime = walkingSteps.reduce(
    (sum, step) => sum + parseDuration(step.staticDuration ?? '0s'),
    0,
  );
  const walkingDistance = walkingSteps.reduce(
    (sum, step) => sum + (step.distanceMeters ?? 0),
    0,
  );

  return {
    transferCount: Math.max(transitStepCount - 1, 0),
    walkingDistance,
    walkingTime,
  };
}

function buildRouteRequests(
  participants: RouteParticipant[],
  stations: PopularMeetingLocation[],
): RouteRequest[] {
  return stations.flatMap((station, stationIndex) =>
    participants.map((participant, participantIndex) => ({
      routeKey: buildRouteCacheKey(participant, station),
      stationIndex,
      participantIndex,
      station,
      participant,
    })),
  );
}

async function fetchRouteCacheMap(
  supabase: SupabaseClient,
  routeKeys: string[],
): Promise<Map<string, RouteItinerary['itinerary']>> {
  if (routeKeys.length === 0) return new Map();

  const { data, error } = await supabase
    .from('route_itinerary_cache')
    .select('route_key, route_payload')
    .in('route_key', Array.from(new Set(routeKeys)))
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('route cache select error:', error.message);
    return new Map();
  }

  return new Map(
    ((data ?? []) as RouteCacheRow[]).map(row => [
      row.route_key,
      row.route_payload,
    ]),
  );
}

async function upsertRouteCache(
  supabase: SupabaseClient,
  cacheUpserts: RouteCacheUpsert[],
) {
  const uniqueCacheUpserts = Array.from(
    new Map(cacheUpserts.map(cache => [cache.route_key, cache])).values(),
  );
  const { error } = await supabase
    .from('route_itinerary_cache')
    .upsert(uniqueCacheUpserts, { onConflict: 'route_key' });

  if (error) {
    console.error('route cache upsert error:', error.message);
  }
}

async function fetchGoogleRouteItinerary(
  participant: RouteParticipant,
  station: PopularMeetingLocation,
  headers: Record<string, string>,
  googleApiUrl: string,
): Promise<RouteItinerary['itinerary'] | null> {
  const origin = {
    location: {
      latLng: {
        latitude: participant.start_y,
        longitude: participant.start_x,
      },
    },
  };

  const destination = {
    location: {
      latLng: {
        latitude: Number(station.location_y),
        longitude: Number(station.location_x),
      },
    },
  };

  const payload = {
    origin,
    destination,
    travelMode: 'TRANSIT',
    transitPreferences: {
      allowedTravelModes: ['SUBWAY'],
    },
    languageCode: 'ko-KR',
  };

  const json = await fetchJson<GoogleRoutesResponse>(
    `${googleApiUrl}/directions/v2:computeRoutes`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      errorMessage: 'Google Routes API 조회 실패',
    },
  );

  const route = json.routes?.[0];
  const polylineEncoded = route?.polyline?.encodedPolyline;
  if (!route?.duration || !polylineEncoded) return null;

  const durationSeconds = parseDuration(route.duration);
  const routeMetrics = summarizeRouteMetrics(route);
  const decodedPolyline = polyline.decode(polylineEncoded);
  const totalPolyline = decodedPolyline.map(([lat, lng]) => ({ lat, lng }));

  return {
    totalTime: durationSeconds,
    transferCount: routeMetrics.transferCount,
    walkingDistance: routeMetrics.walkingDistance,
    walkingTime: routeMetrics.walkingTime,
    total_polyline: totalPolyline,
  };
}

async function fetchGoogleRouteItinerarySafely(
  participant: RouteParticipant,
  station: PopularMeetingLocation,
  headers: Record<string, string>,
  googleApiUrl: string,
): Promise<RouteItinerary['itinerary'] | null> {
  try {
    return await fetchGoogleRouteItinerary(
      participant,
      station,
      headers,
      googleApiUrl,
    );
  } catch (error) {
    console.error('Google route request failed:', error);
    return null;
  }
}

function createEstimatedRouteItinerary(
  participant: RouteParticipant,
  station: PopularMeetingLocation,
): RouteItinerary['itinerary'] {
  const destinationLat = Number(station.location_y);
  const destinationLng = Number(station.location_x);
  const distanceMeters = getDistanceMeters(
    [participant.start_x, participant.start_y],
    [destinationLng, destinationLat],
  );
  const estimatedSeconds = Math.max(
    600,
    Math.round((distanceMeters / 1000 / 25) * 3600),
  );

  return {
    totalTime: estimatedSeconds,
    transferCount: 0,
    walkingDistance: 0,
    walkingTime: 0,
    total_polyline: [
      { lat: participant.start_y, lng: participant.start_x },
      { lat: destinationLat, lng: destinationLng },
    ],
  };
}

function toRouteResult(
  request: RouteRequest,
  itinerary: RouteItinerary['itinerary'],
): RouteResult {
  return {
    stationIndex: request.stationIndex,
    participantIndex: request.participantIndex,
    route: {
      name: request.participant.name,
      region_name: request.participant.region_name,
      itinerary,
    },
  };
}

function toRouteCacheUpsert(
  request: RouteRequest,
  itinerary: RouteItinerary['itinerary'],
): RouteCacheUpsert {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + ROUTE_CACHE_TTL_DAYS);

  return {
    route_key: request.routeKey,
    route_payload: itinerary,
    origin_x: request.participant.start_x,
    origin_y: request.participant.start_y,
    destination_x: Number(request.station.location_x),
    destination_y: Number(request.station.location_y),
    travel_mode: 'SUBWAY',
    expires_at: expiresAt.toISOString(),
    updated_at: now.toISOString(),
  };
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrencyLimit: number,
  mapper: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrencyLimit, items.length) }, () =>
      worker(),
    ),
  );

  return results;
}

function buildRouteCacheKey(
  participant: RouteParticipant,
  station: PopularMeetingLocation,
): string {
  return [
    ROUTE_KEY_VERSION,
    'subway',
    normalizeCoordinate(participant.start_x),
    normalizeCoordinate(participant.start_y),
    normalizeCoordinate(station.location_x),
    normalizeCoordinate(station.location_y),
  ].join(':');
}

function normalizeCoordinate(value: number | string): string {
  return Number(value).toFixed(5);
}

const EARTH_RADIUS_METERS = 6371000;

function getDistanceMeters(
  fromCoordinates: [number, number],
  toCoordinates: [number, number],
): number {
  const [fromLng, fromLat] = fromCoordinates;
  const [toLng, toLat] = toCoordinates;
  const fromLatRad = toRadians(fromLat);
  const toLatRad = toRadians(toLat);
  const deltaLatRad = toRadians(toLat - fromLat);
  const deltaLngRad = toRadians(toLng - fromLng);
  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(fromLatRad) *
      Math.cos(toLatRad) *
      Math.sin(deltaLngRad / 2) *
      Math.sin(deltaLngRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
