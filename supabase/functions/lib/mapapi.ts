import type {
  GroupTravelMode,
  PopularMeetingLocation,
  RouteItinerary,
  RouteParticipant,
  StationItineraryResult,
} from './location-types.ts';
import { getParticipantTravelMode } from './location-types.ts';
import { fetchRouteItinerary } from './route-providers.ts';

const ROUTE_CONCURRENCY_LIMIT = 4;

export async function callRouteItineraries(
  participants: RouteParticipant[],
  stations: PopularMeetingLocation[],
  fallbackMode: GroupTravelMode = 'transit',
): Promise<StationItineraryResult[]> {
  const departureTime = new Date().toISOString();
  // Compare fresh estimates. Reuse only identical requests within this search,
  // never a transit timetable or drive time from the legacy 30-day cache.
  const pending = new Map<
    string,
    Promise<RouteItinerary['itinerary'] | null>
  >();
  const requests = stations.flatMap(station =>
    participants.map(participant => ({
      station,
      participant,
      mode: getParticipantTravelMode(participant, fallbackMode),
    })),
  );
  const results: Array<RouteItinerary | null> = new Array(requests.length).fill(
    null,
  );
  let next = 0;
  async function worker() {
    while (next < requests.length) {
      const index = next++;
      const { participant, station, mode } = requests[index];
      const key = JSON.stringify([
        mode,
        participant.start_x,
        participant.start_y,
        Number(station.location_x),
        Number(station.location_y),
      ]);
      let route = pending.get(key);
      if (!route) {
        route = fetchRouteItinerary(participant, station, mode, departureTime);
        pending.set(key, route);
      }
      const itinerary = await route;
      if (itinerary)
        results[index] = {
          name: participant.name,
          region_name: participant.region_name,
          travel_mode: mode,
          itinerary,
        };
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(ROUTE_CONCURRENCY_LIMIT, requests.length) },
      () => worker(),
    ),
  );
  return stations.map((station, stationIndex) => ({
    station_name: station.name,
    result_type: station.type,
    address_name: station.address,
    end_x: Number(station.location_x),
    end_y: Number(station.location_y),
    itinerary: results
      .slice(
        stationIndex * participants.length,
        (stationIndex + 1) * participants.length,
      )
      .filter((route): route is RouteItinerary => route !== null),
    place_quality: station.place_quality,
    distance_score: station.distance_score,
  }));
}
