export type TravelMode = 'transit' | 'car';
export type MidpointBasis = 'time' | 'distance';

export interface RecommendationOptions {
  travelMode: TravelMode;
  midpointBasis: MidpointBasis;
}

export const DEFAULT_RECOMMENDATION_OPTIONS: RecommendationOptions = {
  travelMode: 'transit',
  midpointBasis: 'time',
};

export const TRAVEL_MODE_OPTIONS: Array<{
  value: TravelMode;
  label: string;
}> = [
  { value: 'transit', label: '대중교통' },
  { value: 'car', label: '자동차' },
];

export const MIDPOINT_BASIS_OPTIONS: Array<{
  value: MidpointBasis;
  label: string;
}> = [
  { value: 'time', label: '시간 기준' },
  { value: 'distance', label: '위치 기준' },
];
