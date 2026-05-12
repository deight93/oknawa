import { useEffect, useState } from 'react';

import { useAtomValue, useSetAtom } from 'jotai';

import { usePlaceSearchMapIdQuery } from '@/hooks/query/search';
import useResultSummary from '@/hooks/result/useResultSummary';
import { mapIdState } from '@/jotai/mapId/store';
import { resultState } from '@/jotai/result/store';
import { clearLegacyVoteState } from '@/utils/voteStorage';

export default function useResultPageState(queryMapId: string | null) {
  const mapIdInfo = useAtomValue(mapIdState);
  const setResult = useSetAtom(resultState);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { distanceSummaries, participants } = useResultSummary();
  const activeMapId = (mapIdInfo.mapId || queryMapId) ?? '';
  const currentStation = distanceSummaries[currentIndex];
  const stationCount = distanceSummaries.length;

  const { data, isLoading, clearRefetchInterval } =
    usePlaceSearchMapIdQuery(activeMapId);

  useEffect(() => {
    if (data) {
      setResult(data);
    }
  }, [data, setResult]);

  useEffect(() => {
    if (queryMapId) {
      clearLegacyVoteState();
    }
  }, [queryMapId]);

  useEffect(() => {
    if (data?.confirmed) {
      clearRefetchInterval();
    }
  }, [data, clearRefetchInterval]);

  useEffect(() => {
    if (currentIndex >= stationCount) {
      setCurrentIndex(0);
    }
  }, [currentIndex, stationCount]);

  const handleNext = () => {
    if (!stationCount) {
      return;
    }

    setCurrentIndex(prevIndex => (prevIndex + 1) % stationCount);
  };

  const handlePrev = () => {
    if (!stationCount) {
      return;
    }

    setCurrentIndex(prevIndex => (prevIndex - 1 + stationCount) % stationCount);
  };

  return {
    activeMapId,
    currentIndex,
    currentStation,
    distanceSummaries,
    participants,
    isLoading,
    handleNext,
    handlePrev,
  };
}
