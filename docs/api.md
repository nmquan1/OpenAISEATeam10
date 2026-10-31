# Market Maker HTTP contract v1

The Node server binds `127.0.0.1:4173` by default. Its route modules live in `backend/src/api/routers/`; `backend/src/api/app.mjs` applies transport rules, and `contracts/model.js` is the shared browser/engine/API input validator. The static `dist/` export has no HTTP API.

## Routes

| Method | Path | Request | Success |
|---|---|---|---|
| GET | `/api/health` | No body | `{status:"ok", contract:"market-maker.v1", mode:"scenario_only"}` |
| POST | `/api/evaluate` | `{input: Input}` | Engine result: normalized input, three ranked strategies, recommended strategy, eligibility and assumptions |
| POST | `/api/recommend` | `{input: Input, context?: string}` | Provider/model, ranked candidates, recommended candidate and limitations |

POST requires `Content-Type: application/json`. The body limit is 32 KiB in bytes. Unknown top-level and input fields are rejected; HTTP requests must supply every `Input` field. The internal engine may accept a partial input and fill defaults for local scenario exploration; that convenience does not relax the HTTP contract.

## Input

Money is integer VND. Percentages use **percent units**, so `15` means 15%, not 15 basis points. This differs from Margin Guard's integer-bps contracts; passing either API's objects directly to the other is unsupported.

| Fields | Type and bounds |
|---|---|
| `name`, `code` | Nonblank strings, at most 100 / 30 characters |
| `price` | Positive integer VND, at most 1,000,000,000 |
| `cost`, `cap`, `minimum`, `budget` | Integer VND, 0–1,000,000,000 |
| `stock`, `traffic`, `quota` | Integers, 0–1,000,000 |
| `fee`, `cvr` | Numbers, 0–100 (%) |
| `low`, `base`, `high` | Traffic multipliers, 0–100; `low <= base <= high` |
| `uplift` | Relative CVR uplift (%), 0–1,000 |
| `type` | `fixed` or `percent` |
| `value` | Fixed: integer VND, 0–1,000,000,000; percent: number, 0–100 |
| `risk` | `safe`, `balanced`, `growth` |
| `scope` | `product` or `shop`; both still simulate one SKU per order |
| `start`, `end` | Valid calendar wall-clock strings `YYYY-MM-DDTHH:mm`, Asia/Ho_Chi_Minh; end after start |

`context` is optional text of at most 10,000 characters. It helps candidate generation and cannot override typed costs, budget or stock. The UI currently caps context at 4,000 characters. Campaign name/code/scope/time are metadata; neither route publishes or schedules a Shopee campaign.

A complete example can be generated from the contract's defaults:

```sh
node --input-type=module -e "import {defaults} from './contracts/model.js'; console.log(JSON.stringify({input:defaults}))" > /tmp/market-maker-request.json
curl -sS http://127.0.0.1:4173/api/evaluate \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/market-maker-request.json
```

Each strategy contains `discount`, three `scenarios` (`low`, `base`, `high`), `worst`, `expected` and `score`. A scenario contains visits, orders, redemptions, spend, revenue, rounded profit, stockout and exhaustion flags. `expected` is the base scenario profit, not a statistical expectation. Safe ranks by worst profit; balanced by 70% base profit + 30% worst profit; growth by base revenue.

Conversion counts floor exact decimal rate arithmetic, with promotional conversion capped at visits. `stockout` means positive demand after voucher funding limits reaches available stock; `exhausted` means voucher demand within available stock exceeds quota or affordable redemptions. A resource warning is not triggered solely by demand that another resource already prevents serving.

Recommendation adds no-voucher and current-voucher baselines to 1–5 provider candidates, validates them, deduplicates and ranks through the same engine. It does not return a calibrated demand forecast or run a multi-agent roundtable.

## Errors and access

Errors use `application/problem+json`, with `type`, `title`, `status`, `detail`, `instance`, `requestId` and an `error` string retained for the current UI. `X-Request-Id` is returned on responses. Unexpected server errors expose a generic message.

| Status | Meaning |
|---|---|
| 400 | Malformed JSON |
| 401 | Missing/invalid bearer token when configured |
| 403 | Unapproved Host or Origin |
| 404 | Unknown route or static file |
| 405 | Wrong method; see `Allow` |
| 413 | Request exceeds body limit |
| 415 | POST does not contain JSON |
| 422 | Request violates the data model |
| 429 | Request rate or AI concurrency limit; see `Retry-After` |
| 500 | Unexpected internal failure |
| 502 | Provider unavailable, rejected request or invalid candidate response |
| 503 | AI credentials are not configured |
| 504 | AI request timed out |

The server accepts localhost/127.0.0.1 Host and same-origin browser requests on its listening port. It does not trust forwarded headers. It currently allows 60 POST requests per minute **per process**, shared by all callers, and one concurrent recommendation per app instance. These are local safeguards, not distributed quotas.

`MARKET_MAKER_API_TOKEN`, when set, requires `Authorization: Bearer <token>` on APIs except health. The browser UI does not supply this server-side token, so enabling it requires an authenticated gateway or separate API client. Never embed the token or OpenAI key in browser code. Static serving allowlists the HTML, frontend JS/CSS, Markdown docs and two shared browser modules: `/engine/index.js` maps to `backend/src/engine/index.js`, and `/contracts/model.js` maps to `contracts/model.js`. Other backend source, `.env`, `.git` and data files are not static assets.

## Deployment boundary

`npm start` and `npm run dev` from the repo root delegate to the backend workspace and run the same local Node service, with graceful shutdown. `npm --prefix backend start` runs the same entrypoint; env loading and static paths resolve from the repository, so they do not depend on the caller working directory. The frontend and API share one origin on port 4173; no frontend development proxy is needed. Request headers/body reads have timeouts; provider calls use `OPENAI_TIMEOUT_MS`. Security headers include a same-origin script policy; the current chart needs inline styles.

This stage is not a public multi-tenant production service. Public hosting still needs an explicit authenticated gateway/domain policy and TLS, tenant authorization, durable configuration/results, audit trails, distributed request/cost quotas, monitoring and backup/recovery. Current storage is the user's exported JSON, and the financial engine remains a scenario-only single-SKU model with aggregate fees. Deploying the static UI alone cannot enable AI.
