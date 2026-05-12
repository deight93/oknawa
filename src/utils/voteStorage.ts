const LEGACY_VOTE_STORAGE_KEY = 'isVote';
const VOTE_STORAGE_PREFIX = 'isVote:';

const canUseLocalStorage = () => typeof window !== 'undefined';

export const getVoteStorageKey = (mapId: string) =>
  `${VOTE_STORAGE_PREFIX}${mapId}`;

export const clearLegacyVoteState = () => {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.removeItem(LEGACY_VOTE_STORAGE_KEY);
};

export const hasVotedForMap = (mapId?: string | null) => {
  if (!mapId || !canUseLocalStorage()) {
    return false;
  }

  return localStorage.getItem(getVoteStorageKey(mapId)) === 'true';
};

export const setVotedForMap = (mapId: string) => {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.setItem(getVoteStorageKey(mapId), 'true');
  clearLegacyVoteState();
};

export const clearVotedForMap = (mapId?: string | null) => {
  if (!canUseLocalStorage()) {
    return;
  }

  if (mapId) {
    localStorage.removeItem(getVoteStorageKey(mapId));
  }

  clearLegacyVoteState();
};
