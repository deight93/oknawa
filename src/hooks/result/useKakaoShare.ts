import {
  APP_BASE_URL,
  KAKAO_APP_KEY,
  KAKAO_SHARE_IMAGE_URL,
} from '@/config/env';

export default function useKakaoShare() {
  const initKakao = () => {
    if (!window.Kakao) {
      return false;
    }

    if (!window.Kakao.isInitialized()) {
      try {
        window.Kakao.init(KAKAO_APP_KEY);
      } catch (error) {
        console.error('Kakao init error:', error);
        return false;
      }
    }

    return true;
  };

  const shareConfirmedResult = (stationName: string, shareKey: string) => {
    try {
      const isReady = initKakao();

      if (!isReady) {
        return;
      }

      const confirmUrl = `${APP_BASE_URL}/result/confirm?sharekey=${shareKey}`;

      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `오늘은 ${stationName}에서 만나요!`,
          description: '약속 장소를 확인해보세요!',
          imageUrl: KAKAO_SHARE_IMAGE_URL,
          link: {
            webUrl: confirmUrl,
            mobileWebUrl: confirmUrl,
          },
        },
      });
    } catch (error) {
      console.error('Kakao share error:', error);
    }
  };

  return { shareConfirmedResult };
}
