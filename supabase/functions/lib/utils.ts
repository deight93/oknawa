import { corsHeaders } from './cors.ts';

interface FetchJsonOptions extends RequestInit {
  errorMessage?: string;
}

interface ApiErrorDetail {
  [key: string]: unknown;
}

interface ApiErrorPayload {
  error: string;
  errorCode: string;
  message: string;
  detail?: ApiErrorDetail | string;
}

export class ExternalApiError extends Error {
  public readonly status: number;
  public readonly url: string;
  public readonly bodyText: string;

  constructor(message: string, status: number, url: string, bodyText: string) {
    super(message);
    this.name = 'ExternalApiError';
    this.status = status;
    this.url = url;
    this.bodyText = bodyText.slice(0, 1000);
  }
}

export function responseJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function responseApiError(
  errorCode: string,
  message: string,
  status = 500,
  detail?: ApiErrorDetail | string,
): Response {
  const payload: ApiErrorPayload = {
    error: message,
    errorCode,
    message,
  };

  if (detail !== undefined) {
    payload.detail = detail;
  }

  return responseJson(payload, status);
}

export function toErrorMessage(
  error: unknown,
  fallback = 'Unexpected error',
): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

export function responseError(
  error: unknown,
  status = 500,
  errorCode = 'internal_error',
): Response {
  const responseStatus = error instanceof ExternalApiError ? 502 : status;
  const responseErrorCode =
    error instanceof ExternalApiError ? 'external_api_error' : errorCode;
  const detail =
    error instanceof ExternalApiError ? { status: error.status } : undefined;

  return responseApiError(
    responseErrorCode,
    toErrorMessage(error),
    responseStatus,
    detail,
  );
}

export async function fetchJson<T>(
  url: string,
  {
    errorMessage = 'External API request failed',
    ...init
  }: FetchJsonOptions = {},
): Promise<T> {
  const response = await fetch(url, init);
  const bodyText = await response.text();

  if (!response.ok) {
    throw new ExternalApiError(
      `${errorMessage} (${response.status})`,
      response.status,
      url,
      bodyText,
    );
  }

  if (!bodyText) {
    throw new ExternalApiError(
      `${errorMessage}: empty response`,
      response.status,
      url,
      bodyText,
    );
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new ExternalApiError(
      `${errorMessage}: invalid JSON response`,
      response.status,
      url,
      bodyText,
    );
  }
}
