// @deno-types="npm:@types/mapbox__polyline@1.0.5"
import polyline from 'npm:@mapbox/polyline@1.2.1';
import { getEnv } from './env.ts';
import type {
  PolylinePoint,
  PopularMeetingLocation,
  RouteItinerary,
  RouteParticipant,
  RouteSegment,
  TravelMode,
} from './location-types.ts';
import { fetchJson } from './utils.ts';

interface GoogleRoute {
  duration?: string;
  polyline?: { encodedPolyline?: string };
  legs?: Array<{
    steps?: Array<{
      travelMode?: string;
      staticDuration?: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
    }>;
  }>;
}
interface KakaoCarRoute {
  result_code?: number;
  summary?: { duration?: number };
  sections?: Array<{ roads?: Array<{ vertexes?: number[] }> }>;
}
interface KakaoWalkRoute {
  properties?: { totalTime?: number; totalDistance?: number };
  legs?: Array<{ steps?: Array<{ path?: { points?: number[][] } }> }>;
}

const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function duration(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?s$/.test(value)) return null;
  const seconds = Number(value.slice(0, -1));
  return nonnegative(seconds) ? Math.ceil(seconds) : null;
}

function point(lng: number, lat: number): PolylinePoint[] {
  return Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
    ? [{ lat, lng }]
    : [];
}

function decodePolyline(encoded: unknown): Array<[number, number]> {
  if (typeof encoded !== 'string' || !encoded) return [];
  try {
    const coordinates = polyline.decode(encoded);
    if (
      coordinates.some(
        ([lat, lng]) => !Number.isFinite(lat) || !Number.isFinite(lng),
      )
    )
      return [];
    // The decoder tolerates truncated strings; reject those before drawing.
    return polyline.encode(coordinates) === encoded ? coordinates : [];
  } catch {
    return [];
  }
}

function googleSegments(legs: GoogleRoute['legs']): RouteSegment[] | undefined {
  if (!Array.isArray(legs) || legs.length === 0) return undefined;
  const segments: RouteSegment[] = [];
  for (const leg of legs) {
    if (!Array.isArray(leg?.steps) || leg.steps.length === 0) return undefined;
    for (const step of leg.steps) {
      const mode =
        step?.travelMode === 'WALK'
          ? 'walk'
          : step?.travelMode === 'TRANSIT'
            ? 'transit'
            : undefined;
      if (!mode) return undefined;
      const coordinates = decodePolyline(step.polyline?.encodedPolyline);
      const points = coordinates.flatMap(([lat, lng]) => point(lng, lat));
      if (points.length < 2 || points.length !== coordinates.length)
        return undefined;
      segments.push({ mode, polyline: points });
    }
  }
  return segments;
}

