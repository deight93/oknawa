const VOTER_TOKEN_STORAGE_KEY = 'oknawa:voterToken';

const createFallbackToken = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const createVoterToken = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return createFallbackToken();
};

export const getVoterToken = () => {
  try {
    const existingToken = localStorage.getItem(VOTER_TOKEN_STORAGE_KEY);
    if (existingToken) return existingToken;
    const token = createVoterToken();
    localStorage.setItem(VOTER_TOKEN_STORAGE_KEY, token);
    if (localStorage.getItem(VOTER_TOKEN_STORAGE_KEY) !== token)
      throw new Error('Voter token was not saved');
    return token;
  } catch {
    throw new Error(
      '브라우저 저장소를 사용할 수 없어 투표하지 못했어요. 저장소 사용을 허용한 뒤 다시 시도해주세요.',
    );
  }
};
