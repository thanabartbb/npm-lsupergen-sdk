export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

export interface ClientOptions {
  /** API key. Defaults to `process.env.LSUPERGEN_API_KEY`. */
  apiKey?: string;
  /** Base URL of the API. Defaults to `process.env.LSUPERGEN_BASE_URL` or `https://api.lsupergen.com`. */
  baseURL?: string;
  /** Per-request timeout in milliseconds. Default: 60000. */
  timeout?: number;
  /** How many times to retry on 408/409/429/5xx and network errors. Default: 2. */
  maxRetries?: number;
  /** Headers sent with every request. */
  defaultHeaders?: Record<string, string>;
  /** Custom `fetch` implementation (useful for testing or older runtimes). */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}
