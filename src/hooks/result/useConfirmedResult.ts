import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { useAtom } from 'jotai';

import { usePlaceSearchWithShareKeyMutation } from '@/hooks/mutation/search';
import { resultConfirmState } from '@/jotai/result-confirm/store';

export default function useConfirmedResult() {
  const queryShareKey = useSearchParams().get('sharekey');
  const [resultConfirm, setResultConfirm] = useAtom(resultConfirmState);
  const [loadFailed, setLoadFailed] = useState(false);

  const { mutate: placeSearchWithShareKey, isPending } =
    usePlaceSearchWithShareKeyMutation();

  const { station_name, share_key, itinerary, request_info } = resultConfirm;
  const shouldFetchShareResult = Boolean(
    queryShareKey && share_key !== queryShareKey,
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
  const stationName = station_name.split(' ')[0];
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
    hasResult,
    isLoading,
  };
}
