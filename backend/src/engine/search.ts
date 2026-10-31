import { Value } from '@sinclair/typebox/value';
import {
  parseInput,
  VoucherSchema,
  type EvaluationInput,
  type Strategy,
  type Voucher,
} from '../../../contracts/model.ts';
import { evaluate, evaluateVouchers, roundRatio } from './index.ts';

export interface SearchOptions {
  maxEvaluations?: number;
}
export const SEARCH_VERSION = 'fixed-basket-multiresolution.v1';
const rank = (a: Strategy, b: Strategy) =>
  b.score - a.score || a.discount_dong - b.discount_dong || a.id.localeCompare(b.id);
const grossValue = (input: EvaluationInput) =>
  input.product.lines.reduce(
    (sum, line) => sum + BigInt(line.quantity) * BigInt(line.unit_price_dong),
    0n,
  );
const minimum = (...values: bigint[]) => values.reduce((a, b) => (a < b ? a : b));
/** Exact engine ID; never substitute the best retained strategy for the candidate's score. */
export function voucherEconomicId(input: EvaluationInput, voucher: Voucher) {
  const gross = grossValue(input);
  const amount =
    gross < BigInt(voucher.minimum_dong)
      ? 0n
      : minimum(
          gross,
          voucher.type === 'fixed'
            ? BigInt(voucher.amount_dong)
            : minimum(
                BigInt(voucher.cap_dong),
                roundRatio(gross * BigInt(voucher.rate_bps), 10000n),
              ),
        );
  return `discount:${amount}:seller:${roundRatio(amount * BigInt(voucher.seller_funding_bps), 10000n)}`;
}
export function evaluateCandidate(input: EvaluationInput, voucher: Voucher): Strategy {
  const id = voucherEconomicId(input, voucher);
  const result = evaluateVouchers(input, [voucher]).strategies.find(
    (strategy) => strategy.id === id,
  );
  if (!result) throw new Error(`Missing candidate economic strategy ${id}`);
  // Even when the engine deduplicates against a baseline, preserve this proposal's configuration.
  return { ...result, voucher };
}

