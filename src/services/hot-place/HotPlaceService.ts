import { api } from '@/api/client';
import {
  ConfirmHotPlaceRequest,
  ConfirmedHotPlace,
  HotPlace,
  HotPlaceCategory,
  HotPlacePoint,
} from './types';

export default class HotPlaceService {
  static async fetchHotPlace(
    category: HotPlaceCategory,
    point: HotPlacePoint,
    page = 1,
    size = 5,
  ) {
    const res = await api.get(
      `/functions/v1/location-point-place/${category}`,
      {
        params: {
          x: point.x,
          y: point.y,
          radius: 500,
          page,
          size,
          sort: 'accuracy',
        },
      },
    );

    return res.data;
  }

  static async confirmHotPlace({
    mapId,
    mapHostId,
    shareKey,
    category,
    place,
  }: ConfirmHotPlaceRequest) {
    const { data } = await api.post('/rest/v1/rpc/location_hot_place_confirm', {
      p_map_id: mapId,
      p_map_host_id: mapHostId,
      p_share_key: shareKey,
      p_category: category,
      p_place: place,
    });

    return data;
  }

  static async fetchConfirmedHotPlace(shareKey: string) {
    const { data } = await api.get<ConfirmedHotPlace[]>(
      '/rest/v1/confirmed_hot_place',
      {
        params: {
          share_key: `eq.${shareKey}`,
          select: '*',
          limit: 1,
        },
      },
    );

    return data?.[0] ?? null;
  }
}
