import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSetAtom } from 'jotai';

import { getApiErrorMessage, logApiError } from '@/api/errors';
import useModal from '@/hooks/common/useModal';
import {
  usePlaceSearchMapIdMutation,
  usePlaceSearchMutation,
} from '@/hooks/mutation/search';
import { searchState, SearchState } from '@/jotai/global/store';
import { mapIdState } from '@/jotai/mapId/store';
import { resultState } from '@/jotai/result/store';
import { CreatedResult } from '@/services/search/types';
import { MeetingPurpose } from '@/types/meetingPurpose';
import { RecommendationOptions } from '@/types/recommendationOptions';
import { clearLegacyVoteState } from '@/utils/voteStorage';

export type CreateResultLoadingPhase = 'generating' | 'fetching';

interface RequestResultOptions {
  beforeCreate?: () => Promise<void> | void;
  onCreated?: (data: CreatedResult) => void;
  onReady?: (data: CreatedResult) => Promise<void> | void;
  onError?: (error: unknown) => Promise<void> | void;
}

export default function useCreateResultFlow() {
  const router = useRouter();
  const setResult = useSetAtom(resultState);
  const setSearchState = useSetAtom(searchState);
  const setMapIdInfo = useSetAtom(mapIdState);
  const { setModalContents } = useModal();
  const { mutateAsync: createResult } = usePlaceSearchMutation();
  const { mutateAsync: fetchResult } = usePlaceSearchMapIdMutation();
  const inFlight = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] =
    useState<CreateResultLoadingPhase>('generating');

  const requestResult = async (
    searchList: SearchState[],
    meetingPurpose?: MeetingPurpose,
    options?: RequestResultOptions,
    recommendationOptions?: RecommendationOptions,
  ) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setLoadingPhase('generating');
    let prepared = false;

    try {
      await options?.beforeCreate?.();
      prepared = true;
      const created = await createResult({
        searchForm: searchList,
        meetingPurpose,
        recommendationOptions,
      });
      setMapIdInfo({ mapId: created.map_id, mapHostId: created.map_host_id });
      options?.onCreated?.(created);

      setLoadingPhase('fetching');
      const mapData = await fetchResult(created.map_id);
      if (!mapData)
        throw new Error('추천 결과를 불러오지 못했습니다. 다시 시도해주세요.');
      await options?.onReady?.(created);

      setSearchState(searchList);
      setResult(mapData);
      clearLegacyVoteState();
      router.push(`/result?mapId=${created.map_id}`);
    } catch (error) {
      logApiError('createResult', error);
      // A failed preparation must not mark someone else's active run as failed.
      if (prepared) {
        try {
          await options?.onError?.(error);
        } catch (handlerError) {
          logApiError('createResult:onError', handlerError);
        }
      }
      setModalContents({
        buttonLabel: '확인',
        contents: getApiErrorMessage(
          error,
          '추천을 완료하지 못했습니다. 다시 시도해주세요.',
        ),
      });
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  return { requestResult, isLoading, loadingPhase };
}
