declare global {
  interface KakaoShareDefaultConfig {
    objectType: 'feed';
    content: {
      title: string;
      description: string;
      imageUrl: string;
      link: {
        webUrl: string;
        mobileWebUrl: string;
      };
    };
  }

  interface KakaoSdk {
    init: (appKey: string) => void;
    isInitialized: () => boolean;
    Share: {
      sendDefault: (config: KakaoShareDefaultConfig) => void;
    };
  }

  interface Window {
    Kakao?: KakaoSdk;
  }
}

export {};
