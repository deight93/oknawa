import useModal from '@/hooks/common/useModal';
import { useAtomValue } from 'jotai';
import { mapIdState } from '@/jotai/mapId/store';

const getShareUrl = (mapId: string, queryMapId?: string | null) => {
  const url = new URL(window.location.href);

  if (!queryMapId && mapId) {
    url.searchParams.set('mapId', mapId);
  }

  return url.toString();
};

export default function useResultShare(queryMapId: string | null) {
  const { mapId } = useAtomValue(mapIdState);
  const { setModalContents } = useModal();

  const copyInvitationLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl(mapId, queryMapId));
      setModalContents({
        buttonLabel: '확인',
        contents: '링크가 복사되었습니다!',
      });
    } catch (error) {
      console.error('클립보드에 복사 실패:', error);
    }
  };

  return { copyInvitationLink };
}