/** Bounded scenario optimization, not calibrated demand learning or a global optimality guarantee. */
export function searchVouchers(rawInput: EvaluationInput, options: SearchOptions = {}) {
  const started = performance.now();
  const input = parseInput(rawInput);
  const maxEvaluations = options.maxEvaluations ?? 1000;
  if (!Number.isSafeInteger(maxEvaluations) || maxEvaluations < 5 || maxEvaluations > 10000)
    throw new RangeError('maxEvaluations must be an integer in 5..10000');
  const maximum = Number(minimum(grossValue(input), 1_000_000_000n));
  const baseline = evaluate(input);
  const scored = new Map<number, Strategy>();
  let engineCalls = 1;
  const canonical = (amount: number): Voucher => ({
    type: 'fixed',
    amount_dong: amount,
    minimum_dong: 0,
    seller_funding_bps: input.voucher.seller_funding_bps,
  });
  // Fixed basket: percent, cap, and eligibility have economic meaning only through actual payout.
  // Baseline/current/measured are retained explicitly, independent of later search budget exhaustion.
  for (const strategy of baseline.strategies)
    scored.set(strategy.discount_dong, { ...strategy, voucher: canonical(strategy.discount_dong) });
  const visit = (value: number) => {
    const amount = Math.max(0, Math.min(maximum, Math.round(value)));
    if (scored.has(amount) || scored.size >= maxEvaluations) return;
    scored.set(amount, evaluateCandidate(input, canonical(amount)));
    engineCalls++;
  };
  let resolution = 1;
  if (maximum + 1 <= maxEvaluations) {
    for (let amount = 0; amount <= maximum; amount++) visit(amount);
  } else {
    // First cover the entire interval. Reserve most evaluations for explicit discontinuities and refinement.
    const coarseSegments = Math.max(2, Math.min(256, Math.floor(maxEvaluations / 4)));
    const coarseStep = Math.max(1, Math.ceil(maximum / coarseSegments));
    resolution = coarseStep;
    visit(maximum);
    for (let index = 1; index < coarseSegments && scored.size < maxEvaluations; index++)
      visit((index * maximum) / coarseSegments);
    const neighborhood = (amount: number) => {
      visit(amount);
      visit(amount - 1);
      visit(amount + 1);
    };
    for (const knot of input.assumptions.response_curve) {
      const position = (grossValue(input) * BigInt(knot.discount_bps)) / 10000n;
      if (position <= BigInt(maximum)) neighborhood(Number(position));
    }
    // Funding capacity changes at floor(budget / round(discount * funding)).
    // Sample redemption counts independently of scores, including small counts and logarithmic coverage.
    if (input.voucher.seller_funding_bps > 0) {
      const capacity = Math.min(
        input.constraints.quota,
        ...input.product.lines.map((line) => Math.floor(line.stock_units / line.quantity)),
      );
      const counts = new Set<number>();
      for (let count = 1; count <= Math.min(24, capacity); count++) counts.add(count);
      for (let index = 0; index < 32 && capacity > 0; index++)
        counts.add(Math.max(1, Math.round(Math.exp((Math.log(capacity) * index) / 31))));
      for (const count of counts) {
        const sellerLimit = BigInt(input.constraints.budget_dong) / BigInt(count);
        // Half-up seller funding: last amount with rounded seller funding <= sellerLimit.
        const boundary =
          ((2n * sellerLimit + 1n) * 10000n - 1n) / (2n * BigInt(input.voucher.seller_funding_bps));
        if (boundary <= BigInt(maximum)) neighborhood(Number(boundary));
      }
    }
    // Refine several competing peaks, rather than assuming a single smooth objective.
    let step = coarseStep;
    while (step > 1 && scored.size < maxEvaluations) {
      const nextStep = Math.max(1, Math.floor(step / 8));
      const centers = [...scored.values()]
        .sort(rank)
        .slice(0, 8)
        .map((strategy) => strategy.discount_dong);
      for (let offset = -8; offset <= 8 && scored.size < maxEvaluations; offset++)
        for (const center of centers) visit(center + offset * nextStep);
      resolution = nextStep;
      step = nextStep;
    }
  }
  const strategies = [...scored.values()].sort(rank).slice(0, 5);
  return {
    strategies,
    recommended: strategies[0]!,
    evaluation_count: scored.size,
    engine_calls: engineCalls,
    elapsed_ms: performance.now() - started,
    search_bounds: { min_discount_dong: 0, max_discount_dong: maximum },
    resolution_dong: resolution,
    exhaustive_integer_search: scored.size === maximum + 1,
    budget_exhausted: scored.size >= maxEvaluations && scored.size < maximum + 1,
    method_version: SEARCH_VERSION,
    funding_bps: input.voucher.seller_funding_bps,
    evaluated_discounts_dong: [...scored.keys()].sort((a, b) => a - b),
    baseline_score: baseline.recommended.score,
  };
}

/** LLM proposals are independent inputs; no provider calls and no baseline credit disguised as AI. */
export function hybridSearchVouchers(
  input: EvaluationInput,
  rawCandidates: unknown[],
  options: SearchOptions = {},
) {
  if (rawCandidates.length > 5)
    throw new RangeError('Expected at most five independent AI proposals');
  const search = searchVouchers(input, options);
  const candidates = rawCandidates.flatMap((candidate) =>
    Value.Check(VoucherSchema, candidate) &&
    candidate.seller_funding_bps === input.voucher.seller_funding_bps
      ? [candidate]
      : [],
  );
  const aiStrategies = candidates.map((candidate) => evaluateCandidate(input, candidate));
  const merged = new Map(search.strategies.map((strategy) => [strategy.id, strategy]));
  for (const strategy of aiStrategies)
    if (!merged.has(strategy.id)) merged.set(strategy.id, strategy);
  const strategies = [...merged.values()].sort(rank).slice(0, 5);
  return {
    ...search,
    strategies,
    recommended: strategies[0]!,
    search_only_score: search.recommended.score,
    ai_candidate_strategies: aiStrategies,
    accepted_ai_candidates: candidates.length,
    rejected_ai_candidates: rawCandidates.length - candidates.length,
    additional_ai_engine_calls: candidates.length,
    hybrid_method_version: 'independent-proposals-union.v1',
  };
}
