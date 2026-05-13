import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

import { useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';

import { getApiErrorMessage, logApiError } from '@/api/errors';
import useModal from '@/hooks/common/useModal';
import { modalState } from '@/jotai/global/store';
import { mapIdState } from '@/jotai/mapId/store';
import VoteService from '@/services/vote/VoteService';

export default function useHostControlFlow(
  activeMapId?: string | null,
  shareKey?: string | null,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mapIdInfo = useAtomValue(mapIdState);
  const resetModal = useResetAtom(modalState);
  const { setModalContents } = useModal();

  const mapId = mapIdInfo.mapId || activeMapId || '';
  const mapHostId = mapIdInfo.mapHostId;
  const canManage = Boolean(mapId && mapHostId);
  const hostMapIdInfo = { mapId, mapHostId };

  const refreshResult = () => {
    queryClient.invalidateQueries({ queryKey: ['placeSearchMapId', mapId] });

    if (shareKey) {
      queryClient.invalidateQueries({
        queryKey: ['confirmedHotPlace', shareKey],
      });
    }
  };

  const moveToResult = () => {
    router.replace(`/result?mapId=${mapId}`);
  };

  const cancelConfirm = async () => {
    resetModal();

    try {
      await VoteService.cancelConfirm(hostMapIdInfo);
      refreshResult();
      moveToResult();
      toast.success('확정이 취소되었습니다.');
    } catch (error) {
      logApiError('cancelConfirm', error);
      toast.error(getApiErrorMessage(error, '확정 취소에 실패했습니다.'));
    }
  };

  const resetVote = async () => {
    resetModal();

    try {
      await VoteService.resetVote(hostMapIdInfo);
      refreshResult();
      moveToResult();
      toast.success('재투표를 시작했습니다.');
    } catch (error) {
      logApiError('resetVote', error);
      toast.error(getApiErrorMessage(error, '재투표 시작에 실패했습니다.'));
    }
  };

  const requestCancelConfirm = () => {
    if (!canManage) return;

    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '확정 취소',
      contents: '확정된 약속 지역과 최종 핫플을 취소할까요?',
      onConfirm: cancelConfirm,
    });
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
    requestCancelConfirm,
    requestResetVote,
  };
}
