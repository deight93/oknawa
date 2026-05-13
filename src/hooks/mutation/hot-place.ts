import { useMutation } from '@tanstack/react-query';

import { logApiError } from '@/api/errors';
import HotPlaceService from '@/services/hot-place/HotPlaceService';
import {
  ConfirmHotPlaceRequest,
  VoteHotPlaceRequest,
} from '@/services/hot-place/types';

export const useConfirmHotPlaceMutation = () => {
  return useMutation({
    mutationKey: ['confirmHotPlace'],
    mutationFn: (request: ConfirmHotPlaceRequest) =>
      HotPlaceService.confirmHotPlace(request),
    onError: error => {
      logApiError('confirmHotPlace', error);
    },
  });
};

export const useVoteHotPlaceMutation = () => {
  return useMutation({
    mutationKey: ['voteHotPlace'],
    mutationFn: (request: VoteHotPlaceRequest) =>
      HotPlaceService.voteHotPlace(request),
    onError: error => {
      logApiError('voteHotPlace', error);
    },
  });
};
