import { useEffect, useState } from 'react';

import type { KakaoPlace } from '@/components/Address/types';
import { waitForKakaoMaps } from '@/utils/kakaoMapsReady';

type SearchResult = {
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'sdk-error';
  places: KakaoPlace[];
};

type SearchServices = {
  places: kakao.maps.services.Places;
  geocoder: kakao.maps.services.Geocoder;
};

type ProviderResult = {
  status: kakao.maps.services.Status;
  places: KakaoPlace[];
};

type AddressSearchCallback = Parameters<
  kakao.maps.services.Geocoder['addressSearch']
>[1];

const locationKey = (place: Pick<KakaoPlace, 'address_name' | 'x' | 'y'>) =>
  JSON.stringify([place.address_name, Number(place.x), Number(place.y)]);

const addressToPlace = (
  address: Parameters<AddressSearchCallback>[0][number],
): KakaoPlace => {
  const location = {
    address_name: address.address?.address_name || address.address_name,
    x: address.x,
    y: address.y,
  };
  return {
    ...location,
    id: `address:${locationKey(location)}`,
    place_name: address.address_name,
    road_address_name: address.road_address?.address_name || '',
  };
};

const mergePlaces = (keywords: KakaoPlace[], addresses: KakaoPlace[]) => {
  const ids = new Set<string>();
  const keywordLocations = new Set(keywords.map(locationKey));
  // Prefer named places at the same address, but keep distinct businesses there.
  return [
    ...keywords,
    ...addresses.filter(place => !keywordLocations.has(locationKey(place))),
  ].filter(place => {
    if (ids.has(place.id)) return false;
    ids.add(place.id);
    return true;
  });
};

export default function useKakaoPlaceService(query: string): SearchResult {
  const [result, setResult] = useState<SearchResult>({
    status: 'idle',
    places: [],
  });
  const [services, setServices] = useState<SearchServices | null>(null);
  const [sdkError, setSdkError] = useState(false);
  const searchTerm = query.trim();

  useEffect(() => {
    if (services) return;
    let active = true;
    setSdkError(false);
    void waitForKakaoMaps()
      .then(() => {
        if (active) {
          setServices({
            places: new kakao.maps.services.Places(),
            geocoder: new kakao.maps.services.Geocoder(),
          });
        }
      })
      .catch(() => {
        if (active) setSdkError(true);
      });
    return () => {
      active = false;
    };
  }, [services, searchTerm]);

  useEffect(() => {
    if (!searchTerm) {
      setResult({ status: 'idle', places: [] });
      return;
    }

    setResult({ status: 'loading', places: [] });
    if (!services) return;

    // A cleared or newer query owns the screen, even if an older request finishes later.
    let active = true;
    const timer = setTimeout(() => {
      let keywords: ProviderResult | undefined;
      let addresses: ProviderResult | undefined;
      const publish = () => {
        if (!active) return;
        const places = mergePlaces(
          keywords?.places ?? [],
          addresses?.places ?? [],
        );
        if (places.length) {
          setResult({ status: 'success', places });
        } else if (keywords && addresses) {
          setResult({
            status:
              keywords.status === kakao.maps.services.Status.ERROR ||
              addresses.status === kakao.maps.services.Status.ERROR
                ? 'error'
                : 'empty',
            places: [],
          });
        }
      };

      // One provider's failure must not hide the other provider's matches.
      try {
        services.places.keywordSearch(searchTerm, (places, status) => {
          if (!active) return;
          keywords = {
            status,
            places: status === kakao.maps.services.Status.OK ? places : [],
          };
          publish();
        });
      } catch {
        keywords = { status: kakao.maps.services.Status.ERROR, places: [] };
        publish();
      }
      try {
        services.geocoder.addressSearch(searchTerm, (results, status) => {
          if (!active) return;
          addresses = {
            status,
            places:
              status === kakao.maps.services.Status.OK
                ? results.map(addressToPlace)
                : [],
          };
          publish();
        });
      } catch {
        addresses = { status: kakao.maps.services.Status.ERROR, places: [] };
        publish();
      }
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, services]);

  return searchTerm && sdkError ? { status: 'sdk-error', places: [] } : result;
}
