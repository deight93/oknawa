import { SearchState } from '@/jotai/global/store';
import { MeetingPurpose } from '@/types/meetingPurpose';

export default class SearchForm {
  static convertToRequestBody(
    searchForm: SearchState[],
    meetingPurpose?: MeetingPurpose,
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
    };
  }
}
