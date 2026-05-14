import { APP_BASE_URL, KAKAO_APP_KEY } from '@/config/env';
import toast from 'react-hot-toast';

const DEFAULT_SHARE_IMAGE_PATH = '/images/kakao-share.jpg';

const getBaseUrl = () => APP_BASE_URL || window.location.origin;

const toAbsoluteUrl = (url: string) => new URL(url, getBaseUrl()).toString();

const getConfirmUrl = (shareKey: string) => {
  const url = new URL('/result/confirm', getBaseUrl());
  url.searchParams.set('sharekey', shareKey);

  return url.toString();
};

const getShareImageUrl = () => {
  try {
    const url = new URL(DEFAULT_SHARE_IMAGE_PATH, getBaseUrl());

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch (error) {
    console.error('Kakao share image url error:', error);
  }

  return toAbsoluteUrl(DEFAULT_SHARE_IMAGE_PATH);
};

export default function useKakaoShare() {
  const copyShareUrl = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('공유 링크를 복사했습니다.');
    } catch (error) {
      console.error('Share url copy error:', error);
      toast.error('공유를 열 수 없습니다. 링크를 직접 복사해주세요.');
    }
  };

  const initKakao = () => {
    if (!window.Kakao || !KAKAO_APP_KEY) {
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
      const confirmUrl = getConfirmUrl(shareKey);
      const isReady = initKakao();
      const kakaoSdk = window.Kakao;

      if (!isReady || !kakaoSdk) {
        void copyShareUrl(confirmUrl);
        return;
      }

      kakaoSdk.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `오늘은 ${stationName}에서 만나요!`,
          description: '약속 장소를 확인해보세요!',
          imageUrl: getShareImageUrl(),
          link: {
            webUrl: confirmUrl,
            mobileWebUrl: confirmUrl,
          },
        },
      });
    } catch (error) {
      console.error('Kakao share error:', error);
      void copyShareUrl(getConfirmUrl(shareKey));
    }
  };

  return { shareConfirmedResult };
}
