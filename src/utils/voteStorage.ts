import { createSafeJSONStorage } from './browserStorage';

const LEGACY_VOTE_STORAGE_KEY = 'isVote';
const VOTE_STORAGE_PREFIX = 'isVote:';
const storage = createSafeJSONStorage<boolean>(() => localStorage);
const knownKeys = new Set<string>();

const canUseLocalStorage = () => typeof window !== 'undefined';

export const getVoteStorageKey = (mapId: string, voteRound = 1) =>
  `${VOTE_STORAGE_PREFIX}${mapId}:${voteRound}`;

export const clearLegacyVoteState = () => {
  if (!canUseLocalStorage()) {
    return;
  }

  storage.removeItem(LEGACY_VOTE_STORAGE_KEY);
};

export const hasVotedForMap = (
  mapId?: string | null,
  voteRound?: number | null,
) => {
  if (!mapId || !canUseLocalStorage()) {
    return false;
  }

  const key = getVoteStorageKey(mapId, voteRound ?? 1);
  knownKeys.add(key);
  return storage.getItem(key, false) === true;
};

export const setVotedForMap = (mapId: string, voteRound = 1) => {
  if (!canUseLocalStorage()) {
    return;
  }

  const key = getVoteStorageKey(mapId, voteRound);
  knownKeys.add(key);
  storage.setItem(key, true);
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
    storage.removeItem(getVoteStorageKey(mapId, voteRound ?? 1));
  }

  clearLegacyVoteState();
};

export const clearVoteStateForMap = (mapId?: string | null) => {
  if (!mapId || !canUseLocalStorage()) {
    return;
  }

  const mapVoteStoragePrefix = `${VOTE_STORAGE_PREFIX}${mapId}:`;

  let keys: string[] = [];
  try {
    keys = Object.keys(localStorage);
  } catch {
    /* Storage access may be blocked. */
  }
  Array.from(new Set([...keys, ...Array.from(knownKeys)]))
    .filter(key => key.startsWith(mapVoteStoragePrefix))
    .forEach(key => {
      storage.removeItem(key);
      knownKeys.delete(key);
    });

  clearLegacyVoteState();
};
