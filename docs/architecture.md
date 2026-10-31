# Market Maker architecture — MVP v2

## Runtime boundaries

```text
React/Vite browser
  → typed HTTP client
  → Fastify routes and JSON Schema validation
  → deterministic engine OR recommendation service
      → OpenAI transport (candidate inputs only)
      → deterministic engine (all scoring)
  → versioned run store
```

`contracts/model.ts` is the shared TypeBox/TypeScript contract. Frontend imports the contract, never a backend implementation. Vite builds its dependency graph without string rewriting. Responses are serialized by declared API schemas and checked by the frontend.

## Modules

- `engine/`: pure functions for fixed-basket economics and scenarios; exact integer intermediates, explicit per-order rounding, no network or storage.
- `agent/openai.ts`: bounded provider transport, timeout/cancellation, structured output and provider metadata.
- `agent/prompt.ts`: versioned instructions separating untrusted notes/history from fixed seller constraints.
- `agent/context.ts`: descriptive historical aggregates and explicit field-effect explanation; no automatic causal calibration.
- `agent/recommend.ts`: validated candidates plus retained baselines, then engine ranking.
- `history/`: CSV parsing, bounds, nonblank values and normalized duplicate campaign detection.
- `api/routers/`: HTTP schema, orchestration and persistence; business formulas remain in the engine.
- `api/plugins/transport.ts`: Host/Origin/CORS, per-source route rates, request IDs and error mapping.
- `store/`: immutable run snapshots, atomic daily attempt quota, local single-process adapter or optional Supabase adapter.

## MVP identity model

There is **no user authentication**, login, JWT, private account history or authorization. This is explicitly a shared workspace. Every connected caller can access workspace runs. Browser drafts remain local to each browser.

Supabase credentials, if configured, are database infrastructure credentials used by the server only. The service-role key must never appear in frontend variables. Supabase tables deny direct browser roles; server code accesses shared workspace data.

## Numerical policy

Input money is integer VND and percentages use integer basis points. The engine uses BigInt intermediates and serializes only checked safe numbers. Round monetary lines per order, then aggregate; this deliberately differs from rounding only the final campaign profit. Fees use seller entitlement and return losses use configured refund/resale assumptions.

Demand responds to effective discount through one explicit seller-defined curve on every code path. Both manual and AI comparison include no-voucher, measured and current vouchers. Funding-limited uplift is an assumption, not a calibrated consumer-behavior model.

## Persistence and rate policy

Local JSON writes use serialized mutations, atomic replacement and restrictive filesystem modes. This adapter is for one Node process; use the database adapter for multiple replicas. The Supabase SQL quota function increments a shared UTC daily attempt counter atomically; failures still consume attempts because a provider might already have charged them.

Short-term request rates and active request slots are process-local. Daily quota is shared across replicas when using Supabase. A call-count quota plus bounded output tokens limits exposure but is not an exact currency spending ceiling. Token-cost estimates require explicitly configured pricing and do not replace provider invoices.

## API and tests

Swagger UI: `/api/docs`; machine spec: `/api/docs/json`. Examples and response schemas are registered with routes. Automated tests use `node:test`/tsx and Fastify injection, plus real socket cancellation and Playwright browser tests against `frontend/dist`.

CI runs typecheck, lint, tests, build, offline candidate benchmark and real-browser smoke. Live model calls are opt-in and never required for pull requests. Deploy hook only runs when configured and targets the tested commit; successful hook acceptance is not proof the deployment became healthy.

## Deliberate limits

- Fixed composition baskets, aggregate fee/tax settings and expected returns; no verified complete platform rules or SKU-level profit allocation.
- Historical inputs are user-reported; validation cannot verify truth, eliminate overlapping attribution windows or establish causal uplift.
- No tenant isolation by user request; use local/private demo environments for nonpublic seller data.
- Supabase migrations, cloud rollouts and live provider behavior need credentials and external verification.
- No claimed production SLO, customer traction or measured profit uplift.

## Main integration on revamp

`contracts/fee-catalog.ts` preserves the incoming source snapshot. `marketplace.ts` defines optional fee inputs and breakdown; `engine/fees.ts` allocates discounts across units with integer arithmetic and handles item caps/order fees. Manual fees remain the default.

`contracts/portfolio.ts`, `engine/portfolio.ts` and `api/routers/strategy.ts` expose the separate heuristic portfolio planner. React presents it separately from the top-five income dashboards; it does not reuse traffic as a customer count or claim calibrated forecasting.

`scripts/research/run.mjs` loads the typed catalog through tsx. The scheduled research workflow installs lockfile dependencies, records candidate changes and never updates the catalog automatically. CI also runs its offline dry run.
