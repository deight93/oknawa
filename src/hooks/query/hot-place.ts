import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import HotPlaceService from '@/services/hot-place/HotPlaceService';

import { HotPlaceCategory, HotPlacePoint } from '@/services/hot-place/types';

export const useHotPlaceQuery = (
  category: HotPlaceCategory,
  point: HotPlacePoint,
) => {
  return useInfiniteQuery({
    queryKey: ['hotPlace', category, point],
    queryFn: ({ pageParam }) =>
      HotPlaceService.fetchHotPlace(category, point, pageParam),
    placeholderData: keepPreviousData,
    initialPageParam: 1,
    getNextPageParam: (lastPage, currentPage) => {
      const isLastPage = lastPage.meta.is_end;

      if (isLastPage) {
        return undefined;
      }

      return currentPage.length + 1;
    },
  });
};

export const useConfirmedHotPlaceQuery = (shareKey?: string | null) => {
  return useQuery({
    queryKey: ['confirmedHotPlace', shareKey],
    queryFn: () => HotPlaceService.fetchConfirmedHotPlace(shareKey ?? ''),
    enabled: Boolean(shareKey),
  });
};

export const useHotPlaceVotesQuery = (
  mapId: string | undefined,
  shareKey: string | undefined,
  voteRound: number | undefined,
  category: HotPlaceCategory,
) => {
  return useQuery({
    queryKey: ['hotPlaceVotes', mapId, shareKey, voteRound, category],
    queryFn: () =>
      HotPlaceService.fetchHotPlaceVotes(
        mapId ?? '',
        shareKey ?? '',
        voteRound ?? 1,
        category,
      ),
    enabled: Boolean(mapId && shareKey && voteRound),
  });
};
