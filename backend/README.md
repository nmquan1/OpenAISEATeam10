# Market Maker backend

Fastify 5, TypeScript, TypeBox contracts and Swagger UI. The app uses one shared workspace with no login, sessions or per-person permissions.

```sh
# Repository root, Node.js >=22
npm ci
cp .env.example .env
npm run dev
```

The development command starts Vite at `http://localhost:5173` and the API at `http://localhost:4173`. Open `http://localhost:4173/api/docs/` to try typed requests; `/api/docs/json` exports OpenAPI. For the built app, run `npm run build` then `npm start`. `npm --prefix backend start` starts the same backend and serves `frontend/dist` when built.

```text
src/server.ts             env, binding, store selection, shutdown
src/api/app.ts            Fastify composition, Swagger, built frontend assets
src/api/routers/          health, evaluate, recommend, shared runs, CSV history
src/api/plugins/          Host/Origin, CORS, per-IP limits, errors
src/engine/               pure basket scenario engine
src/agent/                context summary, prompt, provider transport/ranking
src/history/              strict aggregate CSV validation
src/store/                atomic JSON store, Supabase REST adapter and SQL
test/                    schema, engine, provider, HTTP, CSV and store tests
```

`contracts/model.ts` supplies request/response schemas and TypeScript types. Schema validation does not coerce input or silently discard unknown properties. Engine invariants check relationships that simple field schemas cannot express. Route handlers call services and persist versioned results; they do not implement financial arithmetic.

## Configuration

| Setting                                                         | Behavior                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| `HOST`, `PORT`                                                  | Default `127.0.0.1:4173`; public hosts are supported without login |
| `ALLOWED_HOSTS`                                                 | Comma-separated exact hostnames, without scheme/port               |
| `ALLOWED_ORIGINS`                                               | Comma-separated complete frontend origins; explicit CORS allowlist |
| `OPENAI_API_KEY`, `OPENAI_MODEL`                                | Both required for AI; model has no silent default                  |
| `OPENAI_TIMEOUT_MS`                                             | Provider timeout, default 60000; bounded to 120000                 |
| `OPENAI_MAX_OUTPUT_TOKENS`                                      | Provider output budget; see `.env.example`                         |
| `OPENAI_INPUT_USD_PER_MILLION`, `OPENAI_OUTPUT_USD_PER_MILLION` | Optional cost-estimate rates; not an invoice                       |
| `AI_DAILY_CALL_LIMIT`                                           | Shared attempted AI calls per UTC day, 1–20                        |
| `RUN_STORE`                                                     | `local` by default; `supabase` enables the database-only adapter   |
| `RUN_STORE_PATH`                                                | Local snapshot, default `.local/workspace-runs.json`               |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                     | Server-only cloud database connection; unused in local mode        |

The service-role credential must never use a `VITE_` prefix or be sent to the frontend. Supabase is used as a database; the app does not use Supabase Auth. All visitors share history and AI allowance. Store only data intended for that shared workspace.

## Persistence and limits

The local store uses mode-0600 snapshots, a mode-0700 directory, serialized mutation and atomic rename. It persists successful evaluation/recommendation inputs, complete results and the daily AI counter. It supports one backend writer process per file; use a persistent disk for restart durability. The v2 shared snapshot is separate from old experimental per-person snapshots; incompatible formats are rejected rather than silently exposed.

For durable cloud storage, apply `src/store/supabase.sql` to a fresh Supabase project, set `RUN_STORE=supabase` and configure the server URL/service-role key. Tables have RLS enabled with no anon/authenticated access; only the server's service role can access shared data and execute the quota function. The database counter is atomic across instances; per-IP minute limits and one active AI request are still local to each process.

Provider calls receive an AbortSignal when the browser disconnects. SIGTERM/SIGINT drains requests; hosting shutdown limits can still interrupt them. Failed/canceled accepted AI attempts remain counted to bound repeated spending. Run persistence happens before returning success; storage failure after provider completion can still incur provider cost.

## Validation

`npm run check` from the root runs TypeScript, ESLint, tests and frontend build. `npm --prefix backend test` runs backend tests. Browser flows use `npm run test:e2e` from the root. Tests use stub transports for OpenAI/Supabase; live credentials, SQL application and cloud deployment have not been validated here.

[HTTP reference](../docs/api.md) · [deployment instructions](../docs/deployment.md)
