import { Value } from '@sinclair/typebox/value';
import {
  CandidateProposalSchema,
  VoucherSchema,
  type EvaluationInput,
  type Voucher,
} from '../../contracts/model.ts';
import { evaluate, evaluateVouchers, roundRatio } from '../../backend/src/engine/index.ts';
import { gridCandidates, hash, quantile } from './metrics.ts';

export function economicId(input: EvaluationInput, voucher: Voucher): string {
  const gross = input.product.lines.reduce(
    (sum, line) => sum + BigInt(line.quantity) * BigInt(line.unit_price_dong),
    0n,
  );
  const minimum = (...values: bigint[]) => values.reduce((a, b) => (a < b ? a : b));
  const discount =
    gross < BigInt(voucher.minimum_dong)
      ? 0n
      : voucher.type === 'fixed'
        ? minimum(gross, BigInt(voucher.amount_dong))
        : minimum(
            gross,
            roundRatio(gross * BigInt(voucher.rate_bps), 10000n),
            BigInt(voucher.cap_dong),
          );
  return `discount:${discount}:seller:${roundRatio(discount * BigInt(voucher.seller_funding_bps), 10000n)}`;
}
export function scoreVoucher(input: EvaluationInput, voucher: Voucher) {
  const id = economicId(input, voucher);
  const strategy = evaluateVouchers(input, [voucher]).strategies.find((item) => item.id === id);
  if (!strategy) throw new Error(`Engine failed economic ID lookup: ${id}`);
  const capacity = Math.min(
    ...input.product.lines.map((line) => Math.floor(line.stock_units / line.quantity)),
  );
  const violations = strategy.scenarios
    .filter(
      (scenario) =>
        scenario.spend_dong > input.constraints.budget_dong ||
        scenario.redeemed > input.constraints.quota ||
        scenario.orders > capacity ||
        scenario.orders > scenario.visits ||
        scenario.redeemed > scenario.orders,
    )
    .map((scenario) => scenario.key);
  return { id, voucher, score: strategy.score, constraint_violations: violations };
}
export function assessProposal(input: EvaluationInput, proposal: unknown) {
  const object =
    proposal && typeof proposal === 'object' ? (proposal as { candidates?: unknown }) : {};
  const raw = Array.isArray(object.candidates) ? object.candidates : [];
  const candidates = raw.map((candidate, index) => {
    const schemaValid = Value.Check(VoucherSchema, candidate);
    const fundingValid =
      schemaValid && candidate.seller_funding_bps === input.voucher.seller_funding_bps;
    const scored = schemaValid && fundingValid ? scoreVoucher(input, candidate) : null;
    return {
      index,
      raw: candidate,
      schema_valid: schemaValid,
      funding_valid: fundingValid,
      scored,
    };
  });
  const valid = candidates.flatMap((candidate) => (candidate.scored ? [candidate.scored] : []));
  const sorted = [...valid].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const best = sorted[0] ?? null;
  return {
    pass_at_1: Value.Check(CandidateProposalSchema, proposal),
    candidate_count: raw.length,
    schema_valid_count: candidates.filter((candidate) => candidate.schema_valid).length,
    valid_candidate_count: valid.length,
    funding_violations: candidates.filter(
      (candidate) => candidate.schema_valid && !candidate.funding_valid,
    ).length,
    distinct_economic_count: new Set(valid.map((candidate) => candidate.id)).size,
    distinct_economic_rate: valid.length
      ? new Set(valid.map((candidate) => candidate.id)).size / valid.length
      : null,
    candidates,
    best,
  };
}
export function references(input: EvaluationInput) {
  const baseline = evaluate(input);
  const five = gridCandidates(input).map((voucher) => scoreVoucher(input, voucher));
  const zero: Voucher = {
    type: 'fixed',
    amount_dong: 0,
    minimum_dong: 0,
    seller_funding_bps: input.voucher.seller_funding_bps,
  };
  const dense = [...gridCandidates(input, true), zero].map((voucher) =>
    scoreVoucher(input, voucher),
  );
  const grid5 = Math.max(...five.map((candidate) => candidate.score));
  const denseScore = Math.max(...dense.map((candidate) => candidate.score));
  const noDiscount = scoreVoucher(input, zero);
  return {
    baseline_score: baseline.recommended.score,
    baseline_strategy_ids: baseline.strategies.map((strategy) => strategy.id),
    no_discount_score: noDiscount.score,
    grid5_candidate_score: grid5,
    grid5_production_score: Math.max(grid5, baseline.recommended.score),
    dense_candidate_score: denseScore,
    dense_production_score: Math.max(denseScore, baseline.recommended.score),
    normalization_scale: Math.max(1, Math.abs(denseScore), Math.abs(noDiscount.score)),
    grid5_candidates: five,
    dense_candidates: dense,
    grid_definition_sha256: hash({
      five: five.map((row) => row.voucher),
      dense: dense.map((row) => row.voucher),
    }),
  };
}
export type References = ReturnType<typeof references>;
export const outcome = (score: number, comparator: number) =>
  score > comparator ? 'win' : score < comparator ? 'loss' : 'tie';
export function comparison(assessment: ReturnType<typeof assessProposal>, reference: References) {
  const score = assessment.best?.score ?? null;
  return {
    best_ai_score: score,
    top_candidate_id: assessment.best?.id ?? null,
    signed_gap_ai_minus_dense: score === null ? null : score - reference.dense_candidate_score,
    regret: score === null ? null : Math.max(0, reference.dense_candidate_score - score),
    normalized_regret:
      score === null
        ? null
        : Math.max(0, reference.dense_candidate_score - score) / reference.normalization_scale,
    vs_grid5: score === null ? null : outcome(score, reference.grid5_candidate_score),
    vs_baseline: score === null ? null : outcome(score, reference.baseline_score),
    genuine_new_winner:
      score === null
        ? false
        : score > reference.baseline_score &&
          !reference.baseline_strategy_ids.includes(assessment.best!.id),
    production_score:
      score === null ? reference.baseline_score : Math.max(score, reference.baseline_score),
  };
}
export function distribution(values: (number | null)[]) {
  const known = values.filter((value): value is number => value !== null);
  const mean = known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
  return {
    known: known.length,
    unknown: values.length - known.length,
    mean,
    p50: quantile(known, 0.5),
    p95: quantile(known, 0.95),
    population_sd:
      mean === null
        ? null
        : Math.sqrt(known.reduce((sum, value) => sum + (value - mean) ** 2, 0) / known.length),
  };
}
