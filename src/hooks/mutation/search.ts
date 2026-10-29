import { useMutation } from '@tanstack/react-query';

import { logApiError } from '@/api/errors';
import SearchService from '@/services/search/SearchService';
import { SubmitDeparturePointRequestBody } from '@/services/search/types';

import { SearchState } from '@/jotai/global/store';

import { MeetingPurpose } from '@/types/meetingPurpose';
import { RecommendationOptions } from '@/types/recommendationOptions';

interface PlaceSearchVariables {
  searchForm: SearchState[];
  meetingPurpose?: MeetingPurpose;
  recommendationOptions?: RecommendationOptions;
}

export const usePlaceSearchMutation = () => {
  return useMutation({
    mutationKey: ['placeSearch'],
    mutationFn: ({
      searchForm,
      meetingPurpose,
      recommendationOptions,
    }: PlaceSearchVariables) =>
      SearchService.searchPlaces(
        searchForm,
        meetingPurpose,
        recommendationOptions,
      ),
  });
};

export const usePlaceSearchMapIdMutation = () => {
  return useMutation({
    mutationKey: ['placeSearchMapId'],
    mutationFn: (mapId: string) => SearchService.searchPolling(mapId),
    onError: error => {
      logApiError('placeSearchMapId', error);
    },
  });
};

export const usePlaceSearchWithShareKeyMutation = () => {
  return useMutation({
    mutationKey: ['placeSearchWithShareKey'],
    mutationFn: (shareKey?: string | null) =>
      SearchService.searchPlacesWithShareKey(shareKey),
    onError: error => {
      logApiError('placeSearchWithShareKey', error);
    },
  });
};

export const useMakeRoomMutation = () => {
  return useMutation({
    mutationKey: ['roomMake'],
    mutationFn: (searchForm: SearchState) => SearchService.makeRoom(searchForm),
    onError: error => {
      logApiError('roomMake', error);
    },
  });
};

export const useSubmitDeparturePointMutation = () => {
  return useMutation({
    mutationKey: ['submitDeparturePoint'],
    mutationFn: ({
      requestBody,
    }: {
      requestBody: SubmitDeparturePointRequestBody;
    }) => SearchService.submitDeparturePoint(requestBody),
    onError: error => {
      logApiError('submitDeparturePoint', error);
    },
  });
};
