export interface HotPlaceConfirmConfig {
  mapId: string;
  mapHostId: string;
  shareKey: string;
}

export interface HotPlaceVoteConfig {
  mapId: string;
  shareKey: string;
  voteRound?: number;
}
