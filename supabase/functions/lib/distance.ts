import type {
  PopularMeetingLocation,
  RecommendationOptions,
  RouteParticipant,
} from './location-types.ts';
import { getParticipantTravelMode } from './location-types.ts';

export interface ScoredMeetingLocation {
  station: PopularMeetingLocation;
  score: number;
  centerDistanceMeters: number;
  averageParticipantDistanceMeters: number;
  maxParticipantDistanceMeters: number;
  participantDistanceSpreadMeters: number;
}

const EARTH_RADIUS_METERS = 6371000;

export function selectRouteCandidates(
  participants: RouteParticipant[],
  locations: PopularMeetingLocation[],
  limit: number,
  options: RecommendationOptions,
): PopularMeetingLocation[] {
  if (!participants.length || limit < 1) return [];
  const valid = locations
    .filter(
      location =>
        [location.location_x, location.location_y].every(
          value =>
            String(value).trim() !== '' && Number.isFinite(Number(value)),
        ) &&
        Math.abs(Number(location.location_x)) <= 180 &&
        Math.abs(Number(location.location_y)) <= 90,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const unique = Array.from(
    new Map(
      valid.map(location => [
        `${Number(location.location_x).toFixed(5)}:${Number(
          location.location_y,
        ).toFixed(5)}`,
        location,
      ]),
    ).values(),
  );
  const ranked = getScoredMeetingLocationCandidates(
    getCenterCoordinates(participants),
    participants,
    unique,
  )
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.maxParticipantDistanceMeters - b.maxParticipantDistanceMeters ||
        a.station.name.localeCompare(b.station.name),
    )
    .map(item => ({ ...item.station, distance_score: item.score }));
  if (options.midpointBasis === 'distance') return ranked.slice(0, limit);

  const selected: PopularMeetingLocation[] = [];
  const add = (location: PopularMeetingLocation | undefined) => {
    if (location && selected.length < limit && !selected.includes(location)) {
      selected.push(location);
    }
  };
  add(ranked[0]);
  const coordinates = (location: PopularMeetingLocation): [number, number] => [
    Number(location.location_x),
    Number(location.location_y),
  ];
  // A walking participant can shift the useful meeting area far from the centroid.
  const walkers = participants
    .filter(p => getParticipantTravelMode(p, options.travelMode) === 'walk')
    .sort((a, b) => a.start_x - b.start_x || a.start_y - b.start_y);
  for (const walker of walkers) {
    add(
      [...ranked].sort(
        (a, b) =>
          getDistanceMeters([walker.start_x, walker.start_y], coordinates(a)) -
            getDistanceMeters(
              [walker.start_x, walker.start_y],
              coordinates(b),
            ) || a.name.localeCompare(b.name),
      )[0],
    );
  }
  // Spread the same bounded call budget across neighborhoods before filling gaps.
  for (const candidate of ranked) {
    if (
      selected.every(
        other =>
          getDistanceMeters(coordinates(candidate), coordinates(other)) >= 1500,
      )
    )
      add(candidate);
  }
  for (const candidate of ranked) add(candidate);
  return selected;
}

export function getCenterCoordinates(
  participants: RouteParticipant[],
): [number, number] {
  const total = participants.reduce(
    (acc, p) => {
      acc.x += p.start_x;
      acc.y += p.start_y;
      return acc;
    },
    { x: 0, y: 0 },
  );

  const count = participants.length;
  return [total.x / count, total.y / count];
}

export function getBalancedMeetingLocations(
  centerCoordinates: [number, number],
  participants: RouteParticipant[],
  stations: PopularMeetingLocation[],
  priority: number,
): PopularMeetingLocation[] {
  return getScoredMeetingLocationCandidates(
    centerCoordinates,
    participants,
    stations,
  )
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.maxParticipantDistanceMeters - b.maxParticipantDistanceMeters ||
        a.centerDistanceMeters - b.centerDistanceMeters ||
        a.station.name.localeCompare(b.station.name),
    )
    .slice(0, priority)
    .map(item => item.station);
}

export function getScoredMeetingLocationCandidates(
  centerCoordinates: [number, number],
  participants: RouteParticipant[],
  stations: PopularMeetingLocation[],
): ScoredMeetingLocation[] {
  return stations.map(station => {
    const stationCoordinates: [number, number] = [
      Number(station.location_x),
      Number(station.location_y),
    ];
    const participantDistances = participants.map(participant =>
      getDistanceMeters(
        [participant.start_x, participant.start_y],
        stationCoordinates,
      ),
    );
    const averageParticipantDistanceMeters =
      participantDistances.reduce((sum, distance) => sum + distance, 0) /
      participantDistances.length;
    const maxParticipantDistanceMeters = Math.max(...participantDistances);
    const minParticipantDistanceMeters = Math.min(...participantDistances);
    const participantDistanceSpreadMeters =
      maxParticipantDistanceMeters - minParticipantDistanceMeters;
    const centerDistanceMeters = getDistanceMeters(
      centerCoordinates,
      stationCoordinates,
    );

    return {
      station,
      score:
        centerDistanceMeters * 0.4 +
        averageParticipantDistanceMeters * 0.35 +
        maxParticipantDistanceMeters * 0.2 +
        participantDistanceSpreadMeters * 0.05,
      centerDistanceMeters,
      averageParticipantDistanceMeters,
      maxParticipantDistanceMeters,
      participantDistanceSpreadMeters,
    };
  });
}

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
