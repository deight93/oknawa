import { api, edgeApi } from '@/api/client';

import SearchForm from '@/model/search/SearchForm';

import {
  RoomStatusResponse,
  SubmitDeparturePointRequestBody,
} from './types';
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
    const { data } = await api.post('/rest/v1/rpc/location_result_by_map_id', {
      p_map_id: mapId,
    });

    return data ?? null;
  }

  static async searchPlacesWithShareKey(shareKey?: string | null) {
    if (!shareKey) {
      return null;
    }

    const { data } = await api.post(
      '/rest/v1/rpc/location_station_by_share_key',
      {
        p_share_key: shareKey,
      },
    );

    return data ?? null;
  }

  static async makeRoom(searchForm: SearchState) {
    const requestBody = SearchFormWithTogether.convertToRequestBody(searchForm);

    const { data } = await api.post('/rest/v1/rpc/location_together', {
      ...requestBody,
    });

    return data;
  }

  static async getInputStatusList(roomId: string) {
    const { data } = await api.post('/rest/v1/rpc/location_room_status', {
      p_room_id: roomId,
    });

    return (data ?? null) as RoomStatusResponse | null;
  }

  static async submitDeparturePoint(
    requestBody: SubmitDeparturePointRequestBody,
  ) {
    const { data } = await api.post(`/rest/v1/rpc/location_join_room`, {
      p_room_id: requestBody.room_id,
      p_name: requestBody.name,
      p_region_name: requestBody.region_name,
      p_full_address: requestBody.full_address,
      p_start_x: requestBody.start_x,
      p_start_y: requestBody.start_y,
    });

    return data;
  }

  static async startRoomRecommendation(
    roomId: string,
    roomHostId: string,
    meetingPurpose?: MeetingPurpose,
  ) {
    const { data } = await api.post(
      '/rest/v1/rpc/location_room_recommend_start',
      {
        p_room_id: roomId,
        p_room_host_id: roomHostId,
        p_meeting_purpose: meetingPurpose ?? null,
      },
    );

    return data;
  }

  static async completeRoomRecommendation(
    roomId: string,
    roomHostId: string,
    mapId: string,
  ) {
    const { data } = await api.post(
      '/rest/v1/rpc/location_room_recommend_complete',
      {
        p_room_id: roomId,
        p_room_host_id: roomHostId,
        p_map_id: mapId,
      },
    );

    return data;
  }

  static async failRoomRecommendation(roomId: string, roomHostId: string) {
    const { data } = await api.post(
      '/rest/v1/rpc/location_room_recommend_fail',
      {
        p_room_id: roomId,
        p_room_host_id: roomHostId,
      },
    );

    return data;
  }
}
