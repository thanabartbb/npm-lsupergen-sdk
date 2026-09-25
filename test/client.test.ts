import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  APIError,
  ConnectionError,
  Lsupergen,
  LsupergenError,
  TimeoutError,
  VERSION,
} from '../src';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function createClient(fetchMock: typeof fetch, options = {}) {
  return new Lsupergen({
    apiKey: 'test-key',
    baseURL: 'https://example.test/v1/',
    fetch: fetchMock,
    ...options,
  });
}

describe('Lsupergen', () => {
  it('throws when no API key is available', () => {
    vi.stubEnv('LSUPERGEN_API_KEY', '');
    expect(() => new Lsupergen()).toThrow(LsupergenError);
    vi.unstubAllEnvs();
  });

  it('reads the API key from the environment', () => {
    vi.stubEnv('LSUPERGEN_API_KEY', 'env-key');
    expect(new Lsupergen().apiKey).toBe('env-key');
    vi.unstubAllEnvs();
  });

  it('sends auth headers, query params and a JSON body', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    const client = createClient(fetchMock);

    const result = await client.post<{ ok: boolean }>('/items', {
      query: { page: 2, skip: undefined },
      body: { name: 'hello' },
    });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.test/v1/items?page=2');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"hello"}');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['User-Agent']).toBe(`lsupergen-sdk/${VERSION}`);
  });

  it('returns undefined for 204 responses', async () => {
    const client = createClient(vi.fn(async () => new Response(null, { status: 204 })));
    await expect(client.delete('/items/1')).resolves.toBeUndefined();
  });

  it('throws APIError with status and body on 4xx', async () => {
    const client = createClient(vi.fn(async () => jsonResponse({ message: 'Not found' }, 404)));
    const error = await client.get('/missing').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toMatchObject({
      status: 404,
      message: 'Not found',
      body: { message: 'Not found' },
    });
  });

  it('retries on 5xx and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = createClient(fetchMock);
    await expect(client.get('/flaky')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 400));
    const client = createClient(fetchMock);
    await expect(client.get('/bad')).rejects.toBeInstanceOf(APIError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('wraps network failures in ConnectionError', async () => {
    const client = createClient(
      vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
      {
        maxRetries: 0,
      },
    );
    await expect(client.get('/down')).rejects.toBeInstanceOf(ConnectionError);
  });

  it('throws TimeoutError when the request takes too long', async () => {
    const slowFetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = createClient(slowFetch as unknown as typeof fetch, {
      timeout: 10,
      maxRetries: 0,
    });
    await expect(client.get('/slow')).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe('VERSION', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(VERSION).toBe(pkg.version);
  });
});
