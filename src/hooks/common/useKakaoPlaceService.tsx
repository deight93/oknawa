import { useEffect, useState } from 'react';

import { KakaoPlace } from '@/components/Address/types';
import { waitForKakaoMaps } from '@/utils/kakaoMapsReady';

type SearchResult = {
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'sdk-error';
  places: KakaoPlace[];
};

export default function useKakaoPlaceService(query: string): SearchResult {
  const [result, setResult] = useState<SearchResult>({
    status: 'idle',
    places: [],
  });
  const [kakaoPlaceService, setKakaoPlaceService] =
    useState<kakao.maps.services.Places | null>(null);
  const [sdkError, setSdkError] = useState(false);
  const searchTerm = query.trim();

  useEffect(() => {
    if (kakaoPlaceService) return;
    let active = true;
    setSdkError(false);
    void waitForKakaoMaps()
      .then(() => {
        if (active) setKakaoPlaceService(new kakao.maps.services.Places());
      })
      .catch(() => {
        if (active) setSdkError(true);
      });
    return () => {
      active = false;
    };
  }, [kakaoPlaceService, searchTerm]);

  useEffect(() => {
    if (!searchTerm) {
      setResult({ status: 'idle', places: [] });
      return;
    }

    setResult({ status: 'loading', places: [] });
    if (!kakaoPlaceService) return;

    // A cleared or newer query owns the screen, even if an older request finishes later.
    let active = true;
    const timer = setTimeout(() => {
      kakaoPlaceService.keywordSearch(searchTerm, (places, status) => {
        if (!active) return;
        if (status === kakao.maps.services.Status.OK) {
          setResult({ status: 'success', places });
        } else {
          setResult({
            status:
              status === kakao.maps.services.Status.ZERO_RESULT
                ? 'empty'
                : 'error',
            places: [],
          });
        }
      });
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, kakaoPlaceService]);

  return searchTerm && sdkError ? { status: 'sdk-error', places: [] } : result;
}
