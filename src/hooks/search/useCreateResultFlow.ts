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
import { clearLegacyVoteState } from '@/utils/voteStorage';

export type CreateResultLoadingPhase = 'generating' | 'fetching';

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
  ) => {
    createResult(
      { searchForm: searchList, meetingPurpose },
      {
        onSuccess: data => {
          setMapIdInfo({
            mapId: data.map_id,
            mapHostId: data.map_host_id,
          });

          fetchResult(data.map_id, {
            onSuccess: mapData => {
              setSearchState(searchList);
              setResult(mapData);
              router.push('/result');
              clearLegacyVoteState();
            },
            onError: error => {
              logApiError('fetchResult', error);
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
      },
    );
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
