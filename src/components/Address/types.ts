export type KakaoPlace = Pick<
  kakao.maps.services.PlacesSearchResultItem,
  'id' | 'place_name' | 'address_name' | 'x' | 'y'
> &
  Partial<
    Pick<kakao.maps.services.PlacesSearchResultItem, 'road_address_name'>
  >;

export type KakaoPlacesSearchStatus = `${kakao.maps.services.Status}`;
