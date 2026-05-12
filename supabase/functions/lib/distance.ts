import type {
  PopularMeetingLocation,
  RouteParticipant,
} from './location-types.ts';

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

export function getCenterLocations(
  centerCoordinates: [number, number],
  stations: PopularMeetingLocation[],
  priority: number,
): PopularMeetingLocation[] {
  const [centerX, centerY] = centerCoordinates;

  const withDistance = stations.map(station => {
    const distance = Math.sqrt(
      Math.pow(centerX - Number(station.location_x), 2) +
        Math.pow(centerY - Number(station.location_y), 2),
    );
    return { station, distance };
  });

  return withDistance
    .sort((a, b) => a.distance - b.distance)
    .slice(0, priority)
    .map(item => item.station);
}