async function googleTransit(
  participant: RouteParticipant,
  station: PopularMeetingLocation,
  departureTime: string,
): Promise<RouteItinerary['itinerary'] | null> {
  const json = await fetchJson<{ routes?: GoogleRoute[] }>(
    `${getEnv('GOOGLE_API_URL')}/directions/v2:computeRoutes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getEnv('GOOGLE_API_KEY'),
        'X-Goog-FieldMask':
          'routes.duration,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.legs.steps.polyline.encodedPolyline,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: participant.start_y,
              longitude: participant.start_x,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: Number(station.location_y),
              longitude: Number(station.location_x),
            },
          },
        },
        travelMode: 'TRANSIT',
        languageCode: 'ko-KR',
        departureTime,
      }),
      signal: AbortSignal.timeout(10000),
      errorMessage: 'Google 대중교통 경로 조회 실패',
    },
  );
  const route = json.routes?.[0];
  const totalTime = duration(route?.duration);
  if (!route || totalTime === null) return null;
  const steps = Array.isArray(route.legs)
    ? route.legs.flatMap(leg => (Array.isArray(leg?.steps) ? leg.steps : []))
    : [];
  const walking = steps.filter(step => step?.travelMode === 'WALK');
  const segments = googleSegments(route.legs);
  return {
    totalTime,
    transferCount: Math.max(
      0,
      steps.filter(step => step?.travelMode === 'TRANSIT').length - 1,
    ),
    walkingTime: walking.reduce(
      (sum, step) => sum + (duration(step.staticDuration) ?? 0),
      0,
    ),
    walkingDistance: walking.reduce(
      (sum, step) =>
        sum + (nonnegative(step.distanceMeters) ? step.distanceMeters : 0),
      0,
    ),
    total_polyline: decodePolyline(route.polyline?.encodedPolyline).flatMap(
      ([lat, lng]) => point(lng, lat),
    ),
    ...(segments ? { segments } : {}),
  };
}

async function kakaoRoute(
  participant: RouteParticipant,
  station: PopularMeetingLocation,
  mode: 'car' | 'walk',
): Promise<RouteItinerary['itinerary'] | null> {
  const headers = { Authorization: `KakaoAK ${getEnv('KAKAO_REST_API_KEY')}` };
  const init = {
    headers,
    signal: AbortSignal.timeout(10000),
    errorMessage: '카카오 경로 조회 실패',
  };
  if (mode === 'car') {
    const params = new URLSearchParams({
      origin: `${participant.start_x},${participant.start_y}`,
      destination: `${station.location_x},${station.location_y}`,
      priority: 'RECOMMEND',
      alternatives: 'false',
      summary: 'false',
    });
    const json = await fetchJson<{ routes?: KakaoCarRoute[] }>(
      `https://apis-navi.kakaomobility.com/v1/directions?${params}`,
      init,
    );
    const route = json.routes?.[0];
    if (route?.result_code !== 0 || !nonnegative(route.summary?.duration))
      return null;
    const total_polyline: PolylinePoint[] = [];
    let completePath = true;
    const sections = Array.isArray(route.sections) ? route.sections : [];
    for (const section of sections) {
      const roads = Array.isArray(section?.roads) ? section.roads : [];
      if (roads.length === 0) completePath = false;
      for (const road of roads) {
        const vertices = Array.isArray(road?.vertexes) ? road.vertexes : [];
        const points: PolylinePoint[] = [];
        for (let i = 0; i + 1 < vertices.length; i += 2)
          points.push(...point(vertices[i], vertices[i + 1]));
        if (vertices.length === 0 || points.length * 2 !== vertices.length)
          completePath = false;
        total_polyline.push(...points);
      }
    }
    return {
      totalTime: route.summary.duration,
      transferCount: 0,
      walkingTime: 0,
      walkingDistance: 0,
      total_polyline,
      ...(completePath && total_polyline.length >= 2
        ? { segments: [{ mode, polyline: total_polyline }] }
        : {}),
    };
  }
  const params = new URLSearchParams({
    start_x: String(participant.start_x),
    start_y: String(participant.start_y),
    end_x: String(station.location_x),
    end_y: String(station.location_y),
    input_coord: 'WGS84',
    output_coord: 'WGS84',
  });
  const json = await fetchJson<{ status?: string; route?: KakaoWalkRoute }>(
    `https://dapi.kakao.com/v2/routing/walk?${params}`,
    init,
  );
  if (
    json.status === 'SAME_POINT' &&
    participant.start_x === Number(station.location_x) &&
    participant.start_y === Number(station.location_y)
  ) {
    return {
      totalTime: 0,
      transferCount: 0,
      walkingTime: 0,
      walkingDistance: 0,
      total_polyline: point(participant.start_x, participant.start_y),
    };
  }
  if (json.status !== 'OK') return null;
  const route = json.route;
  if (
    !nonnegative(route?.properties?.totalTime) ||
    !nonnegative(route?.properties?.totalDistance)
  )
    return null;
  const total_polyline: PolylinePoint[] = [];
  let completePath = true;
  const legs = Array.isArray(route.legs) ? route.legs : [];
  for (const leg of legs) {
    const steps = Array.isArray(leg?.steps) ? leg.steps : [];
    if (steps.length === 0) completePath = false;
    for (const step of steps) {
      const coordinates = Array.isArray(step?.path?.points)
        ? step.path.points
        : [];
      if (coordinates.length === 0) completePath = false;
      for (const coordinate of coordinates) {
        const points = Array.isArray(coordinate)
          ? point(coordinate[0], coordinate[1])
          : [];
        if (coordinate?.length !== 2 || points.length === 0)
          completePath = false;
        total_polyline.push(...points);
      }
    }
  }
  return {
    totalTime: route.properties.totalTime,
    walkingTime: route.properties.totalTime,
    walkingDistance: route.properties.totalDistance,
    transferCount: 0,
    total_polyline,
    ...(completePath && total_polyline.length >= 2
      ? { segments: [{ mode, polyline: total_polyline }] }
      : {}),
  };
}

export async function fetchRouteItinerary(
  participant: RouteParticipant,
  station: PopularMeetingLocation,
  mode: TravelMode,
  departureTime: string,
): Promise<RouteItinerary['itinerary'] | null> {
  try {
    return await (mode === 'transit'
      ? googleTransit(participant, station, departureTime)
      : kakaoRoute(participant, station, mode));
  } catch (error) {
    console.error('route request failed', {
      mode,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return null;
  }
}
