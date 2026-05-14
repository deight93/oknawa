import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

import { useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

import { getApiErrorMessage, logApiError } from '@/api/errors';
import useModal from '@/hooks/common/useModal';
import { modalState } from '@/jotai/global/store';
import { mapIdState } from '@/jotai/mapId/store';
import { resultConfirmState } from '@/jotai/result-confirm/store';
import { resultState } from '@/jotai/result/store';
import VoteService from '@/services/vote/VoteService';
import { LocationResult } from '@/types/location';
import { clearVoteStateForMap } from '@/utils/voteStorage';

const resetResultVotes = (
  result: LocationResult | null | undefined,
  mapId: string,
  voteRound?: number,
) => {
  if (!result) {
    return result;
  }

  if (result.map_id && result.map_id !== mapId) {
    return result;
  }

  return {
    ...result,
    confirmed: null,
    vote_round: voteRound ?? result.vote_round,
    station_info: (result.station_info ?? []).map(station => ({
      ...station,
      vote: 0,
      vote_round: voteRound ?? station.vote_round,
    })),
  };
};

export default function useHostControlFlow(activeMapId?: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mapIdInfo = useAtomValue(mapIdState);
  const setResult = useSetAtom(resultState);
  const resetModal = useResetAtom(modalState);
  const resetResultConfirm = useResetAtom(resultConfirmState);
  const { setModalContents } = useModal();

  const mapId = activeMapId || mapIdInfo.mapId || '';
  const mapHostId = mapIdInfo.mapId === mapId ? mapIdInfo.mapHostId : '';
  const canManage = Boolean(mapId && mapHostId);
  const hostMapIdInfo = { mapId, mapHostId };

  const refreshResult = (voteRound?: number) => {
    clearVoteStateForMap(mapId);
    resetResultConfirm();

    queryClient.setQueryData<LocationResult | null>(
      ['placeSearchMapId', mapId],
      previousResult => resetResultVotes(previousResult, mapId, voteRound),
    );
    queryClient.removeQueries({ queryKey: ['placeSearchWithShareKey'] });
    queryClient.invalidateQueries({ queryKey: ['placeSearchMapId', mapId] });
    setResult(previousResult =>
      resetResultVotes(previousResult, mapId, voteRound) ?? previousResult,
    );
  };

  const moveToResult = () => {
    router.replace(`/result?mapId=${mapId}`);
  };

  const resetVote = async () => {
    resetModal();

    try {
      const result = await VoteService.resetVote(hostMapIdInfo);
      refreshResult(result?.vote_round);
      moveToResult();
      toast.success('다시 고를 수 있습니다.');
    } catch (error) {
      logApiError('resetVote', error);
      toast.error(getApiErrorMessage(error, '재투표 시작에 실패했습니다.'));
    }
  };

  const requestResetVote = () => {
    if (!canManage) return;

    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '재투표 시작',
      contents: '현재 투표와 확정 정보를 초기화하고 다시 투표할까요?',
      onConfirm: resetVote,
    });
  };

  return {
    canManage,
    requestResetVote,
  };
}
