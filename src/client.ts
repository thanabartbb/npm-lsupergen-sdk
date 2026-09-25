import { APIError, ConnectionError, LsupergenError, TimeoutError } from './errors.js';
import type { ClientOptions, HttpMethod, QueryValue, RequestOptions } from './types.js';
import { VERSION } from './version.js';

const DEFAULT_BASE_URL = 'https://agents-sdk.space/v1';
const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_RETRIES = 2;

function readEnv(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export class Lsupergen {
  readonly apiKey: string;
  readonly baseURL: string;
  readonly timeout: number;
  readonly maxRetries: number;

  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions = {}) {
    const apiKey = options.apiKey ?? readEnv('LSUPERGEN_API_KEY');
    if (!apiKey) {
      throw new LsupergenError(
        'Missing API key. Pass `apiKey` to the client or set the LSUPERGEN_API_KEY environment variable.',
      );
    }
    this.apiKey = apiKey;
    this.baseURL = (options.baseURL ?? readEnv('LSUPERGEN_BASE_URL') ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    );
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.defaultHeaders = options.defaultHeaders ?? {};
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new LsupergenError('No `fetch` implementation found. Use Node.js 18+ or pass `fetch`.');
    }
    // Browsers and Cloudflare Workers throw "Illegal invocation" when fetch is called with a
    // `this` other than the global object, so never call it as a method of the client.
    this.fetchImpl = (input, init) => fetchImpl.call(globalThis, input, init);
  }

  get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  put<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, options);
  }

  patch<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, options);
  }

  delete<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildURL(path, options.query);
    const timeout = options.timeout ?? this.timeout;
    const maxRetries = options.maxRetries ?? this.maxRetries;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': `lsupergen-sdk/${VERSION}`,
      ...this.defaultHeaders,
      ...options.headers,
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] ??= 'application/json';
      body = JSON.stringify(options.body);
    }

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const onAbort = () => controller.abort();
      options.signal?.addEventListener('abort', onAbort);

      let response: Response;
      try {
        response = await this.fetchImpl(url, { method, headers, body, signal: controller.signal });
      } catch (err) {
        if (options.signal?.aborted) throw err;
        const error = controller.signal.aborted
          ? new TimeoutError(timeout)
          : new ConnectionError({ cause: err });
        if (attempt < maxRetries) {
          await sleep(this.backoff(attempt));
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
      }

      if (response.ok) {
        return (await this.parseBody(response)) as T;
      }

      if (attempt < maxRetries && shouldRetry(response.status)) {
        await sleep(this.backoff(attempt, response.headers.get('retry-after')));
        continue;
      }

      const errorBody = await this.parseBody(response).catch(() => undefined);
      const message =
        errorBody && typeof errorBody === 'object' && 'message' in errorBody
          ? String((errorBody as { message: unknown }).message)
          : undefined;
      throw new APIError(response.status, errorBody, response.headers, message);
    }
  }

  private buildURL(path: string, query?: Record<string, QueryValue>): string {
    const url = new URL(`${this.baseURL}/${path.replace(/^\/+/, '')}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async parseBody(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!text) return undefined;
    const contentType = response.headers.get('content-type') ?? '';
    return contentType.includes('application/json') ? JSON.parse(text) : text;
  }

  private backoff(attempt: number, retryAfter?: string | null): number {
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 60) return seconds * 1000;
    const base = Math.min(500 * 2 ** attempt, 8000);
    return base * (0.75 + Math.random() * 0.25);
  }
}
