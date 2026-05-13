export type HotPlaceCategory = 'food' | 'cafe' | 'drink';

export type HotPlacePoint = {
  x: number;
  y: number;
};

export interface HotPlace {
  address_name: string;
  category_group_code: string;
  category_group_name: string;
  category_name: string;
  distance: string;
  id: string;
  phone: string;
  place_name: string;
  place_url: string;
  road_address_name: string;
  main_photo_url: string;
  x: string;
  y: string;
  day_business_hours_infos: any;
}

export interface ConfirmedHotPlace {
  id: number;
  map_id: string;
  share_key: string;
  category: HotPlaceCategory;
  kakao_place_id: string;
  place_name: string;
  place_url: string | null;
  address_name: string | null;
  road_address_name: string | null;
  phone: string | null;
  category_group_code: string | null;
  category_group_name: string | null;
  category_name: string | null;
  x: number | null;
  y: number | null;
  main_photo_url: string | null;
  day_business_hours_infos: any;
  raw_place: HotPlace;
  confirmed_at: string;
  updated_at: string;
}

export interface ConfirmHotPlaceRequest {
  mapId: string;
  mapHostId: string;
  shareKey: string;
  category: HotPlaceCategory;
  place: HotPlace;
}
