import axios from 'axios';

const getResponseField = (
  value: unknown,
  key: 'error' | 'message',
): string | null => {
  const record = value as Record<string, unknown> | null;

  if (
    record &&
    typeof record === 'object' &&
    key in record &&
    typeof record[key] === 'string'
  ) {
    return record[key] as string;
  }

  return null;
};

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const responseMessage =
      getResponseField(responseData, 'message') ??
      getResponseField(responseData, 'error');

    if (responseMessage) return responseMessage;

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

export const getApiErrorMessage = (
  error: unknown,
  fallback = '요청을 처리하지 못했습니다. 다시 시도해주세요.',
) => {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK') {
      return '네트워크 연결 또는 배포 상태를 확인해주세요.';
    }

    if (error.code === 'ECONNABORTED') {
      return '응답 시간이 초과되었습니다. 다시 시도해주세요.';
    }

    const status = error.response?.status;
    if (status && status >= 500) {
      const responseMessage = getErrorMessage(error);
      return responseMessage === error.message ? fallback : responseMessage;
    }
  }

  if (
    error instanceof Error &&
    error.message.startsWith('Vote confirmation failed:')
  ) {
    return fallback;
  }

  const message = getErrorMessage(error);
  if (!message || message === 'Unknown error') {
    return fallback;
  }

  return message;
};

export const logApiError = (context: string, error: unknown) => {
  console.error(`[${context}] ${getErrorMessage(error)}`, error);
};
