import { createHash } from 'node:crypto';
import type {
  EvaluationInput,
  EvaluationResult,
  RecommendationResult,
  Voucher,
} from '../../contracts/model.ts';
import { evaluateVouchers } from '../../backend/src/engine/index.ts';

export const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const quantile = (values: number[], fraction: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!;
};
export function gridCandidates(input: EvaluationInput, dense = false): Voucher[] {
  const gross = input.product.lines.reduce(
    (sum, line) => sum + line.unit_price_dong * line.quantity,
    0,
  );
  const cap = Math.min(
    1_000_000_000,
    input.voucher.type === 'percent'
      ? input.voucher.cap_dong
      : Math.max(1, input.voucher.amount_dong),
  );
  const rates = dense
    ? [100, 500, 1000, 1500, 2000, 3000, 5000, 8000]
    : [100, 500, 1000, 1500, 2000];
  const caps = dense
    ? [
        ...new Set([
          cap,
          Math.min(1_000_000_000, Math.round(gross * 0.05)),
          Math.min(1_000_000_000, Math.round(gross * 0.2)),
        ]),
      ]
    : [cap];
  const minimums = dense
    ? [...new Set([0, input.voucher.minimum_dong, Math.min(1_000_000_000, gross)])]
    : [input.voucher.minimum_dong];
  const vouchers: Voucher[] = rates.flatMap((rate_bps) =>
    caps.flatMap((cap_dong) =>
      minimums.map((minimum_dong) => ({
        type: 'percent' as const,
        rate_bps,
        cap_dong,
        minimum_dong,
        seller_funding_bps: input.voucher.seller_funding_bps,
      })),
    ),
  );
  if (dense)
    for (const proportion of [0.01, 0.05, 0.1, 0.2])
      vouchers.push({
        type: 'fixed',
        amount_dong: Math.min(1_000_000_000, Math.round(gross * proportion)),
        minimum_dong: 0,
        seller_funding_bps: input.voucher.seller_funding_bps,
      });
  return vouchers;
}
export function gridScore(input: EvaluationInput, dense = false) {
  return Math.max(
    ...gridCandidates(input, dense).map(
      (voucher) => evaluateVouchers(input, [voucher]).recommended.score,
    ),
  );
}
export function constraintViolations(
  input: EvaluationInput,
  result: RecommendationResult,
): string[] {
  const issues: string[] = [];
  if (hash(input) !== hash(result.input)) issues.push('merchant_input_mutated');
  const capacity = Math.min(
    ...input.product.lines.map((line) => Math.floor(line.stock_units / line.quantity)),
  );
  for (const strategy of result.strategies) {
    if (
      strategy.discount_dong > 0 &&
      strategy.voucher.seller_funding_bps !== input.voucher.seller_funding_bps
    )
      issues.push(`seller_funding_changed:${strategy.id}`);
    for (const row of strategy.scenarios) {
      if (
        row.spend_dong > input.constraints.budget_dong ||
        row.redeemed > input.constraints.quota ||
        row.orders > capacity ||
        row.orders > row.visits ||
        row.redeemed > row.orders
      )
        issues.push(`constraint_exceeded:${strategy.id}:${row.key}`);
    }
  }
  return [...new Set(issues)];
}
export function newWinner(baseline: EvaluationResult, result: EvaluationResult) {
  return (
    result.recommended.score > baseline.recommended.score &&
    !baseline.strategies.some((strategy) => strategy.id === result.recommended.id)
  );
}
export function csvValue(value: unknown) {
  // Prevent spreadsheet formula interpretation in user-controlled notes/model/error fields.
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  if (/^[=+@-]/.test(text) && typeof value !== 'number') text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
