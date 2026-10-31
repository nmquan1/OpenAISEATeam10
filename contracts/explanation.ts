import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export const ExplanationReasonSchema = Type.Union(
  (
    [
      'ranked_first',
      'scenario_only',
      'base_profit',
      'base_revenue',
      'downside_profit',
      'no_voucher',
      'loss_risk',
      'stock_limited',
      'funding_or_quota_limited',
    ] as const
  ).map((value) => Type.Literal(value)),
);
export const ExplanationClaimSchema = Type.Object(
  {
    strategy_id: Type.String({ minLength: 1, maxLength: 300 }),
    scenario: Type.Union((['low', 'base', 'high'] as const).map((value) => Type.Literal(value))),
    metric: Type.Union(
      (['profit_dong', 'revenue_dong', 'spend_dong', 'orders', 'redeemed'] as const).map((value) =>
        Type.Literal(value),
      ),
    ),
    value: Type.Integer({ minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER }),
  },
  { additionalProperties: false },
);
/** No model-generated prose: all user-facing sentences come from verified templates. */
export const ExplanationProposalSchema = Type.Object(
  {
    selected_strategy_id: Type.String({ minLength: 1, maxLength: 300 }),
    reason_codes: Type.Array(ExplanationReasonSchema, { minItems: 2, maxItems: 9 }),
    claims: Type.Array(ExplanationClaimSchema, { minItems: 1, maxItems: 12 }),
    evidence_ids: Type.Array(Type.String({ minLength: 1, maxLength: 400 }), { maxItems: 6 }),
  },
  { additionalProperties: false },
);
export type ExplanationProposal = Static<typeof ExplanationProposalSchema>;
export type ExplanationClaim = Static<typeof ExplanationClaimSchema>;
export function isExplanationProposal(value: unknown): value is ExplanationProposal {
  return Value.Check(ExplanationProposalSchema, value);
}
