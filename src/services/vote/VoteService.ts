import { api } from '@/api/client';

import { MapIdType } from '../search/types';

export default class VoteService {
  static async setVote(mapId: string, shareKey: string) {
    const { data } = await api.post(`/rest/v1/rpc/location_points_vote`, {
      map_id: mapId,
      share_key: shareKey,
    });

    return data;
  }

  static async setVoteConfirm(mapIdInfo: MapIdType, shareKey: string) {
    const response = await api.patch(
      '/rest/v1/location_result',
      { confirmed: shareKey },
      {
        params: {
          map_id: `eq.${mapIdInfo.mapId}`,
          map_host_id: `eq.${mapIdInfo.mapHostId}`,
        },
        validateStatus: () => true,
      },
    );

    if (response.status >= 400) {
      throw new Error(`Vote confirmation failed: ${response.status}`);
    }

    if (response.status === 204) {
      return { msg: '약속 지역 확정 완료 (204)' };
    }

    return response.data;
  }

  static async cancelConfirm(mapIdInfo: MapIdType) {
    const { data } = await api.post('/rest/v1/rpc/location_confirm_cancel', {
      p_map_id: mapIdInfo.mapId,
      p_map_host_id: mapIdInfo.mapHostId,
    });

    return data;
  }

  static async resetVote(mapIdInfo: MapIdType) {
    const { data } = await api.post('/rest/v1/rpc/location_vote_reset', {
      p_map_id: mapIdInfo.mapId,
      p_map_host_id: mapIdInfo.mapHostId,
    });

    return data;
  }
}
