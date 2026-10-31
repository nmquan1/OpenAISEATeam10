import type { EvaluationInput, Strategy } from '../../../contracts/model.ts';

export const MINIMUM_OFFER_DISTANCE_DONG = 1_000;
export const OFFER_DISTANCE_BASKET_PERCENT = 1;

/** Presentation heuristic only: at least 1,000 VND or a whole-dong ceiling of 1% of this basket. */
export function minimumOfferDistanceDong(input: EvaluationInput): number {
  const gross = input.product.lines.reduce(
    (sum, line) => sum + BigInt(line.unit_price_dong) * BigInt(line.quantity),
    0n,
  );
  const percentCeiling = (gross * BigInt(OFFER_DISTANCE_BASKET_PERCENT) + 99n) / 100n;
  return Math.max(MINIMUM_OFFER_DISTANCE_DONG, Number(percentCeiling));
}

/**
 * Posthoc presentation filter over already computed strategies; never changes economics or search.
 * A distinct discount is not evidence of a materially different outcome or a profitable offer.
 * Supply a wider scored pool to obtain alternatives; five near-identical inputs can yield one offer.
 */
export function diverseOffers(
  input: EvaluationInput,
  strategies: readonly Strategy[],
  limit = 5,
): Strategy[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5)
    throw new RangeError('Offer limit must be an integer in 1..5');
  const minimumDistance = minimumOfferDistanceDong(input);
  const ranked = [...strategies].sort(
    (a, b) => b.score - a.score || a.discount_dong - b.discount_dong || a.id.localeCompare(b.id),
  );
  const offers: Strategy[] = [];
  for (const candidate of ranked) {
    if (
      offers.every(
        (chosen) => Math.abs(chosen.discount_dong - candidate.discount_dong) >= minimumDistance,
      )
    )
      offers.push(candidate);
    if (offers.length === limit) break;
  }
  return offers;
}
