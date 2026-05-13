import polyline from 'https://esm.sh/@mapbox/polyline';
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

export async function callGoogleMapItineraries(
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

  const stationInfoList: StationItineraryResult[] = [];

  for (const station of stations) {
    const itineraryList: RouteItinerary[] = [];

    for (const participant of participants) {
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
        `${GOOGLE_API_URL}/directions/v2:computeRoutes`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          errorMessage: 'Google Routes API 조회 실패',
        },
      );

      const route = json.routes?.[0];
      const polylineEncoded = route?.polyline?.encodedPolyline;
      if (!route?.duration || !polylineEncoded) continue;

      const durationSeconds = parseDuration(route.duration);
      const routeMetrics = summarizeRouteMetrics(route);
      const decodedPolyline = polyline.decode(polylineEncoded);
      const totalPolyline = decodedPolyline.map(([lat, lng]) => ({ lat, lng }));

      itineraryList.push({
        name: participant.name,
        region_name: participant.region_name,
        itinerary: {
          totalTime: durationSeconds,
          transferCount: routeMetrics.transferCount,
          walkingDistance: routeMetrics.walkingDistance,
          walkingTime: routeMetrics.walkingTime,
          total_polyline: totalPolyline,
        },
      });
    }

    stationInfoList.push({
      station_name: station.name,
      address_name: station.address,
      end_x: Number(station.location_x),
      end_y: Number(station.location_y),
      itinerary: itineraryList,
    });
  }

  return stationInfoList;
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
