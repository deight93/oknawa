import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

import { getApiErrorMessage, logApiError } from '@/api/errors';
import useModal from '@/hooks/common/useModal';
import { usePlaceSearchWithShareKeyMutation } from '@/hooks/mutation/search';
import { modalState } from '@/jotai/global/store';
import { mapIdState } from '@/jotai/mapId/store';
import { resultConfirmState } from '@/jotai/result-confirm/store';
import VoteService from '@/services/vote/VoteService';
import {
  clearVotedForMap,
  hasVotedForMap,
  setVotedForMap,
} from '@/utils/voteStorage';
import { getVoterToken } from '@/utils/voterToken';

const CONFIRM_LOADING_MIN_DURATION_MS = 1200;

const delay = (duration: number) =>
  new Promise(resolve => window.setTimeout(resolve, duration));

interface VoteScope {
  mapId: string;
  voteRound: number;
}

export default function useVoteFlow(
  shareKey: string,
  queryMapId: string | null,
  voteRound = 1,
) {
  const router = useRouter();
  const mapIdInfo = useAtomValue(mapIdState);
  const setResultConfirm = useSetAtom(resultConfirmState);
  const resetModal = useResetAtom(modalState);
  const { setModalContents } = useModal();
  const { mutateAsync: fetchPlaceWithShareKey } =
    usePlaceSearchWithShareKeyMutation();

  const activeMapId = (queryMapId || mapIdInfo.mapId) ?? '';
  const activeMapHostId =
    mapIdInfo.mapId === activeMapId ? mapIdInfo.mapHostId : '';
  const [isVote, setIsVote] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const currentScope = useRef<VoteScope | null>(null);

  useEffect(() => {
    currentScope.current = { mapId: activeMapId, voteRound };
    setIsVote(hasVotedForMap(activeMapId, voteRound));
    setIsConfirming(false);
    return () => {
      currentScope.current = null;
    };
  }, [activeMapId, voteRound]);

  const getCurrentScope = () => {
    const scope = currentScope.current;
    return scope?.mapId === activeMapId && scope.voteRound === voteRound
      ? scope
      : null;
  };

  const vote = async () => {
    const scope = getCurrentScope();
    if (!scope) return;
    resetModal();

    if (!activeMapId) {
      setModalContents({
        buttonLabel: '확인',
        contents: '추천 결과 정보를 찾을 수 없습니다.',
      });
      return;
    }

    try {
      await VoteService.setVote(
        activeMapId,
        shareKey,
        voteRound,
        getVoterToken(),
      );
      setVotedForMap(activeMapId, voteRound);
      if (currentScope.current !== scope) return;
      setIsVote(true);
    } catch (error) {
      if (currentScope.current !== scope) return;
      logApiError('vote', error);
      setModalContents({
        buttonLabel: '확인',
        contents: getApiErrorMessage(
          error,
          '투표에 실패했습니다. 다시 시도해주세요.',
        ),
      });
    }
  };

  const moveToFinal = async (scope: VoteScope) => {
    const data = await fetchPlaceWithShareKey(shareKey);
    if (currentScope.current !== scope) return;

    if (data) {
      setResultConfirm(data);
    }

    clearVotedForMap(activeMapId, voteRound);
    router.replace(`/result/confirm?sharekey=${shareKey}`);
  };

  const confirmVote = async () => {
    const scope = getCurrentScope();
    if (!scope) return;
    resetModal();
    setIsConfirming(true);

    try {
      await Promise.all([
        VoteService.setVoteConfirm(
          {
            mapId: activeMapId,
            mapHostId: activeMapHostId,
          },
          shareKey,
        ),
        delay(CONFIRM_LOADING_MIN_DURATION_MS),
      ]);
      if (currentScope.current !== scope) return;

      await Promise.all([
        moveToFinal(scope),
        delay(CONFIRM_LOADING_MIN_DURATION_MS),
      ]);
    } catch (error) {
      if (currentScope.current !== scope) return;
      logApiError('voteConfirm', error);
      setModalContents({
        buttonLabel: '확인',
        contents: getApiErrorMessage(
          error,
          '확정에 실패했습니다. 다시 시도해주세요.',
        ),
      });
    } finally {
      if (currentScope.current === scope) setIsConfirming(false);
    }
  };

  const requestVote = () => {
    if (isVote || !getCurrentScope()) return;

    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '투표하기',
      contents: '투표하시겠어요?\n수정이 불가능합니다.',
      onConfirm: vote,
    });
  };

  const requestConfirm = () => {
    if (!getCurrentScope()) return;
    if (!isVote) {
      setModalContents({
        buttonLabel: '확인',
        contents: '아직 투표를 안하셨어요!',
      });
      return;
    }

    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '확인',
      contents: '진짜 이대로 확정하시겠어요?',
      onConfirm: confirmVote,
    });
  };

  return {
    isVote,
    isConfirming,
    requestVote,
    requestConfirm,
    canConfirm: Boolean(activeMapHostId),
  };
}
