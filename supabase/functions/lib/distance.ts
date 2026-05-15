import type {
  PopularMeetingLocation,
  RouteParticipant,
} from './location-types.ts';

export interface ScoredMeetingLocation {
  station: PopularMeetingLocation;
  score: number;
  centerDistanceMeters: number;
  averageParticipantDistanceMeters: number;
  maxParticipantDistanceMeters: number;
  participantDistanceSpreadMeters: number;
}

const EARTH_RADIUS_METERS = 6371000;

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
