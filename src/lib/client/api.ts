/**
 * Typed fetch wrapper.
 *
 * Unwraps the `{ data, metadata, code }` envelope every route handler returns
 * and turns an error envelope into a thrown `ApiError`, so callers can use a
 * plain try/catch and never have to inspect status codes by hand.
 */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Envelope<T> {
  data?: T;
  metadata?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

export interface ApiResult<T> {
  data: T;
  metadata: unknown;
}

async function request<T>(
  path: string,
  init: RequestInit & { signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
    // Session cookie must ride along on every call.
    credentials: 'same-origin',
  });

  let body: Envelope<T> = {};
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    // A non-JSON body (proxy error page, 502) still needs a usable error.
    if (!response.ok) {
      throw new ApiError('server_error', `Request failed (${response.status})`, response.status);
    }
  }

  if (!response.ok || body.error) {
    throw new ApiError(
      body.error?.code ?? 'server_error',
      body.error?.message ?? `Request failed (${response.status})`,
      response.status,
      body.error?.details,
    );
  }

  return { data: body.data as T, metadata: body.metadata };
}

export const api = {
  /** GET returning just the payload. */
  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return (await request<T>(path, { method: 'GET', signal })).data;
  },
  /** GET returning payload plus metadata (pagination, counts). */
  async getWithMeta<T>(path: string, signal?: AbortSignal): Promise<ApiResult<T>> {
    return request<T>(path, { method: 'GET', signal });
  },
  async post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return (await request<T>(path, { method: 'POST', body: JSON.stringify(body), signal })).data;
  },
  async postWithMeta<T>(path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body), signal });
  },
  async patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return (await request<T>(path, { method: 'PATCH', body: JSON.stringify(body), signal })).data;
  },
  async put<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return (await request<T>(path, { method: 'PUT', body: JSON.stringify(body), signal })).data;
  },
  async delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    return (await request<T>(path, { method: 'DELETE', signal })).data;
  },
};

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
