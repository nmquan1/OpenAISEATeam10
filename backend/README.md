# Market Maker backend

Node.js >=22, ESM, no runtime dependencies. Start from the repository root with `npm start`, or with `npm --prefix backend start`. The service loads the repository `.env`, binds `127.0.0.1:4173` by default and serves the frontend and API on the same origin.

```text
src/server.mjs          startup, env, port validation, shutdown
src/api/app.mjs         HTTP transport, security headers, static allowlist
src/api/http.mjs        JSON parsing, responses, HTTP errors
src/api/routers/        health, evaluate, recommend
src/agent/recommend.mjs provider transport, candidate validation/ranking
src/engine/index.js     deterministic single-SKU scenario engine
test/                   model, engine, provider and HTTP tests
```

`../contracts/model.js` is the shared input validator; the browser also loads the same engine through the explicit `/engine/index.js` static mapping. Keep the engine browser-compatible and free of credentials, provider calls or filesystem dependencies.

API routes are `GET /api/health`, `POST /api/evaluate` and `POST /api/recommend`. See [HTTP contract](../docs/api.md) for complete input, response, authentication and error details. The provider key is server-only. `MARKET_MAKER_API_TOKEN` protects API calls when configured, but the browser has no token flow; use it for headless clients or a gateway.

Run `npm run check` at the repository root for syntax checks, all tests and frontend build. This remains a local scenario application: no persistent database, tenant identity, Shopee writes or calibrated demand forecast. Public production deployment needs the controls listed in the [root README](../README.md).
