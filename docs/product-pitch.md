# Market Maker — Product brief & pitching source

> Updated: 2026-10-31. MVP migration on `revamp`.
> This document distinguishes implemented behavior, unverified assumptions and future work. Local automated tests do not prove commercial traction, forecast accuracy or cloud production readiness.

## 1. One-line pitch

**Market Maker helps online sellers compare voucher strategies before a sale campaign, exposing the trade-off between sales, profit, stock and promotional budget.**

Vietnamese: **Market Maker giúp người bán chọn voucher có cơ sở trước ngày sale, bằng cách kiểm tra lợi nhuận và giới hạn vận hành của từng phương án.**

## 2. The problem

A seller can describe a discount quickly: “15% off, capped at 50k.” Knowing whether it is sensible is harder. The answer depends on basket value, product costs, fees, shipping, ad spend, returns, stock, funding and how demand responds.

The seller must make decisions under uncertainty:

- A larger discount can increase orders while reducing profit.
- Minimum spend qualifies against a basket; an isolated SKU can give a misleading picture.
- Voucher budget or quota can run out before demand does.
- More orders can exceed stock or require a different basket composition.
- Historical orders alone do not establish that a voucher caused growth.
- An AI suggestion without a reproducible calculation is hard to trust.

These are product hypotheses and domain motivations, not quantified customer-research findings. We have not established how many sellers experience each problem or how much money the product saves.

## 3. Target users and jobs to be done

Primary hypothesis: small online sellers preparing a promotion and currently comparing options manually.

Secondary hypotheses: ecommerce operators managing campaigns and agencies helping merchants prepare plans.

Job: “Before I choose a voucher, show me what it could do to my profit and which assumptions would make it a bad choice.”

The first user should be able to enter a basket, adjust costs and assumptions, compare scenarios, choose a voucher and export a reviewable plan without writing code.

## 4. Current value proposition

1. **Transparent economics:** all candidate vouchers are evaluated by the same deterministic engine.
2. **Explicit assumptions:** visits, baseline conversion and discount-response curve remain visible seller inputs.
3. **Operational constraints:** stock, voucher quota and seller budget bound the result.
4. **AI-assisted exploration:** OpenAI can suggest additional voucher inputs using seller context; the engine determines the ranking.
5. **Reviewable decisions:** results include schema/engine versions, input snapshots, limitations and recommendation metadata.
6. **Developer accessibility:** typed schemas, Swagger “Try it out”, fixtures and browser tests make the MVP easier to understand and extend.

## 5. Product journey

1. Enter one fixed basket containing one or several SKU lines and quantity per line.
2. Set selling price, cost, packaging and stock for each SKU.
3. Set fee/tax rates, shipping, ads and return assumptions for the order.
4. Configure fixed or percentage voucher, cap, minimum spend and seller funding share.
5. Set visits, baseline CVR, low/base/high traffic and response curve to discount.
6. Choose objective: cautious profit, balanced profit, or revenue growth.
7. Compare no-voucher, moderated voucher and current voucher across scenarios.
8. Optionally add seller notes and historical campaign aggregates, then request AI candidates.
9. Inspect up to five top-ranked strategies. Select a strategy to open its interactive revenue/profit/orders dashboard, change low/base/high scenarios, and inspect voucher budget and quota usage.
10. Apply the selected voucher to the form, export the plan or revisit saved runs. The complete engine result remains in the export for provenance, including the no-voucher baseline even when it is outside the displayed top five.

## 6. What the MVP models

### Basket and money

- One **fixed basket composition** per simulation, potentially containing several SKU lines.
- The order capacity is limited by the tightest SKU stock after accounting for quantity per basket.
- Voucher qualification uses basket gross value.
- Fixed and percentage vouchers have different typed fields; percentages use basis points.
- Money uses integer VND, with BigInt intermediates and a documented per-order rounding convention.
- Seller funding controls seller voucher expense; buyer discount controls the response-curve input.
- Fees, tax, packaging, shipping, ads and expected return loss are explicit inputs.

### Demand and scenario assumptions

- A response curve maps effective discount to a conversion multiplier.
- The same effective voucher receives the same demand treatment in manual and AI-generated paths.
- Low/base/high are scenarios, not a probability distribution.
- The model remains `scenario_only`: it is not calibrated against real seller outcomes.
- Traffic and conversion assumptions are not silently replaced by AI or historical text.

### Important limitations

- A fixed basket is not a distribution of real multi-item carts.
- Aggregate fee/tax parameters do not reproduce every platform fee rule or category programme.
- The model is not an accounting ledger, tax calculator or official Shopee settlement tool.
- Expected return modeling uses user assumptions rather than observed return cohorts.
- Voucher timing, customer eligibility, stacking, buyer-level limits and platform execution are not fully modeled.
- Recommendations are best among evaluated candidates under entered assumptions, not globally optimal offers.

## 7. How AI makes a recommendation

### What OpenAI sees

The backend sends a validated snapshot containing:

