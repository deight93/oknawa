const LEGACY_VOTE_STORAGE_KEY = 'isVote';
const VOTE_STORAGE_PREFIX = 'isVote:';

const canUseLocalStorage = () => typeof window !== 'undefined';

export const getVoteStorageKey = (mapId: string, voteRound = 1) =>
  `${VOTE_STORAGE_PREFIX}${mapId}:${voteRound}`;

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
