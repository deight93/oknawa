import {
  APP_BASE_URL,
  KAKAO_APP_KEY,
  KAKAO_SHARE_IMAGE_URL,
} from '@/config/env';

interface ShareConfirmedResultOptions {
  addressName?: string | null;
  imageUrl?: string | null;
  placeName?: string | null;
}

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

  const shareConfirmedResult = (
    stationName: string,
    shareKey: string,
    options?: ShareConfirmedResultOptions,
  ) => {
    try {
      const isReady = initKakao();

      if (!isReady) {
        return;
      }

      const confirmUrl = `${APP_BASE_URL}/result/confirm?sharekey=${shareKey}`;
      const placeName = options?.placeName || stationName;
      const description =
        options?.addressName || `${stationName} 근처 약속 장소를 확인해보세요!`;

      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `오늘은 ${placeName}에서 만나요!`,
          description,
          imageUrl: options?.imageUrl || KAKAO_SHARE_IMAGE_URL,
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