- Basket prices/costs/stock and order economics.
- Current voucher and fixed seller-funding policy.
- Visits, conversion and response-curve assumptions.
- Budget, quota and selected objective.
- Seller notes, for example customer segment or preference for lower-risk promotions.
- Optional historical campaign aggregates: campaign label, visits, orders, revenue and voucher spend.
- A derived historical summary such as weighted observed CVR and average revenue per order when denominators exist.

### What history means

History is **user-reported observational evidence**. CSV validation checks structure and basic consistency, not whether the records are true or causally comparable.

Observed CVR is computed from total orders divided by total visits, not an unweighted average of campaign percentages. Missing history is explicit; absent numbers are not invented.

Campaigns can differ in season, product mix, advertising, attribution window and customer segment. Therefore observed differences do not establish voucher elasticity or incremental sales.

### What user input changes

| Input                                    | Direct effect                            |
| ---------------------------------------- | ---------------------------------------- |
| Prices, costs, fee/tax and return inputs | Per-order profit calculation             |
| Stock, quota and budget                  | Feasible orders and voucher usage        |
| Visits, CVR and discount-response curve  | Scenario demand                          |
| Objective                                | Ranking of computed outcomes             |
| Seller notes and history                 | Which voucher candidates OpenAI proposes |

Seller notes/history **do not automatically update demand, price, cost, stock, quota or budget**. If a user decides historical evidence justifies different assumptions, the user changes those typed assumptions explicitly.

### The decision pipeline

```text
Validated user inputs + optional historical context
    → OpenAI generates voucher inputs (strict structured output)
    → runtime schema and seller-funding checks
    → valid candidates + no-voucher/measured/current baselines
    → deterministic engine computes scenarios using unchanged assumptions
    → selected objective ranks results
    → UI displays results, assumptions and decision context
```

The LLM does not calculate profit or choose an unchecked winner. Invalid individual candidates are discarded and counted; if none are valid, the API returns an explicit error.

### AI configuration and evidence

- OpenAI API key and model are empty placeholders until the owner configures them.
- No paid model calls are required for normal tests or CI.
- A fixture evaluation compares candidate scores with deterministic baselines and a small voucher grid.
- Fixture evaluations validate software behavior; they do not demonstrate actual model quality or incremental business benefit.
- Live provider evaluation and seller outcome studies are still needed.

## 8. Structured data and auditability

The shared TypeBox contracts define request and response types, numeric limits and schema versions. Product, voucher, economics, assumptions, constraints and objective have separate explicit structures.

Each saved evaluation records the input snapshot, result, workspace, timestamp and schema version. Engine version is embedded in results.

AI recommendations also record configured/returned model identity, prompt version, provider request ID, token usage, rejected-candidate count and how context was used. Cost is an estimate only when pricing inputs are configured; otherwise it is unknown rather than fabricated.

Local mode persists runs in a protected JSON file for a single development process. Optional Supabase stores cloud runs for one shared workspace using a server-only service credential and an atomic daily request quota. There is no user authentication or private per-user history in this MVP. Hosted behavior must be verified against a provisioned project before public use.

## 9. Architecture and technology choices

| Layer             | Choice                                             | Purpose                                                              |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| Contracts         | TypeScript + TypeBox/JSON Schema                   | Shared typed validation and API documentation                        |
| Domain            | Pure TypeScript engine with integer arithmetic     | Reproducible scenario economics                                      |
| API               | Fastify + Swagger UI                               | Typed routes and interactive API testing                             |
| AI                | Isolated OpenAI transport + recommendation service | Replaceable provider, stable decision boundary                       |
| Frontend          | React + Vite                                       | Readable components, explicit state and build graph                  |
| Cloud data        | Optional Supabase Postgres                         | Server-only storage for one shared workspace; no user authentication |
| Local persistence | Atomic JSON store                                  | No external credentials needed for local evaluation                  |
| Tests             | node:test/tsx + Fastify inject + Playwright        | Domain, API and real-browser regression checks                       |
| Quality/CI        | TypeScript, ESLint, Prettier, GitHub Actions       | Repeatable checks before release                                     |

Repository: `contracts/`, `backend/src/{engine,agent,api,store,history}`, `backend/test/`, `frontend/src/`, `e2e/`, `docs/`, `data/`, `scripts/`.

The app is a modular monolith. It does not need separate microservices to validate the MVP hypothesis.

## 10. Differentiation hypotheses

- Against spreadsheets: a reusable, explicit model with scenario comparisons and input validation.
- Against generic AI chat: the model proposes inputs, while a deterministic engine verifies the economics.
- Against a platform voucher form: the product explores trade-offs before a seller commits to a configuration.

These are positioning hypotheses, not a verified competitor benchmark. Do not claim unique features, market leadership or a defensible moat without research.

## 11. Business-model hypotheses

Possible models to test:

- Free scenario calculator with paid saved workspaces and controlled AI usage.
- Merchant subscription for planning, history and collaboration.
- Agency/team subscription covering several shops.

