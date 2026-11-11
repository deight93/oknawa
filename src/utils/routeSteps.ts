import type { PolylinePoint, RouteStep } from '@/types/location';

export function getRouteTransfers(steps: RouteStep[] = []) {
  let boardings = 0;
  return steps.flatMap((step, stepIndex) => {
    if (step.mode !== 'transit') return [];
    boardings += 1;
    return boardings > 1
      ? [{ number: boardings - 1, stepIndex, transit: step.transit }]
      : [];
  });
}

export function isRoutePoint(
  point: PolylinePoint | undefined,
): point is PolylinePoint {
  return Boolean(
    point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      Math.abs(point.lat) <= 90 &&
      Math.abs(point.lng) <= 180,
  );
}

export function getTransitLabel(vehicleType: string | undefined) {
  switch (vehicleType) {
    case 'BUS':
    case 'INTERCITY_BUS':
    case 'TROLLEYBUS':
      return '버스';
    case 'SUBWAY':
    case 'METRO_RAIL':
      return '지하철';
    case 'RAIL':
    case 'HEAVY_RAIL':
    case 'COMMUTER_TRAIN':
    case 'HIGH_SPEED_TRAIN':
    case 'LONG_DISTANCE_TRAIN':
      return '기차';
    case 'TRAM':
      return '트램';
    case 'MONORAIL':
      return '모노레일';
    case 'FERRY':
      return '선박';
    default:
      return '대중교통';
  }
}
