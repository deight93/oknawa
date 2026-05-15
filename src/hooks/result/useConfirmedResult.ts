import { useEffect, useState } from 'react';

import { useAtom } from 'jotai';

import { usePlaceSearchWithShareKeyMutation } from '@/hooks/mutation/search';
import { resultConfirmState } from '@/jotai/result-confirm/store';
import { getLocationDisplayName } from '@/utils/recommendationDisplay';

export default function useConfirmedResult(queryShareKey: string | null) {
  const [resultConfirm, setResultConfirm] = useAtom(resultConfirmState);
  const [loadFailed, setLoadFailed] = useState(false);

  const { mutate: placeSearchWithShareKey, isPending } =
    usePlaceSearchWithShareKeyMutation();

  const { station_name, share_key, itinerary, request_info } = resultConfirm;
  const recommendationOptions = request_info?.recommendationOptions;
  const resultType = request_info?.resultType;
  const shouldFetchShareResult = Boolean(
    queryShareKey && (share_key !== queryShareKey || !resultConfirm.map_id),
  );

  useEffect(() => {
    if (!shouldFetchShareResult || !queryShareKey) {
      return;
    }

    setLoadFailed(false);
    placeSearchWithShareKey(queryShareKey, {
      onSuccess: data => {
        if (data) {
          setResultConfirm(data);
          return;
        }

        setLoadFailed(true);
      },
      onError: () => {
        setLoadFailed(true);
      },
    });
  }, [
    queryShareKey,
    shouldFetchShareResult,
    placeSearchWithShareKey,
    setResultConfirm,
  ]);

  const totalTravelTime = itinerary.reduce(
    (sum, itinerary) => sum + itinerary.itinerary.totalTime,
    0,
  );
  const averageTravelTime = itinerary.length
    ? totalTravelTime / itinerary.length
    : 0;
  const stationName = getLocationDisplayName(station_name, resultType);
  const hasResult =
    Boolean(station_name) &&
    itinerary.length > 0 &&
    Boolean(request_info?.participant?.length) &&
    !shouldFetchShareResult;
  const isLoading = Boolean(
    queryShareKey && !loadFailed && (isPending || shouldFetchShareResult),
  );

  return {
    resultConfirm,
    stationName,
    shareKey: share_key,
    averageTravelTime,
    recommendationOptions,
    resultType,
    hasResult,
    isLoading,
  };
}
