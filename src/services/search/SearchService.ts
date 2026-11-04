import { api, edgeApi } from '@/api/client';

import SearchForm from '@/model/search/SearchForm';

import {
  CreatedResult,
  CreatedRoom,
  DepartureRegistration,
  RoomRecommendationRun,
  RoomStatusResponse,
  SubmitDeparturePointRequestBody,
} from './types';
import { SearchState } from '@/jotai/global/store';
import SearchFormWithTogether from '@/model/search-together/SearchFormWithTogether';
import { MeetingPurpose } from '@/types/meetingPurpose';
import { RecommendationOptions } from '@/types/recommendationOptions';
import { LocationResult, StationInfo } from '@/types/location';
import type {
  MeetingDestination,
  DestinationRequest,
} from '@/types/meetingDestination';

export default class SearchService {
  static async destinationRoutes(
    searchForm: SearchState[],
    request: DestinationRequest,
  ) {
    const body = request.roomContext
      ? { roomContext: request.roomContext }
      : {
          participant: SearchForm.convertToRequestBody(searchForm).participant,
          meetingDestination: request.meetingDestination,
        };
    const { data } = await edgeApi.post<CreatedResult>(
      '/functions/v1/location-destination',
      body,
      { timeout: 180000 },
    );
    return data;
  }

  static async updateMeetingDestination(
    roomId: string,
    hostId: string,
    destination: MeetingDestination,
    expectedMapId?: string,
  ) {
    await api.post('/rest/v1/rpc/location_room_destination_update', {
      p_room_id: roomId,
      p_room_host_id: hostId,
      p_meeting_destination: destination,
      p_expected_map_id: expectedMapId ?? null,
    });
  }

  static async searchPlaces(
    searchForm: SearchState[],
    meetingPurpose?: MeetingPurpose,
    recommendationOptions?: RecommendationOptions,
  ) {
    const requestBody = SearchForm.convertToRequestBody(
      searchForm,
      meetingPurpose,
      recommendationOptions,
    );

    const { data } = await edgeApi.post<CreatedResult>(
      '/functions/v1/location-points',
      {
        ...requestBody,
      },
    );

    return data;
  }

  static async searchPolling(mapId: string) {
    const { data } = await api.post<LocationResult | null>(
      '/rest/v1/rpc/location_result_by_map_id',
      {
        p_map_id: mapId,
      },
    );

    return data ?? null;
  }

  static async searchPlacesWithShareKey(shareKey?: string | null) {
    if (!shareKey) {
      return null;
    }

    const { data } = await api.post<StationInfo | null>(
      '/rest/v1/rpc/location_station_by_share_key',
      {
        p_share_key: shareKey,
      },
    );

    return data ?? null;
  }

  static async makeRoom(
    searchForm: SearchState,
    destination?: MeetingDestination,
  ) {
    const requestBody = SearchFormWithTogether.convertToRequestBody(searchForm);

    const { data } = await api.post<CreatedRoom>(
      destination
        ? '/rest/v1/rpc/location_destination_together'
        : '/rest/v1/rpc/location_together',
      {
        ...requestBody,
        ...(destination ? { meeting_destination: destination } : {}),
      },
    );

    return data;
  }

  static async getInputStatusList(roomId: string) {
    const { data } = await api.post<RoomStatusResponse | null>(
      '/rest/v1/rpc/location_room_status',
      {
        p_room_id: roomId,
      },
    );

    return data ?? null;
  }

  static async submitDeparturePoint(
    requestBody: SubmitDeparturePointRequestBody,
  ) {
    const { data } = await api.post<DepartureRegistration>(
      `/rest/v1/rpc/location_join_room`,
      {
        p_room_id: requestBody.room_id,
        p_name: requestBody.name,
        p_travel_mode: requestBody.travel_mode ?? null,
        p_region_name: requestBody.region_name,
        p_full_address: requestBody.full_address,
        p_start_x: requestBody.start_x,
        p_start_y: requestBody.start_y,
      },
    );

    return data;
  }

  static async updateDeparturePoint(
    roomId: string,
    participantId: number,
    participantToken: string,
    searchForm: SearchState,
  ) {
    const { data } = await api.post<{ participant_id: number }>(
      '/rest/v1/rpc/location_update_participant',
      {
        p_room_id: roomId,
        p_participant_id: participantId,
        p_participant_token: participantToken,
        p_name: searchForm.name,
        p_region_name: searchForm.address.regionName,
        p_full_address: searchForm.address.fullAddress,
        p_start_x: searchForm.address.longitude,
        p_start_y: searchForm.address.latitude,
        p_travel_mode: searchForm.travelMode ?? null,
      },
    );
    return data;
  }

  static async startRoomRecommendation(
    roomId: string,
    roomHostId: string,
    meetingPurpose?: MeetingPurpose,
    recommendationOptions?: RecommendationOptions,
  ) {
    const { data } = await api.post<RoomRecommendationRun>(
      '/rest/v1/rpc/location_room_recommend_start',
      {
        p_room_id: roomId,
        p_room_host_id: roomHostId,
        p_meeting_purpose: meetingPurpose ?? null,
        p_recommendation_options: recommendationOptions ?? null,
      },
    );

    if (!data?.recommendation_run_id || !Array.isArray(data.participant)) {
      throw new Error(
        '추천 준비를 완료하지 못했어요. 잠시 후 화면을 새로고침하고 다시 시도해주세요.',
      );
    }
    return data;
  }

  static async completeRoomRecommendation(
    roomId: string,
    roomHostId: string,
    mapId: string,
    runId: string,
  ) {
    const { data } = await api.post(
      '/rest/v1/rpc/location_room_recommend_complete',
      {
        p_room_id: roomId,
        p_room_host_id: roomHostId,
        p_map_id: mapId,
        p_recommendation_run_id: runId,
      },
    );

    return data;
  }

  static async failRoomRecommendation(
    roomId: string,
    roomHostId: string,
    runId: string,
  ) {
    const { data } = await api.post(
      '/rest/v1/rpc/location_room_recommend_fail',
      {
        p_room_id: roomId,
        p_room_host_id: roomHostId,
        p_recommendation_run_id: runId,
      },
    );

    return data;
  }
}
