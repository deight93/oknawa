import { api, edgeApi } from '@/api/client';

import SearchForm from '@/model/search/SearchForm';

import { SubmitDeparturePointRequestBody } from './types';
import { SearchState } from '@/jotai/global/store';
import SearchFormWithTogether from '@/model/search-together/SearchFormWithTogether';
import { MeetingPurpose } from '@/types/meetingPurpose';

export default class SearchService {
  static async searchPlaces(
    searchForm: SearchState[],
    meetingPurpose?: MeetingPurpose,
  ) {
    const requestBody = SearchForm.convertToRequestBody(
      searchForm,
      meetingPurpose,
    );

    const { data } = await edgeApi.post('/functions/v1/location-points', {
      ...requestBody,
    });

    return data;
  }

  static async searchPolling(mapId: string) {
    const { data } = await api.get(
      `/rest/v1/location_result?map_id=eq.${mapId}&select=*,station_info!station_info_map_id_fkey(*)&limit=1`,
    );

    return data?.[0] ?? null;
  }

  static async searchPlacesWithShareKey(shareKey?: string | null) {
    if (!shareKey) {
      return null;
    }

    const { data: stationData } = await api.get(
      `/rest/v1/station_info?share_key=eq.${shareKey}&select=*&limit=1`,
    );
    const station = stationData?.[0] ?? null;

    if (!station?.map_id) {
      return station;
    }

    const { data: resultData } = await api.get(
      `/rest/v1/location_result?map_id=eq.${station.map_id}&select=vote_round&limit=1`,
    );

    return {
      ...station,
      vote_round: resultData?.[0]?.vote_round ?? 1,
    };
  }

  static async makeRoom(searchForm: SearchState) {
    const requestBody = SearchFormWithTogether.convertToRequestBody(searchForm);

    const { data } = await api.post('/rest/v1/rpc/location_together', {
      ...requestBody,
    });

    return data;
  }

  static async getInputStatusList(roomId: string) {
    const { data } = await api.get(
      `/rest/v1/location_room?room_id=eq.${roomId}&select=*,participant!participant_room_id_fkey(*)&limit=1`,
    );
    return data?.[0] ?? null;
  }

  static async submitDeparturePoint(
    requestBody: SubmitDeparturePointRequestBody,
  ) {
    const { data } = await api.post(`/rest/v1/participant`, {
      ...requestBody,
    });

    return data;
  }
}
