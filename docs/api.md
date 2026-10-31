# HTTP API v2

Fastify 5 + TypeScript serves the API. Open **http://localhost:4173/api/docs/** for Swagger UI and **Try it out**; `/api/docs/json` returns the generated OpenAPI document. Schemas and TypeScript types come from `contracts/model.ts` (TypeBox), including request examples and response schemas.

This MVP has one **shared workspace and no login**. Every caller can read the same saved runs and consumes the same daily AI allowance. CORS and Host checks control browser/network configuration; they are not user permissions.

## Routes

| Method | Path                    | Body / result                                                                                               |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`           | `{status, schema_version, mode, aiConfigured, modelConfigured}`; configuration flags contain no credentials |
| POST   | `/api/evaluate`         | `{input}` → deterministic evaluation; saves the complete input/result                                       |
| POST   | `/api/recommend`        | `{input, context}` → provider candidates ranked by the same engine; saves input/result/AI metadata          |
| POST   | `/api/history/validate` | `{csv}` → `{source:"user_reported", campaigns:[...]}`; no automatic forecast calibration                    |
| GET    | `/api/runs`             | `{runs:[...]}`; latest 50 shared runs, newest first                                                         |
| GET    | `/api/runs/:id`         | One saved run; UUID path parameter; missing ID returns 404                                                  |

POST bodies must be JSON and fit within **32 KiB including JSON escaping/overhead**. Validation rejects unknown fields, missing required fields, numeric strings and invalid integer/rate bounds. Fastify coercion, default insertion and removal of extra fields are disabled. Domain validation additionally checks traffic ordering, stock/basket constraints and response-curve consistency.

## Typed input

Use Swagger's complete examples or generate a request from the canonical defaults:

```sh
npx tsx -e "import {defaults} from './contracts/model.ts'; console.log(JSON.stringify({input:defaults}))" > /tmp/market-maker-input.json
curl http://127.0.0.1:4173/api/evaluate \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/market-maker-input.json
```

| Input group   | Fields / units                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `product`     | `name`; fixed-composition `lines[]` with SKU, quantity, unit price/cost, packaging and stock                              |
| `voucher`     | Discriminated `fixed` (`amount_dong`) or `percent` (`rate_bps`, `cap_dong`), plus `minimum_dong` and `seller_funding_bps` |
| `economics`   | Fee/tax/return/nonrefunded-fee rates; shipping, ads and return shipping costs; return resale share                        |
| `assumptions` | Visits, baseline CVR, low/base/high traffic factors and an explicit discount-response curve                               |
| `constraints` | Voucher budget and redemption quota                                                                                       |
| `objective`   | `safe`, `balanced` or `growth`                                                                                            |

Money is integer **đồng**; rates are integer **basis points** (`10000 = 100%`, `1500 = 15%`). `_dong`, `_bps` and `_units` suffixes identify units. Do not send the old flat v1 `%` input. The product is a declared basket with fixed quantities; the engine does not infer the distribution of different customer baskets.

Recommendation context is structured:

```json
{
  "seller_notes": "Ưu tiên lợi nhuận, giữ ngân sách đã nhập.",
  "history": {
    "source": "user_reported",
    "campaigns": [
      {
        "label": "Sale trước",
        "visits": 1000,
        "orders": 30,
        "revenue_dong": 8970000,
        "voucher_spend_dong": 300000
      }
    ]
  }
}
```

`context` is required on recommendation requests; an empty note is `{seller_notes:""}`. History is optional, contains at most 20 campaigns and cannot claim more orders than visits. The CSV route expects exactly `label,visits,orders,revenue_dong,voucher_spend_dong`, with explicit nonnegative integers, unique normalized labels and no missing numerical cells. See `data/history-template.csv`.

## Results and provenance

Evaluation returns `schema_version`, `engine_version`, `mode:"scenario_only"`, normalized `input`, ranked `strategies`, `recommended` and `limitations`. Each strategy includes its voucher, effective discount, low/base/high scenarios, base/worst profit and score. Scenario money uses `_dong`; results remain bounded by stock, quota and seller-funded budget. The declared response curve drives demand consistently for deterministic and AI-generated vouchers.

Recommendation also returns the provider's actual model, structured context, prompt version, provider request ID, token usage, rejected-candidate count, optional cost estimate and `decision_context`. History produces a transparent summary; `applied_to_forecast:false` makes clear that it has not trained or calibrated demand. Estimates are not provider invoices.

Saved runs contain `id`, `createdAt`, `kind`, `schemaVersion`, `input` and full `result`. Notes/history submitted for AI are included in the saved result. There is no private per-person history in this MVP.

## Limits and cancellation

- Evaluation: 60 requests/minute per connection IP, per process.
- Recommendation: 10 requests/minute per connection IP, per process; one active AI request per process/workspace.
- History reads/CSV validation: 120 requests/minute per connection IP, per process.
- `AI_DAILY_CALL_LIMIT`: 1–20 attempted AI calls across the shared workspace per UTC day. An accepted attempt consumes quota before provider work; provider failures and cancellations do not refund it.

The local JSON store serializes writes and replaces snapshots atomically; only one backend process may write a file. Supabase uses an atomic PostgreSQL quota function, so the shared daily counter also holds across backend instances. Minute limits and concurrent-request limits remain process-local. The server does not trust forwarded IP headers; a reverse proxy may make visitors share a connection IP.

Client disconnect forwards cancellation to the provider. Provider timeout is controlled by `OPENAI_TIMEOUT_MS`; cancellation cannot guarantee that the provider has not already billed work. SIGTERM/SIGINT stops accepting work and waits for active requests; a hosting platform can impose its own shorter shutdown deadline. A successful result is returned after saving; storage failure can therefore fail a request after provider work already occurred.

## Configuration and errors

`HOST`, `PORT`, `ALLOWED_HOSTS` and `ALLOWED_ORIGINS` configure binding and exact allowlists. Hosts omit scheme/port; origins include scheme and port where applicable. Allowed origins receive CORS headers and JSON preflight support. Requests without an Origin header still need an allowed Host.

AI requires server-only `OPENAI_API_KEY` and explicit `OPENAI_MODEL`. `RUN_STORE=local` uses `RUN_STORE_PATH`; `RUN_STORE=supabase` requires `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`. No frontend Supabase key, JWT or session is required. See [deployment](deployment.md).

Errors use `application/problem+json` with `status`, `detail`, `error` and `requestId`; `X-Request-Id` is also returned. Typical statuses: 400 malformed JSON; 403 Host/Origin denied; 404 missing route/run; 413 body too large; 415 unsupported media type; 422 schema/domain violation; 429 minute/concurrency/daily limit; 500 unexpected internal failure; 502 invalid/unavailable provider; 503 missing AI config or unavailable database; 504 provider timeout. Unexpected errors hide internal messages. Server logs redact credential headers and do not log request bodies/prompts.

Tests cover local HTTP behavior, mocked provider/database transport and cancellation. Live OpenAI, Supabase SQL/RLS and cloud hosting have **not** been verified by these tests.
