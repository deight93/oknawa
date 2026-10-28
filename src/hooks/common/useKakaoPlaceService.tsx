import { useEffect, useState } from 'react';

import { KakaoPlace } from '@/components/Address/types';

type SearchResult = {
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  places: KakaoPlace[];
};

export default function useKakaoPlaceService(query: string) {
  const [result, setResult] = useState<SearchResult>({
    status: 'idle',
    places: [],
  });
  const [kakaoPlaceService, setKakaoPlaceService] =
    useState<kakao.maps.services.Places | null>(null);
  const searchTerm = query.trim();

  useEffect(() => {
    let active = true;
    kakao.maps.load(() => {
      if (active) setKakaoPlaceService(new kakao.maps.services.Places());
    });
    return () => {
      active = false;
    };
  }, []);

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

  return result;
}
