import { useEffect, useRef, useState } from 'react';
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
import { assertBrowserStorageWritable } from '@/utils/browserStorage';

export type CreateResultLoadingPhase = 'generating' | 'fetching';

interface RequestResultOptions {
  beforeCreate?: () => Promise<SearchState[] | void> | SearchState[] | void;
  onCreated?: (data: CreatedResult) => void;
  onReady?: (data: CreatedResult) => Promise<void> | void;
  onError?: (error: unknown) => Promise<void> | void;
}

export default function useCreateResultFlow(roomId?: string) {
  const router = useRouter();
  const setResult = useSetAtom(resultState);
  const setSearchState = useSetAtom(searchState);
  const setMapIdInfo = useSetAtom(mapIdState);
  const { setModalContents } = useModal();
  const { mutateAsync: createResult } = usePlaceSearchMutation();
  const { mutateAsync: fetchResult } = usePlaceSearchMapIdMutation();
  const inFlight = useRef(false);
  const pageVersion = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] =
    useState<CreateResultLoadingPhase>('generating');

  useEffect(() => {
    const version = pageVersion.current;
    inFlight.current = false;
    setIsLoading(false);
    setLoadingPhase('generating');
    return () => {
      pageVersion.current = version + 1;
    };
  }, [roomId]);

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
    const version = pageVersion.current;
    const isCurrentPage = () => pageVersion.current === version;
    const requireCurrentPage = () => {
      if (!isCurrentPage()) throw new Error('추천 화면을 벗어났습니다.');
    };

    try {
      assertBrowserStorageWritable('session');
      const preparedSearchList = await options?.beforeCreate?.();
      const participants = preparedSearchList ?? searchList;
      prepared = true;
      requireCurrentPage();
      const created = await createResult({
        searchForm: participants,
        meetingPurpose,
        recommendationOptions,
      });
      requireCurrentPage();
      setMapIdInfo({ mapId: created.map_id, mapHostId: created.map_host_id });
      options?.onCreated?.(created);

      setLoadingPhase('fetching');
      const mapData = await fetchResult(created.map_id);
      requireCurrentPage();
      if (!mapData)
        throw new Error('추천 결과를 불러오지 못했습니다. 다시 시도해주세요.');
      await options?.onReady?.(created);
      // Publication may already have completed remotely when this page leaves.
      if (!isCurrentPage()) return;

      setSearchState(participants);
      setResult(mapData);
      clearLegacyVoteState();
      // The current page can stay interactive while App Router loads the result.
      // Keep success locked until unmount; only failures may retry on this page.
      router.push(`/result?mapId=${created.map_id}`);
    } catch (error) {
      if (isCurrentPage()) logApiError('createResult', error);
      // A failed preparation must not mark someone else's active run as failed.
      if (prepared) {
        try {
          await options?.onError?.(error);
        } catch (handlerError) {
          logApiError('createResult:onError', handlerError);
        }
      }
      // Release an abandoned room run above, but leave the new page untouched.
      if (!isCurrentPage()) return;
      setModalContents({
        buttonLabel: '확인',
        contents: getApiErrorMessage(
          error,
          '추천을 완료하지 못했습니다. 다시 시도해주세요.',
        ),
      });
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  return { requestResult, isLoading, loadingPhase };
}
