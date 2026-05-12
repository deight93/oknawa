import axios from 'axios';

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (
      responseData &&
      typeof responseData === 'object' &&
      'message' in responseData
    ) {
      return String(responseData.message);
    }

    if (
      responseData &&
      typeof responseData === 'object' &&
      'error' in responseData
    ) {
      return String(responseData.error);
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

export const logApiError = (context: string, error: unknown) => {
  console.error(`[${context}] ${getErrorMessage(error)}`, error);
};
