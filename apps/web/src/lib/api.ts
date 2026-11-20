import createClient from 'openapi-fetch';
import type { components, paths } from './api.types';

export const api = createClient<paths>({ credentials: 'same-origin', cache: 'no-store' });

type ContractError = components['schemas']['ApiErrorCode'];
type FailureCode = ContractError | 'network_error' | 'unexpected_response';

export type ApiFailure = {
  code: FailureCode;
  message: string;
  fields?: Readonly<Record<string, string>>;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; failure: ApiFailure };

const messages = {
  validation_error: 'Check the information you entered and try again.',
  unauthorized: 'Sign in to continue.',
  avatar_required: 'Create a character before joining.',
  room_unavailable: 'Couldn’t connect to the Study Room. Try joining again.',
  rate_limited: 'Wait a moment and try again.',
  service_unavailable: 'The service is unavailable. Try again shortly.',
  network_error: 'Couldn’t reach Mini Connecta. Check your connection and try again.',
  unexpected_response: 'Something went wrong. Try again.',
} satisfies Record<FailureCode, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isContractError(value: unknown): value is ContractError {
  return (
    typeof value === 'string' &&
    value !== 'network_error' &&
    value !== 'unexpected_response' &&
    Object.hasOwn(messages, value)
  );
}

function statusCode(status: number): FailureCode {
  if (status === 400) return 'validation_error';
  if (status === 401) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'service_unavailable';
  return 'unexpected_response';
}

function toFailure(status: number, body: unknown): ApiFailure {
  const error = isRecord(body) && isRecord(body.error) ? body.error : undefined;
  const code = status === 401
    ? 'unauthorized'
    : isContractError(error?.code)
      ? error.code
      : statusCode(status);
  const fields = error?.fields;
  if (code !== 'validation_error' || !isRecord(fields)) return { code, message: messages[code] };

  const fieldErrors = Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  return { code, message: messages[code], fields: fieldErrors };
}

export async function requestJson<T>(
  request: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<ApiResult<T>> {
  try {
    const { data, error, response } = await request();
    if (!response.ok) return { ok: false, failure: toFailure(response.status, error) };
    if (data !== undefined && data !== null) return { ok: true, data };
    return { ok: false, failure: toFailure(response.status, undefined) };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    const code = error instanceof SyntaxError ? 'unexpected_response' : 'network_error';
    return { ok: false, failure: { code, message: messages[code] } };
  }
}
