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
import { MeetingPurpose } from '@/types/meetingPurpose';
import { RecommendationOptions } from '@/types/recommendationOptions';
import { clearLegacyVoteState } from '@/utils/voteStorage';

export type CreateResultLoadingPhase = 'generating' | 'fetching';

interface CreatedResult {
  map_id: string;
  map_host_id: string;
}

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

  const { mutate: createResult, isPending: isCreatingResult } =
    usePlaceSearchMutation();
  const { mutate: fetchResult, isPending: isFetchingResult } =
    usePlaceSearchMapIdMutation();

  const requestResult = (
    searchList: SearchState[],
    meetingPurpose?: MeetingPurpose,
    options?: RequestResultOptions,
    recommendationOptions?: RecommendationOptions,
  ) => {
    const callErrorHandler = (error: unknown) => {
      void Promise.resolve(options?.onError?.(error)).catch(handlerError => {
        logApiError('createResult:onError', handlerError);
      });
    };

    const create = () => {
      createResult(
        { searchForm: searchList, meetingPurpose, recommendationOptions },
        {
          onSuccess: data => {
            const createdResult = data as CreatedResult;
            setMapIdInfo({
              mapId: createdResult.map_id,
              mapHostId: createdResult.map_host_id,
            });
            options?.onCreated?.(createdResult);

            fetchResult(createdResult.map_id, {
              onSuccess: mapData => {
                const moveToResult = () => {
                  setSearchState(searchList);
                  setResult(mapData);
                  router.push(`/result?mapId=${createdResult.map_id}`);
                  clearLegacyVoteState();
                };

                void Promise.resolve(options?.onReady?.(createdResult))
                  .catch(error => {
                    logApiError('createResult:onReady', error);
                    callErrorHandler(error);
                  })
                  .finally(moveToResult);
              },
              onError: error => {
                logApiError('fetchResult', error);
                callErrorHandler(error);
                setModalContents({
                  buttonLabel: '확인',
                  contents: getApiErrorMessage(
                    error,
                    '추천 결과를 불러오지 못했습니다. 다시 시도해주세요.',
                  ),
                });
              },
            });
          },
          onError: error => {
            callErrorHandler(error);
          },
        },
      );
    };

    void Promise.resolve(options?.beforeCreate?.())
      .then(create)
      .catch(error => {
        logApiError('createResult:beforeCreate', error);
        callErrorHandler(error);
        setModalContents({
          buttonLabel: '확인',
          contents: getApiErrorMessage(
            error,
            '추천 준비에 실패했습니다. 다시 시도해주세요.',
          ),
        });
      });
  };

  const loadingPhase: CreateResultLoadingPhase = isFetchingResult
    ? 'fetching'
    : 'generating';

  return {
    requestResult,
    isLoading: isCreatingResult || isFetchingResult,
    loadingPhase,
  };
}
