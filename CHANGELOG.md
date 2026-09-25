# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-09-25

### Changed

- **Breaking:** the default `baseURL` is now `https://agents-sdk.space/v1`, the live Lsupergen API
  (was `https://api.lsupergen.com`, which does not serve this API). Set `baseURL` or
  `LSUPERGEN_BASE_URL` to use another host.

## [0.1.1] - 2026-09-25

### Fixed

- Calling the client in browsers, Cloudflare Workers and Deno no longer fails with
  `ConnectionError` (cause: `TypeError: Illegal invocation`). The stored `fetch` is now always
  invoked with the global object as `this`. Workaround for 0.1.0: pass
  `fetch: (...args) => fetch(...args)`.

## [0.1.0] - 2026-09-25

### Added

- Initial release: `Lsupergen` client with `get`/`post`/`put`/`patch`/`delete`.
- Automatic retries with exponential backoff (honours `Retry-After`).
- Per-request timeouts and `AbortSignal` support.
- Typed errors: `LsupergenError`, `APIError`, `TimeoutError`, `ConnectionError`.
- Dual ESM + CommonJS build with TypeScript declarations.
