/** Base class for every error thrown by the SDK. */
export class LsupergenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LsupergenError';
  }
}

/** The API responded with a non-2xx status code. */
export class APIError extends LsupergenError {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Headers;

  constructor(status: number, body: unknown, headers: Headers, message?: string) {
    super(message ?? `Request failed with status ${status}`);
    this.name = 'APIError';
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

/** The request did not complete within the configured timeout. */
export class TimeoutError extends LsupergenError {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/** The request could not reach the server (DNS, connection reset, etc.). */
export class ConnectionError extends LsupergenError {
  constructor(options?: { cause?: unknown }) {
    super('Connection error', options);
    this.name = 'ConnectionError';
  }
}
