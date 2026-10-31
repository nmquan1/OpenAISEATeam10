import type { EvaluationResult } from '@market-maker/contracts';

export const MAX_OFFERED_STRATEGIES = 5;

/** Keep the full engine result for provenance and baseline comparison; shortlist only the UI. */
export function getOfferedStrategies(result: EvaluationResult) {
  // The validated API contract already guarantees engine ranking and the recommended first item.
  return result.strategies.slice(0, MAX_OFFERED_STRATEGIES);
}

export function getSelectedOffer(result: EvaluationResult, selectedId: string | null) {
  const offers = getOfferedStrategies(result);
  return offers.find((strategy) => strategy.id === selectedId) ?? offers[0]!;
}
