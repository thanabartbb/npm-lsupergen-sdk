# lsupergen-sdk

[![npm version](https://img.shields.io/npm/v/lsupergen-sdk.svg)](https://www.npmjs.com/package/lsupergen-sdk)
[![CI](https://github.com/thanabartbb/npm-lsupagen-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/thanabartbb/npm-lsupagen-sdk/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/lsupergen-sdk.svg)](./LICENSE)

TypeScript / JavaScript SDK for the Lsupergen API. Works in Node.js 18+, Bun, Deno and modern browsers.

- Fully typed, ships ESM + CommonJS
- Zero runtime dependencies (uses native `fetch`)
- Automatic retries with exponential backoff
- Timeouts and cancellation via `AbortSignal`

## Installation

```bash
npm install lsupergen-sdk
# or
pnpm add lsupergen-sdk
yarn add lsupergen-sdk
bun add lsupergen-sdk
```

## Quick start

```ts
import { Lsupergen } from 'lsupergen-sdk';

const client = new Lsupergen({
  apiKey: process.env.LSUPERGEN_API_KEY, // default: reads LSUPERGEN_API_KEY
});

const items = await client.get<{ id: string }[]>('/items', { query: { page: 1 } });
const created = await client.post('/items', { body: { name: 'hello' } });
```

CommonJS:

```js
const { Lsupergen } = require('lsupergen-sdk');
```

## Configuration

| Option           | Type                     | Default                                                         |
| ---------------- | ------------------------ | --------------------------------------------------------------- |
| `apiKey`         | `string`                 | `process.env.LSUPERGEN_API_KEY`                                 |
| `baseURL`        | `string`                 | `process.env.LSUPERGEN_BASE_URL` or `https://api.lsupergen.com` |
| `timeout`        | `number` (ms)            | `60000`                                                         |
| `maxRetries`     | `number`                 | `2`                                                             |
| `defaultHeaders` | `Record<string, string>` | `{}`                                                            |
| `fetch`          | `typeof fetch`           | `globalThis.fetch`                                              |

`timeout`, `maxRetries`, `headers` and `signal` can also be set per request:

```ts
const controller = new AbortController();
await client.get('/items', { timeout: 5_000, maxRetries: 0, signal: controller.signal });
```

## Error handling

```ts
import { APIError, TimeoutError, ConnectionError } from 'lsupergen-sdk';

try {
  await client.get('/items/unknown');
} catch (err) {
  if (err instanceof APIError) {
    console.error(err.status, err.body);
  } else if (err instanceof TimeoutError) {
    // request took too long
  } else if (err instanceof ConnectionError) {
    // network problem
  }
}
```

Requests that fail with `408`, `409`, `429`, `5xx` or a network error are retried automatically.

## Development

```bash
npm install
npm run build        # bundle to dist/ (ESM + CJS + .d.ts)
npm test             # run tests with Vitest
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run check:exports # verify package exports (attw + publint)
```

## Releasing

1. Bump the version: `npm version patch|minor|major` (also update `src/version.ts` and `CHANGELOG.md`).
2. Push the tag: `git push --follow-tags`.
3. The **Release** GitHub Action publishes to npm with provenance (requires the `NPM_TOKEN` repository secret).

## License

[MIT](./LICENSE)
