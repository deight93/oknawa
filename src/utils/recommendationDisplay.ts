import { ResultLocationType, ResultSortOption } from '@/types/location';
import {
  RecommendationOptions,
  TravelMode,
} from '@/types/recommendationOptions';

export const isCarRecommendation = (
  recommendationOptions?: RecommendationOptions,
) => recommendationOptions?.travelMode === 'car';

export const getResultTitleLabel = (
  recommendationOptions?: RecommendationOptions,
  resultType?: ResultLocationType,
) => {
  switch (resultType) {
    case 'local_area':
      return '만나기 좋은 지역';
    case 'city':
      return '중간 도시';
    case 'terminal':
      return '만나기 좋은 터미널';
    case 'station':
      return '만나기 좋은 역';
  }

  if (isCarRecommendation(recommendationOptions)) {
    return recommendationOptions?.midpointBasis === 'distance'
      ? '위치가 좋은 지역'
      : '만나기 좋은 지역';
  }

  return '만나기 좋은 역';
};

export const getConfirmTitle = (
  name: string,
  _recommendationOptions?: RecommendationOptions,
  _resultType?: ResultLocationType,
) => {
  return `${name}에서 만나요`;
};

export const getLocationDisplayName = (
  name: string,
  resultType?: ResultLocationType,
) => {
  if (resultType === 'local_area' || resultType === 'city') {
    return name;
  }

  return name.split(' ')[0] ?? '';
};

export const getRouteStatText = (
  totalTimeLabel: string,
  transferLabel: string,
  walkingTimeLabel: string,
  recommendationOptions?: RecommendationOptions,
  travelMode?: TravelMode,
) => {
  const mode = travelMode ?? recommendationOptions?.travelMode;
  if (mode === 'car') {
    return travelMode ? `자동차 ${totalTimeLabel}` : totalTimeLabel;
  }
  if (mode === 'walk') return `도보 ${totalTimeLabel}`;

  return `${travelMode ? '대중교통 ' : ''}${totalTimeLabel} · 환승 ${transferLabel} · 도보 ${walkingTimeLabel}`;
};

export const getVisibleSortOptions = (
  options: Array<{ label: string; value: ResultSortOption }>,
  recommendationOptions?: RecommendationOptions,
) => {
  if (!isCarRecommendation(recommendationOptions)) {
    return options;
  }

  return options.filter(
    option => option.value !== 'transfer' && option.value !== 'walking',
  );
};