No pricing, willingness-to-pay, CAC, LTV, market size or revenue has been validated in this repository. Pricing experiments should measure willingness to pay after the user completes a useful planning task.

## 12. Metrics for MVP validation

- Activation: proportion of new users who complete their first valid comparison.
- Time to first useful plan: time from opening the app to selecting/exporting a strategy.
- Comprehension: whether users can explain the top recommendation and its assumptions.
- Reuse: proportion returning to plan another campaign.
- Operational quality: errors, latency and failed exports.
- AI utility: valid-candidate rate, added score over retained baseline, cost and user acceptance.
- Outcome study: after an agreed experiment, compare observed outcomes against forecast intervals and treatment/control profit.

Engine score improvement is not proof of real-world profit uplift. Track both separately.

## 13. Suggested 10-slide deck

1. **Problem:** sellers must choose discounts without seeing the full profit trade-off.
2. **User:** the seller/operator preparing the next campaign; include a real interview quote only when collected.
3. **Solution:** input → compare → inspect assumptions → select/export.
4. **Demo:** three scenarios, constrained budget and a visible strategy change.
5. **How it works:** shared data model + deterministic engine + bounded AI candidates.
6. **Why trustworthy:** visible assumptions, exact money convention, retained baselines and saved inputs.
7. **Differentiation:** comparison with current spreadsheets, generic AI and campaign setup workflow.
8. **Validation:** show actual interviews/tests/pilots; currently label software tests and research plans accurately.
9. **Business model and roadmap:** clearly label proposed pricing and future capabilities.
10. **Ask:** access to pilot sellers, anonymized campaign aggregates and feedback on planning decisions.

## 14. Three-minute demonstration script

1. Open the app with sample data and explain that the numbers are illustrative.
2. Show the fixed basket, budget and conversion assumptions.
3. Compare strategies and toggle low/base/high traffic.
4. Reduce budget or stock and show the constrained result change.
5. Open `/api/docs`, run the evaluate example and show the same typed result.
6. With credentials configured, add historical aggregates and seller notes, then request AI candidates; otherwise explicitly say AI is not configured.
7. Show the context explanation: history influenced candidate selection, not an automatic forecast override.
8. Select/apply a candidate and export the selected plan.

Do not claim a successful live AI demonstration when only fixtures have run.

## 15. Current work versus future work

### Implemented in the migration branch, subject to final integration checks

- Typed nested v2 contracts, fixed multi-SKU basket model and exact money intermediates.
- Shared voucher-response curve, explicit expenses/returns and baseline-preserving ranking.
- Fastify routes, interactive Swagger UI and request/response schemas.
- OpenAI adapter, cancellation/error handling and recommendation provenance.
- React UI with candidate selection/apply/export and validated local draft import.
- Historical aggregate CSV validation.
- Local audit store and optional Supabase database configuration (no user login).
- Automated domain/API tests and browser regression setup.

### Requires external verification

- Live OpenAI generation with the chosen account/model.
- Supabase migration, server-only database access and quota behavior in a provisioned project.
- Cloud deployment with actual domains/secrets and free-tier limits.
- Model assumptions against real seller data.
- Customer usefulness and willingness to pay.

### Future product work

- Richer dataset manifests, cohort/attribution validation and demand calibration.
- Basket distributions and platform-specific versioned fee schedules.
- Controlled experiments to measure voucher framing and incremental profit.
- Seller collaboration, review/approval workflow and supported platform integrations.

## 16. Risks and honest answers

**Does it guarantee higher profit?** No. It compares outcomes under explicit assumptions; validation requires observed seller outcomes.

**Is the AI forecasting sales?** No. It proposes voucher configurations; the engine computes scenario results from user assumptions.

**Is history automatically learned?** No. Uploaded aggregate history informs candidate proposals; calibration is future work.

**Can it publish a voucher to Shopee?** No. Current workflow ends with review/export, not platform execution.

**Can it run without an API key?** Yes for deterministic comparison and local development; live AI remains disabled.

**Is cloud hosting free forever?** No such guarantee; free tiers have quotas, sleep/pause behavior and can change.

**Is it production-ready for many merchants?** Not established. Hosted storage, operations and real-data behavior still require verification.

## 17. Evidence sources inside this repository

- `contracts/model.ts`: executable request/response contracts.
- `contracts/fixtures.ts`: sample payloads.
- `backend/src/engine/index.ts`: deterministic scenario engine.
- `backend/src/agent/`: provider adapter, prompt and recommendation orchestration.
- `backend/src/history/validate.ts`: supported historical CSV ingestion.
- `backend/src/store/supabase.sql`: cloud storage and quota policies.
- `backend/test/` and `e2e/`: automated checks.
- `docs/data-contract.md`: units, history semantics and limitations.
- `docs/research.md`: research references; verify current platform rules before commercial claims.

## 18. Suggested closing statement

“Market Maker turns voucher selection into a decision a seller can inspect: clear inputs, visible assumptions, comparable scenarios and a plan they can review. Our next milestone is proving that this workflow helps real sellers make better campaign decisions.”
