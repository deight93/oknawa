import { useEffect, useState } from 'react';
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
  const { mutate: placeSearchWithShareKey } =
    usePlaceSearchWithShareKeyMutation();

  const activeMapId = (queryMapId || mapIdInfo.mapId) ?? '';
  const activeMapHostId =
    mapIdInfo.mapId === activeMapId ? mapIdInfo.mapHostId : '';
  const [isVote, setIsVote] = useState(false);

  useEffect(() => {
    setIsVote(hasVotedForMap(activeMapId, voteRound));
  }, [activeMapId, voteRound]);

  const vote = async () => {
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
      setIsVote(true);
    } catch (error) {
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

  const moveToFinal = () => {
    placeSearchWithShareKey(shareKey, {
      onSuccess: data => {
        if (data) {
          setResultConfirm(data);
        }
        clearVotedForMap(activeMapId, voteRound);
        router.replace(`/result/confirm?sharekey=${shareKey}`);
        resetModal();
      },
      onError: error => {
        logApiError('moveToFinal', error);
        setModalContents({
          buttonLabel: '확인',
          contents: getApiErrorMessage(
            error,
            '확정 결과를 불러오지 못했습니다. 다시 시도해주세요.',
          ),
        });
      },
    });
  };

  const confirmVote = async () => {
    try {
      await VoteService.setVoteConfirm(
        {
          mapId: activeMapId,
          mapHostId: activeMapHostId,
        },
        shareKey,
      );

      setModalContents({
        buttonLabel: '확인',
        contents: '이번 약속 지역이 확정되었어요!',
        onConfirm: moveToFinal,
      });
    } catch (error) {
      logApiError('voteConfirm', error);
      setModalContents({
        buttonLabel: '확인',
        contents: getApiErrorMessage(
          error,
          '확정에 실패했습니다. 다시 시도해주세요.',
        ),
      });
    }
  };

  const requestVote = () => {
    if (isVote) return;

    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '투표하기',
      contents: '투표하시겠어요?\n수정이 불가능합니다.',
      onConfirm: vote,
    });
  };

  const requestConfirm = () => {
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
    requestVote,
    requestConfirm,
    canConfirm: Boolean(activeMapHostId),
  };
}
