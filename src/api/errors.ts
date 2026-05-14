import axios from 'axios';

const getResponseField = (
  value: unknown,
  key: 'error' | 'message' | 'errorCode',
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

const apiErrorMessageMap: Record<string, string> = {
  invalid_json_body: '요청 형식이 올바르지 않습니다. 다시 시도해주세요.',
  invalid_participant: '출발지 정보가 올바르지 않습니다. 다시 입력해주세요.',
  candidate_location_empty:
    '추천 후보 데이터를 찾지 못했습니다. 잠시 후 다시 시도해주세요.',
  no_route_result:
    '이동 경로를 계산하지 못했습니다. 출발지를 다시 확인해주세요.',
  location_result_insert_failed:
    '추천 결과를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
  station_info_insert_failed:
    '후보 장소를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
  external_api_error:
    '지도 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  method_not_allowed: '지원하지 않는 요청입니다.',
  invalid_category: '장소 카테고리가 올바르지 않습니다.',
  missing_coordinates: '좌표 정보가 없습니다.',
};

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const errorCode = getResponseField(responseData, 'errorCode');

    if (errorCode && apiErrorMessageMap[errorCode]) {
      return apiErrorMessageMap[errorCode];
    }

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
