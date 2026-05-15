import { SearchState } from '@/jotai/global/store';
import { MeetingPurpose } from '@/types/meetingPurpose';
import {
  DEFAULT_RECOMMENDATION_OPTIONS,
  RecommendationOptions,
} from '@/types/recommendationOptions';

export default class SearchForm {
  static convertToRequestBody(
    searchForm: SearchState[],
    meetingPurpose?: MeetingPurpose,
    recommendationOptions: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
  ) {
    return {
      participant: searchForm?.map(
        ({
          name,
          address: { latitude, longitude, regionName, fullAddress },
        }) => ({
          name,
          start_x: longitude,
          start_y: latitude,
          full_address: fullAddress,
          region_name: regionName,
        }),
      ),
      meetingPurpose,
      travelMode: recommendationOptions.travelMode,
      midpointBasis: recommendationOptions.midpointBasis,
    };
  }
}
