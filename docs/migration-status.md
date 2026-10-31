# Critique remediation — MVP v2

Status refers to code and local tests, not production deployment. Authentication was explicitly removed at the user's request.

| Critique area                            | Resolution                                                             | Verification / remaining boundary                                   |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Manual vs AI demand mismatch             | One response curve keyed by effective basket discount                  | Regression compares equivalent vouchers across paths                |
| Tiny voucher receives full uplift        | Interpolated explicit discount-response curve                          | Zero/tiny-discount and low-volume regressions                       |
| Floating-point money                     | BigInt intermediates and per-order monetary rounding                   | Exact ratios, negative amounts and safe bounds tested               |
| CVR organic/redeem mismatch              | Rational calculations and one combined floor                           | 29% and 0.5+0.5 conversion regressions                              |
| False stockout                           | Check actual funded/constrained demand                                 | Zero-budget/quota stockout regression                               |
| Missing basket/cost inputs               | Fixed multi-SKU basket, packaging/ship/ads/fees/tax/returns/funding    | No basket distribution or official fee schedule claim               |
| Hidden assumptions                       | Explicit response curve, scenario_only, versioned input snapshots      | No learned calibration or real outcome validation                   |
| Missing CSV ingestion                    | Strict aggregate CSV parser, blanks and normalized duplicates rejected | Cannot verify truthful attribution or causal effect                 |
| AI drops baseline/measured               | All engine baselines retained in candidate ranking                     | Score never below retained baseline in fixture tests                |
| Provider/schema mismatch                 | Shared voucher schema for strict output and runtime checks             | Live model compatibility requires account/model                     |
| Entire batch fails for one bad candidate | Invalid candidates counted and discarded                               | All invalid returns explicit error                                  |
| No AI eval                               | Offline baseline/grid comparison and adversarial fixture assertions    | Not evidence of live model quality or commercial lift               |
| No provenance/usage                      | Prompt/model/request ID/usage/context/version metadata                 | Unknown usage/cost remains null                                     |
| Fake roundtable                          | Removed from new React interface                                       | AI is candidate generation, not multi-agent debate                  |
| Deprecated hardcoded model               | No hidden model default; key and model placeholders                    | User must select an enabled compatible model                        |
| Auth/token broken                        | All user authentication removed by explicit user request               | Shared workspace; no private per-user data                          |
| Shared eval/AI rate counter              | Separate per-IP route counters                                         | Proxy source-IP semantics documented                                |
| Quota reset/multi-replica                | Persistent local counter or atomic Supabase RPC                        | Local single-process; short-window slots remain process-local       |
| Client disconnect ignored                | AbortSignal propagated through fetch and body parsing                  | Real socket/API regression and provider abort test                  |
| Body timeout misclassified               | Explicit 504 across headers/body                                       | Regression test                                                     |
| No API docs/response contract            | Fastify+TypeBox+Swagger Try it out                                     | Spec tests and browser Swagger smoke                                |
| FE imports BE engine                     | Frontend uses HTTP; shared contracts only                              | Vite artifact browser test                                          |
| Monolithic responsibilities              | Routes, transport, service, provider, context, engine, store modules   | No generic infrastructure added without use                         |
| Minified source/type ambiguity           | Readable TypeScript/React, ESLint and Prettier                         | Typecheck/lint/format in CI                                         |
| Misleading expected field                | base_profit_dong and worst_profit_dong                                 | Typed response/UI                                                   |
| Wrong AI export                          | Export actual selected strategy+result+context                         | Browser download assertion                                          |
| No apply/draft/import                    | Apply candidate, immediate validated draft, JSON import                | Browser apply/reload/export checks                                  |
| Focus/live-region problems               | Stable React controls and concise status region                        | Keyboard focus browser assertion                                    |
| AI shown without config                  | Readiness flags and disabled button                                    | Browser no-key regression                                           |
| Localhost-only config                    | Configurable host/origins/API base; Render scaffold                    | No live cloud rollout performed                                     |
| Shutdown cuts AI                         | Graceful server close, provider bounded timeout                        | Live rolling deploy not verified                                    |
| Poor logs                                | Fastify request IDs/access duration and safe provider errors           | No hosted alerting/SLO provisioned                                  |
| No browser CI                            | Playwright Chromium against production Vite build                      | Report/traces as CI artifacts                                       |
| Fragile import rewriting                 | Vite build graph                                                       | Browser artifact check                                              |
| No release/rollback scaffold             | Dockerfile, Render blueprint, tested-commit hook, deployment runbook   | Credentials required; rollout/rollback must be exercised externally |
