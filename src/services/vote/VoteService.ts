import { api } from '@/api/client';

import { MapIdType } from '../search/types';

export default class VoteService {
  static async setVote(
    mapId: string,
    shareKey: string,
    voteRound: number,
    voterToken: string,
  ) {
    const { data } = await api.post(`/rest/v1/rpc/location_points_vote`, {
      map_id: mapId,
      share_key: shareKey,
      vote_round: voteRound,
      voter_token: voterToken,
    });

    return data;
  }

  static async setVoteConfirm(mapIdInfo: MapIdType, shareKey: string) {
    const { data } = await api.post('/rest/v1/rpc/location_station_confirm', {
      p_map_id: mapIdInfo.mapId,
      p_map_host_id: mapIdInfo.mapHostId,
      p_share_key: shareKey,
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
