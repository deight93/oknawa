import { ResultSortOption } from '@/types/location';
import { RecommendationOptions } from '@/types/recommendationOptions';

export const isCarRecommendation = (
  recommendationOptions?: RecommendationOptions,
) => recommendationOptions?.travelMode === 'car';

export const getResultTitleLabel = (
  recommendationOptions?: RecommendationOptions,
) => {
  if (!isCarRecommendation(recommendationOptions)) {
    return '만나기 좋은 역';
  }

  return recommendationOptions?.midpointBasis === 'distance'
    ? '위치가 좋은 지역'
    : '만나기 좋은 지역';
};

export const getConfirmTitle = (
  name: string,
  recommendationOptions?: RecommendationOptions,
) => {
  if (!isCarRecommendation(recommendationOptions)) {
    return `${name}을 추천해요`;
  }

  return `${name}에서 만나요`;
};

export const getRouteStatText = (
  totalTimeLabel: string,
  transferLabel: string,
  walkingTimeLabel: string,
  recommendationOptions?: RecommendationOptions,
) => {
  if (isCarRecommendation(recommendationOptions)) {
    return totalTimeLabel;
  }

  return `${totalTimeLabel} · 환승 ${transferLabel} · 도보 ${walkingTimeLabel}`;
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
