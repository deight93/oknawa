const VOTER_TOKEN_STORAGE_KEY = 'oknawa:voterToken';

const canUseLocalStorage = () => typeof window !== 'undefined';

const createFallbackToken = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const createVoterToken = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return createFallbackToken();
};

export const getVoterToken = () => {
  if (!canUseLocalStorage()) {
    return createVoterToken();
  }

  const existingToken = localStorage.getItem(VOTER_TOKEN_STORAGE_KEY);
  if (existingToken) {
    return existingToken;
  }

  const token = createVoterToken();
  localStorage.setItem(VOTER_TOKEN_STORAGE_KEY, token);
  return token;
};
