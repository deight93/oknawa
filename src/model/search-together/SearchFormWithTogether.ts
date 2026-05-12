import { SearchState } from '@/jotai/global/store';

export default class SearchFormWithTogether {
  static convertToRequestBody(searchForm: SearchState) {
    return {
      name: searchForm.name,
      region_name: searchForm.address.regionName,
      full_address: searchForm.address.fullAddress,
      start_x: searchForm.address.longitude,
      start_y: searchForm.address.latitude,
    };
  }
}
