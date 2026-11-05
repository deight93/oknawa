'use client';

import Script from 'next/script';
import { KAKAO_APP_KEY } from '@/config/env';
import {
  onKakaoMapsScriptLoad,
  onKakaoMapsScriptError,
} from '@/utils/kakaoMapsReady';

export default function KakaoScripts() {
  return (
    <>
      <Script
        id="kakao-map-sdk"
        type="text/javascript"
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&libraries=services&autoload=false`}
        strategy="afterInteractive"
        onLoad={onKakaoMapsScriptLoad}
        onError={onKakaoMapsScriptError}
      />
      <Script
        src="https://developers.kakao.com/sdk/js/kakao.js"
        strategy="afterInteractive"
      />
    </>
  );
}
