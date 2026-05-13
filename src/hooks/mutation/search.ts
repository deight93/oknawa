import { useMutation } from '@tanstack/react-query';

import { getApiErrorMessage, logApiError } from '@/api/errors';
import SearchService from '@/services/search/SearchService';
import { SubmitDeparturePointRequestBody } from '@/services/search/types';

import { SearchState } from '@/jotai/global/store';

import useModal from '@/hooks/common/useModal';
import { MeetingPurpose } from '@/types/meetingPurpose';

interface PlaceSearchVariables {
  searchForm: SearchState[];
  meetingPurpose?: MeetingPurpose;
}

export const usePlaceSearchMutation = () => {
  const { setModalContents } = useModal();

  return useMutation({
    mutationKey: ['placeSearch'],
    mutationFn: ({ searchForm, meetingPurpose }: PlaceSearchVariables) =>
      SearchService.searchPlaces(searchForm, meetingPurpose),
    onError: error => {
      logApiError('placeSearch', error);
      setModalContents({
        buttonLabel: '확인',
        contents: getApiErrorMessage(
          error,
          '지점을 찾을 수 없습니다.\n다시 검색해주세요.',
        ),
      });
    },
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
