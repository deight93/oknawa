import { useMutation } from '@tanstack/react-query';

import { logApiError } from '@/api/errors';
import { MapIdType } from '@/services/search/types';
import VoteService from '@/services/vote/VoteService';

export const useResetVoteMutation = () => {
  return useMutation({
    mutationKey: ['resetVote'],
    mutationFn: (mapIdInfo: MapIdType) => VoteService.resetVote(mapIdInfo),
    onError: error => {
      logApiError('resetVote', error);
    },
  });
};
