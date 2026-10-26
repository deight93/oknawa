import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAtomValue } from 'jotai';

import {
  usePlaceSearchMapIdQuery,
  usePlaceSearchWithShareKeyQuery,
} from '@/hooks/query/search';
import { resultConfirmState } from '@/jotai/result-confirm/store';
import { getLocationDisplayName } from '@/utils/recommendationDisplay';

export default function useConfirmedResult(queryShareKey: string | null) {
  const router = useRouter();
  const storedResult = useAtomValue(resultConfirmState);
  const activeShareKey = queryShareKey || storedResult.share_key;
  const { data, isLoading: isLoadingStation } =
    usePlaceSearchWithShareKeyQuery(activeShareKey);
  const mapId = data?.map_id ?? '';
  const {
    data: liveResult,
    isLoading: isLoadingMap,
    isFetchedAfterMount,
    isError,
  } = usePlaceSearchMapIdQuery(mapId);
  // Wait for a fresh read: a cached pre-confirmation null must not send us back.
  const hasLiveResult = Boolean(liveResult && isFetchedAfterMount && !isError);

  useEffect(() => {
    if (!hasLiveResult || !liveResult || !mapId) return;
    if (!liveResult.confirmed) {
      router.replace(`/result?mapId=${mapId}`);
    } else if (liveResult.confirmed !== activeShareKey) {
      router.replace(`/result/confirm?sharekey=${liveResult.confirmed}`);
    }
  }, [activeShareKey, hasLiveResult, liveResult, mapId, router]);

  const resultConfirm = data ?? storedResult;
  const { station_name, share_key, itinerary, request_info } = resultConfirm;
  const recommendationOptions = request_info?.recommendationOptions;
  const resultType = request_info?.resultType;
  const totalTravelTime = itinerary.reduce(
    (sum, route) => sum + route.itinerary.totalTime,
    0,
  );
  const averageTravelTime = itinerary.length
    ? totalTravelTime / itinerary.length
    : 0;
  const hasResult = Boolean(
    data &&
      station_name &&
      itinerary.length &&
      request_info?.participant?.length &&
      hasLiveResult &&
      liveResult?.confirmed === activeShareKey,
  );

  return {
    resultConfirm,
    stationName: getLocationDisplayName(station_name, resultType),
    shareKey: share_key,
    averageTravelTime,
    recommendationOptions,
    resultType,
    hasResult,
    isLoading:
      isLoadingStation ||
      isLoadingMap ||
      (Boolean(mapId) && !isFetchedAfterMount && !isError),
  };
}
