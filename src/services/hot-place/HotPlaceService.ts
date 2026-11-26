import { api } from '@/api/client';
import { HotPlace, PlaceSearchKind, HotPlacePoint } from './types';

export default class HotPlaceService {
  static async fetchHotPlace(
    category: PlaceSearchKind,
    point: HotPlacePoint,
    page = 1,
    size = 5,
    signal?: AbortSignal,
  ) {
    const res = await api.get<{
      documents: HotPlace[];
      meta: { is_end: boolean };
    }>(`/functions/v1/location-point-place/${category}`, {
      signal,
      params: {
        x: point.x,
        y: point.y,
        radius: 500,
        page,
        size,
        sort: 'accuracy',
      },
    });

    return res.data;
  }
}
