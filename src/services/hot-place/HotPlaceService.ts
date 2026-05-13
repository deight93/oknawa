import { api } from '@/api/client';
import {
  ConfirmHotPlaceRequest,
  ConfirmedHotPlace,
  HotPlace,
  HotPlaceCategory,
  HotPlacePoint,
  HotPlaceVote,
  VoteHotPlaceRequest,
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

  static async fetchHotPlaceVotes(
    mapId: string,
    shareKey: string,
    voteRound: number,
    category: HotPlaceCategory,
  ) {
    const { data } = await api.get<HotPlaceVote[]>('/rest/v1/hot_place_vote', {
      params: {
        map_id: `eq.${mapId}`,
        share_key: `eq.${shareKey}`,
        vote_round: `eq.${voteRound}`,
        category: `eq.${category}`,
        select:
          'id,map_id,share_key,vote_round,category,kakao_place_id,place_name,vote',
        order: 'vote.desc,updated_at.desc',
      },
    });

    return data ?? [];
  }

  static async voteHotPlace({
    mapId,
    shareKey,
    voteRound,
    category,
    place,
  }: VoteHotPlaceRequest) {
    const { data } = await api.post('/rest/v1/rpc/location_hot_place_vote', {
      p_map_id: mapId,
      p_share_key: shareKey,
      p_vote_round: voteRound,
      p_category: category,
      p_place: place,
    });

    return data;
  }
}
