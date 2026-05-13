import {
  APP_BASE_URL,
  KAKAO_APP_KEY,
  KAKAO_SHARE_IMAGE_URL,
} from '@/config/env';
import toast from 'react-hot-toast';

interface ShareConfirmedResultOptions {
  addressName?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
  placeUrl?: string | null;
  placeName?: string | null;
  travelTimeLabel?: string;
}

const DEFAULT_SHARE_IMAGE_PATH = '/images/og-image.jpg';

const getBaseUrl = () => APP_BASE_URL || window.location.origin;

const toAbsoluteUrl = (url: string) => new URL(url, getBaseUrl()).toString();

const getConfirmUrl = (shareKey: string) => {
  const url = new URL('/result/confirm', getBaseUrl());
  url.searchParams.set('sharekey', shareKey);

  return url.toString();
};

const getShareImageUrl = (imageUrl?: string | null) => {
  const fallbackImageUrl = KAKAO_SHARE_IMAGE_URL || DEFAULT_SHARE_IMAGE_PATH;
  const candidate = imageUrl || fallbackImageUrl;

  try {
    const url = new URL(candidate, getBaseUrl());

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch (error) {
    console.error('Kakao share image url error:', error);
  }

  return toAbsoluteUrl(fallbackImageUrl);
};

const getShareDescription = (
  stationName: string,
  options?: ShareConfirmedResultOptions,
) => {
  const detailList = [
    options?.categoryName,
    options?.addressName,
    options?.travelTimeLabel ? `평균 ${options.travelTimeLabel}` : null,
  ].filter(Boolean);

  if (detailList.length > 0) {
    return detailList.join(' · ');
  }

  return `${stationName} 근처 약속 장소와 이동 경로를 확인해보세요.`;
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

  const shareConfirmedResult = (
    stationName: string,
    shareKey: string,
    options?: ShareConfirmedResultOptions,
  ) => {
    try {
      const confirmUrl = getConfirmUrl(shareKey);
      const isReady = initKakao();

      if (!isReady) {
        void copyShareUrl(confirmUrl);
        return;
      }

      const placeName = options?.placeName || stationName;
      const placeUrl = options?.placeUrl
        ? toAbsoluteUrl(options.placeUrl)
        : null;
      const description = getShareDescription(stationName, options);
      const buttons = [
        {
          title: '약속 장소 보기',
          link: {
            webUrl: confirmUrl,
            mobileWebUrl: confirmUrl,
          },
        },
      ];

      if (placeUrl) {
        buttons.push({
          title: '장소 정보 보기',
          link: {
            webUrl: placeUrl,
            mobileWebUrl: placeUrl,
          },
        });
      }

      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `${placeName}에서 만나요`,
          description,
          imageUrl: getShareImageUrl(options?.imageUrl),
          link: {
            webUrl: confirmUrl,
            mobileWebUrl: confirmUrl,
          },
        },
        buttonTitle: '약속 장소 보기',
        buttons,
      });
    } catch (error) {
      console.error('Kakao share error:', error);
      void copyShareUrl(getConfirmUrl(shareKey));
    }
  };

  return { shareConfirmedResult };
}
