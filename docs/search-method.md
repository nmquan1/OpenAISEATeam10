# Deterministic voucher search and independent AI proposals

The earlier five-proposal grid is a comparison baseline, not an optimizer. It tries five preset percentages with one inherited cap and minimum; the dense reference also samples only predefined configurations. Neither explores every economic payout, and a percentage change can be economically identical after the cap. Calling `evaluateVouchers(...).recommended` for an individual AI proposal also credits retained baseline strategies, obscuring whether that proposal is actually good. A single LLM response proposes candidates; it does not conduct a feedback-driven policy search.

`backend/src/engine/search.ts` exports:

- `searchVouchers(input, { maxEvaluations?: 1000 })`: at most five distinct strategies, the recommended strategy, unique payout evaluation count, engine call count, elapsed milliseconds, search bounds, finest attempted local resolution, exhaustive-domain flag and evaluated payout trace.
- `evaluateCandidate(input, voucher)`: evaluates one voucher with the existing engine and selects its exact economic ID. It never substitutes the engine's retained winner.
- `voucherEconomicId(input, voucher)`: exact BigInt effective buyer discount and half-up seller-funded amount.
- `hybridSearchVouchers(input, independentlyGeneratedCandidates, options)`: merges the search results with up to five independently generated, schema-valid, funding-preserving AI candidates. It scores each candidate separately and reports accepted/rejected candidates and additional engine calls. It does not call a provider or alter the model's proposals.

## Search domain and algorithm

For the current fixed basket, every voucher collapses to one integer effective discount: `min(basket, fixed_amount)` or `min(basket, round_half_up(rate × basket), cap)`, provided the basket satisfies its minimum. With fixed seller funding, all other economics depend on that payout. Search therefore uses canonical fixed discounts with minimum zero, over `[0, min(basket_value, 1,000,000,000)]` VND. Existing current and moderated configurations are included by their effective payouts, as is zero. This is a search over editable voucher policies; it does not preserve the current voucher minimum as an immutable constraint. Ineligible current vouchers have payout zero, but a newly proposed policy may become eligible.

The engine computes every monetary amount, scenario, fee and score. Search does not replace response curves, extrapolate foreign datasets into VND, infer psychological headline effects, or change seller funding.

Small domains that fit the evaluation budget are exhaustively enumerated at one-dong resolution. Larger domains receive a full-range coarse sweep, response-curve knot neighborhoods, funding-capacity boundary neighborhoods, and multiresolution refinement around several high-scoring regions. Funding boundaries account for half-up seller-funded rounding. Integer order counts, fees and budgets make the objective discontinuous: this bounded heuristic is not a global optimizer.

`evaluation_count` counts distinct payouts scored, including retained baseline payouts. `engine_calls` counts calls to the existing engine, which internally evaluates its retained policies on each call. Default search uses at most 1,000 of either count; hybrid adds at most five calls. `resolution_dong` is the finest attempted local refinement step, not uniform coverage or an error bound. `exhaustive_integer_search` is true only when all feasible integer payouts have actually been scored. A single call reports `elapsed_ms`; p50/p95 performance requires repeated measurements by the benchmark harness.

Ranking uses engine score, then smaller discount, then stable ID. Since all retained baseline payouts enter the pool before exploration, search cannot score worse than the current engine baseline under identical assumptions. Hybrid cannot score worse than search. These are construction guarantees, not evidence of improved real-world profit or useful AI contribution. Zero discount is a valid choice.

## Independent evaluation

The current method-comparison reference uses a separately implemented, finite uniform 100-VND lattice across the same payout bounds, plus zero/current/moderated and maximum-discount options. It increases the stride for very large baskets to stay below 10,000 evaluations. It does not currently augment the lattice with response-curve or rounding boundaries. Such augmentation would be a future benchmark version, not a description of the frozen run. Each reference candidate is scored directly with the engine. Do not build the reference from search's evaluated payout trace, use search as its own gold label, or call a finite lattice a global optimum. Report signed score gaps as well as nonnegative regret: search may beat the finite reference.

For small baskets, independent brute-force enumeration of every integer payout checks exact winner and top-five agreement across objectives. Additional tests cover fixed funding, zero seller budget, zero funding, stock exhaustion, ineligible current vouchers, economic duplicates and malformed AI proposals. Larger-case comparisons remain heuristic search-quality evidence under explicit synthetic response assumptions. LLM-only, search-only and hybrid results must remain separate to establish whether AI contributes beyond deterministic optimization.

## Posthoc offer presentation experiment

`diverseOffers(input, strategies, limit = 5)` in `backend/src/engine/diversity.ts` preserves the best existing scored strategy and greedily selects alternatives whose effective buyer discounts differ from **every** previously selected offer by at least `max(1,000 VND, ceil(1% of basket value))`. It uses the existing score and deterministic tie-break order, returns at most five, and never fills remaining slots with near-duplicates. The threshold is a named product heuristic, not an empirically validated merchant preference.

This is an explicitly **posthoc** experiment motivated by observing consecutive one-dong payouts in the frozen search top five. It does not change search, the default strategy ranking, the frozen benchmark or any raw live report. Apply it to a wider pool of already scored search payouts; applying it only to five near-duplicates may correctly return one offer. Re-evaluating a recorded payout trace with the unchanged engine uses no model calls.

Spacing removes visually redundant discount variants but does not guarantee different scenario outcomes, commercial usefulness or profitability. In zero-budget/zero-conversion controls, widely spaced discounts can still have identical outcomes. Some alternatives may score below the winner or lose money; the UI must show their economics. The next product step is to validate the spacing and acceptable score tradeoff with merchant users, separately from measuring search quality. No held-out validation or causal improvement is claimed for this presentation policy.
