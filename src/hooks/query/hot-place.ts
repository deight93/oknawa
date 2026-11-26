import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import HotPlaceService from '@/services/hot-place/HotPlaceService';
import type {
  HotPlacePoint,
  PlaceSearchKind,
} from '@/services/hot-place/types';

export const useHotPlaceQuery = (
  kinds: PlaceSearchKind[],
  point: HotPlacePoint,
) => {
  return useInfiniteQuery({
    queryKey: ['hotPlace', kinds, point],
    initialPageParam: { page: 1, kinds },
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam, signal }) => {
      const results = await Promise.all(
        pageParam.kinds.map(async kind => ({
          kind,
          ...(await HotPlaceService.fetchHotPlace(
            kind,
            point,
            pageParam.page,
            5,
            signal,
          )),
        })),
      );
      return {
        documents: results.flatMap(result => result.documents),
        remaining: results
          .filter(result => !result.meta.is_end)
          .map(result => result.kind),
      };
    },
    getNextPageParam: (lastPage, _pages, lastParam) =>
      lastPage.remaining.length
        ? { page: lastParam.page + 1, kinds: lastPage.remaining }
        : undefined,
  });
};
