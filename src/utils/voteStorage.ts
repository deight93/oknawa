const LEGACY_VOTE_STORAGE_KEY = 'isVote';
const VOTE_STORAGE_PREFIX = 'isVote:';
const HOT_PLACE_VOTE_STORAGE_PREFIX = 'hotPlaceVote:';

const canUseLocalStorage = () => typeof window !== 'undefined';

export const getVoteStorageKey = (mapId: string, voteRound = 1) =>
  `${VOTE_STORAGE_PREFIX}${mapId}:${voteRound}`;

export const getHotPlaceVoteStorageKey = (
  mapId: string,
  shareKey: string,
  voteRound = 1,
) => `${HOT_PLACE_VOTE_STORAGE_PREFIX}${mapId}:${shareKey}:${voteRound}`;

export const clearLegacyVoteState = () => {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.removeItem(LEGACY_VOTE_STORAGE_KEY);
};

export const hasVotedForMap = (
  mapId?: string | null,
  voteRound?: number | null,
) => {
  if (!mapId || !canUseLocalStorage()) {
    return false;
  }

  return (
    localStorage.getItem(getVoteStorageKey(mapId, voteRound ?? 1)) === 'true'
  );
};

export const setVotedForMap = (mapId: string, voteRound = 1) => {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.setItem(getVoteStorageKey(mapId, voteRound), 'true');
  clearLegacyVoteState();
};

export const clearVotedForMap = (
  mapId?: string | null,
  voteRound?: number | null,
) => {
  if (!canUseLocalStorage()) {
    return;
  }

  if (mapId) {
    localStorage.removeItem(getVoteStorageKey(mapId, voteRound ?? 1));
  }

  clearLegacyVoteState();
};

export const getVotedHotPlaceId = (
  mapId?: string | null,
  shareKey?: string | null,
  voteRound?: number | null,
) => {
  if (!mapId || !shareKey || !canUseLocalStorage()) {
    return '';
  }

  return (
    localStorage.getItem(
      getHotPlaceVoteStorageKey(mapId, shareKey, voteRound ?? 1),
    ) ?? ''
  );
};

export const setVotedHotPlace = (
  mapId: string,
  shareKey: string,
  placeId: string,
  voteRound = 1,
) => {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.setItem(
    getHotPlaceVoteStorageKey(mapId, shareKey, voteRound),
    placeId,
  );
};
