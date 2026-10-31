import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { MarketplaceSchema, StrategyFeesSchema } from './marketplace.ts';
export { feeCatalog, categories, type Category, type Programme } from './fee-catalog.ts';
export { MarketplaceSchema, type Marketplace, type OrderFees } from './marketplace.ts';

const integer = (maximum = 1_000_000_000, minimum = 0) => Type.Integer({ minimum, maximum });
const bps = () => integer(10_000);
const text = (maxLength = 100) => Type.String({ minLength: 1, maxLength, pattern: '\\S' });
const obj = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });
const funding = { minimum_dong: integer(), seller_funding_bps: bps() };
export const VoucherSchema = Type.Union([
  obj({ type: Type.Literal('fixed'), amount_dong: integer(), ...funding }),
  obj({ type: Type.Literal('percent'), rate_bps: bps(), cap_dong: integer(), ...funding }),
]);
export type Voucher = Static<typeof VoucherSchema>;
export const EvaluationInputSchema = obj({
  product: obj({
    name: text(),
    lines: Type.Array(
      obj({
        sku_id: text(),
        quantity: integer(1_000, 1),
        unit_price_dong: integer(1_000_000_000, 1),
        unit_cost_dong: integer(),
        packaging_dong: integer(),
        stock_units: integer(1_000_000),
      }),
      { minItems: 1, maxItems: 20 },
    ),
  }),
  voucher: VoucherSchema,
  marketplace: Type.Optional(MarketplaceSchema),
  economics: obj({
    fee_bps: bps(),
    tax_bps: bps(),
    shipping_dong: integer(),
    ads_dong: integer(),
    return_rate_bps: bps(),
    return_resale_bps: bps(),
    nonrefunded_fee_bps: bps(),
    return_shipping_dong: integer(),
  }),
  assumptions: obj({
    visits: integer(1_000_000),
    cvr_bps: bps(),
    traffic: obj({
      low_bps: integer(1_000_000),
      base_bps: integer(1_000_000),
      high_bps: integer(1_000_000),
    }),
    response_curve: Type.Array(
      obj({ discount_bps: bps(), cvr_multiplier_bps: integer(100_000, 10_000) }),
      { minItems: 1, maxItems: 20 },
    ),
  }),
  constraints: obj({ budget_dong: integer(), quota: integer(1_000_000) }),
  objective: Type.Union([Type.Literal('safe'), Type.Literal('balanced'), Type.Literal('growth')]),
});
export type EvaluationInput = Static<typeof EvaluationInputSchema>;
export const HistoricalSummarySchema = obj({
  source: Type.Literal('user_reported'),
  campaigns: Type.Array(
    obj({
      label: text(),
      visits: integer(100_000_000),
      orders: integer(100_000_000),
      revenue_dong: integer(1_000_000_000_000),
      voucher_spend_dong: integer(1_000_000_000_000),
    }),
    { minItems: 1, maxItems: 20 },
  ),
});
export const RecommendationContextSchema = obj({
  seller_notes: Type.String({ maxLength: 4_000 }),
  history: Type.Optional(HistoricalSummarySchema),
});
export type RecommendationContext = Static<typeof RecommendationContextSchema>;
export const EvaluationRequestSchema = obj({ input: EvaluationInputSchema });
export const RecommendationRequestSchema = obj({
  input: EvaluationInputSchema,
  context: RecommendationContextSchema,
});
export type RecommendationRequest = Static<typeof RecommendationRequestSchema>;
export const CandidateProposalSchema = obj({
  candidates: Type.Array(VoucherSchema, { minItems: 1, maxItems: 5 }),
});
export type CandidateProposal = Static<typeof CandidateProposalSchema>;
const signedMoney = () =>
  Type.Integer({ minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER });
export const ScenarioSchema = obj({
  key: Type.Union([Type.Literal('low'), Type.Literal('base'), Type.Literal('high')]),
  visits: integer(100_000_000),
  orders: integer(1_000_000),
  redeemed: integer(1_000_000),
  spend_dong: integer(Number.MAX_SAFE_INTEGER),
  revenue_dong: integer(Number.MAX_SAFE_INTEGER),
  profit_dong: signedMoney(),
  stockout: Type.Boolean(),
  exhausted: Type.Boolean(),
});
export const StrategySchema = obj({
  id: text(300),
  name: text(200),
  voucher: VoucherSchema,
  discount_dong: integer(Number.MAX_SAFE_INTEGER),
  fees: Type.Optional(StrategyFeesSchema),
  scenarios: Type.Array(ScenarioSchema, { minItems: 3, maxItems: 3 }),
  base_profit_dong: signedMoney(),
  worst_profit_dong: signedMoney(),
  score: Type.Number({ minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER }),
});
const resultFields = {
  schema_version: Type.Literal('2.0'),
  engine_version: Type.Union([Type.Literal('2.0.0'), Type.Literal('2.1.0')]),
  mode: Type.Literal('scenario_only'),
  input: EvaluationInputSchema,
  strategies: Type.Array(StrategySchema, { minItems: 1, maxItems: 8 }),
  recommended: StrategySchema,
  limitations: Type.Array(Type.String()),
};
export const EvaluationResultSchema = obj(resultFields);
export const DecisionContextSchema = obj({
  history_source: Type.Union([Type.Literal('none'), Type.Literal('user_reported')]),
  campaign_count: integer(20),
  observed_cvr_bps: Type.Union([Type.Number({ minimum: 0, maximum: 10_000 }), Type.Null()]),
  observed_aov_dong: Type.Union([
    Type.Number({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    Type.Null(),
  ]),
  applied_to_forecast: Type.Literal(false),
  ranking_basis: Type.String(),
  context_effect: Type.String(),
  field_effects: Type.Array(Type.String()),
});
export const RecommendationResultSchema = obj({
  ...resultFields,
  provider: Type.Literal('openai'),
  model: text(200),
  context: RecommendationContextSchema,
  prompt_version: text(100),
  provider_request_id: Type.String({ maxLength: 300 }),
  usage: obj({
    input_tokens: Type.Union([integer(1_000_000_000), Type.Null()]),
    output_tokens: Type.Union([integer(1_000_000_000), Type.Null()]),
  }),
  estimated_cost_usd: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
  decision_context: DecisionContextSchema,
  rejected_candidates: integer(1_000_000),
});
export type EvaluationResult = Static<typeof EvaluationResultSchema>;
export type RecommendationResult = Static<typeof RecommendationResultSchema>;
export type Strategy = Static<typeof StrategySchema>;
export type Scenario = Static<typeof ScenarioSchema>;
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
function checked<T extends TSchema>(schema: T, value: unknown): Static<T> {
  if (!Value.Check(schema, value)) {
    const error = Value.Errors(schema, value).First();
    throw new ValidationError(`${error?.path || '/'}: ${error?.message || 'Invalid value'}`);
  }
  return value as Static<T>;
}
export function parseInput(value: unknown): EvaluationInput {
  const input = checked(EvaluationInputSchema, value);
  const ids = input.product.lines.map((line) => line.sku_id);
  if (new Set(ids).size !== ids.length) throw new ValidationError('Duplicate sku_id');
  const { low_bps, base_bps, high_bps } = input.assumptions.traffic;
  if (low_bps > base_bps || base_bps > high_bps)
    throw new ValidationError('Traffic must satisfy low <= base <= high');
  const curve = input.assumptions.response_curve;
  if (curve[0]!.discount_bps !== 0 || curve[0]!.cvr_multiplier_bps !== 10_000)
    throw new ValidationError('Response curve must start at zero discount and baseline conversion');
  for (let i = 1; i < curve.length; i++)
    if (
      curve[i]!.discount_bps <= curve[i - 1]!.discount_bps ||
      curve[i]!.cvr_multiplier_bps < curve[i - 1]!.cvr_multiplier_bps
    )
      throw new ValidationError(
        'Response curve must have increasing discounts and nondecreasing multipliers',
      );
  const capacity = Math.min(
    ...input.product.lines.map((line) => Math.floor(line.stock_units / line.quantity)),
  );
  const perOrder =
    input.product.lines.reduce(
      (sum, line) =>
        sum +
        BigInt(line.quantity) *
          (BigInt(line.unit_price_dong) +
            BigInt(line.unit_cost_dong) +
            BigInt(line.packaging_dong)),
      0n,
    ) +
    BigInt(input.economics.shipping_dong) +
    BigInt(input.economics.ads_dong) +
    BigInt(input.economics.return_shipping_dong);
  if (perOrder * BigInt(capacity) > BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 4)))
    throw new ValidationError('Campaign aggregate money exceeds exact supported range');
  return structuredClone(input);
}
export function parseRequest(value: unknown): { input: EvaluationInput } {
  const body = checked(EvaluationRequestSchema, value);
  return { input: parseInput(body.input) };
}
export function normalizeCampaignLabel(label: string): string {
  const normalized = label.trim().normalize('NFC');
  if (
    !normalized ||
    normalized.length > 100 ||
    /[\p{Cc}\p{Cf}]/u.test(normalized) ||
    /^[=+@-]/.test(normalized)
  )
    throw new ValidationError('Invalid campaign label');
  return normalized;
}
export function parseRecommendationRequest(value: unknown): RecommendationRequest {
  const body = checked(RecommendationRequestSchema, value);
  const context = structuredClone(body.context);
  const seen = new Set<string>();
  for (const campaign of context.history?.campaigns ?? []) {
    if (campaign.orders > campaign.visits)
      throw new ValidationError(
        'Historical orders cannot exceed visits for this fixed-basket session contract',
      );
    campaign.label = normalizeCampaignLabel(campaign.label);
    const identity = campaign.label.toLocaleLowerCase('vi');
    if (seen.has(identity)) throw new ValidationError('Duplicate historical campaign label');
    seen.add(identity);
  }
  return { input: parseInput(body.input), context };
}
export function parseEvaluationResult(value: unknown): EvaluationResult {
  const result = checked(EvaluationResultSchema, value);
  validateResult(result);
  return result;
}
function validateResult(result: EvaluationResult): void {
  parseInput(result.input);
  const member = result.strategies.find((strategy) => strategy.id === result.recommended.id);
  if (!member || !Value.Equal(member, result.recommended))
    throw new ValidationError('Recommended strategy must match a ranked candidate');
  const capacity = Math.min(
    ...result.input.product.lines.map((line) => Math.floor(line.stock_units / line.quantity)),
  );
  const ids = new Set<string>();
  for (let i = 0; i < result.strategies.length; i++) {
    const strategy = result.strategies[i]!;
    if (ids.has(strategy.id)) throw new ValidationError('Duplicate strategy ID');
    ids.add(strategy.id);
    if (i > 0 && result.strategies[i - 1]!.score < strategy.score)
      throw new ValidationError('Strategies must be ranked by descending score');
    if (strategy.scenarios.map((row) => row.key).join(',') !== 'low,base,high')
      throw new ValidationError('Scenario order must be low,base,high');
    if (
      strategy.base_profit_dong !== strategy.scenarios[1]!.profit_dong ||
      strategy.worst_profit_dong !== Math.min(...strategy.scenarios.map((row) => row.profit_dong))
    )
      throw new ValidationError('Strategy summary does not reconcile to scenarios');
    for (const row of strategy.scenarios)
      if (
        row.orders > capacity ||
        row.orders > row.visits ||
        row.redeemed > row.orders ||
        row.redeemed > result.input.constraints.quota ||
        row.spend_dong > result.input.constraints.budget_dong
      )
        throw new ValidationError('Scenario violates stock, traffic, redemption or funding limits');
  }
  if (result.recommended.id !== result.strategies[0]!.id)
    throw new ValidationError('Recommended strategy must be ranked first');
}
export function parseRecommendationResult(value: unknown): RecommendationResult {
  const result = checked(RecommendationResultSchema, value);
  validateResult(result);
  parseRecommendationRequest({ input: result.input, context: result.context });
  return result;
}
export const parseCandidateProposal = (value: unknown): CandidateProposal =>
  checked(CandidateProposalSchema, value);
export const defaults: EvaluationInput = {
  product: {
    name: 'Serum phục hồi 30ml',
    lines: [
      {
        sku_id: 'SERUM-30',
        quantity: 1,
        unit_price_dong: 299_000,
        unit_cost_dong: 125_000,
        packaging_dong: 3_000,
        stock_units: 500,
      },
    ],
  },
  voucher: {
    type: 'percent',
    rate_bps: 1500,
    cap_dong: 50_000,
    minimum_dong: 199_000,
    seller_funding_bps: 10_000,
  },
  economics: {
    fee_bps: 1500,
    tax_bps: 0,
    shipping_dong: 0,
    ads_dong: 0,
    return_rate_bps: 0,
    return_resale_bps: 10_000,
    nonrefunded_fee_bps: 10_000,
    return_shipping_dong: 0,
  },
  assumptions: {
    visits: 3000,
    cvr_bps: 300,
    traffic: { low_bps: 15_000, base_bps: 30_000, high_bps: 50_000 },
    response_curve: [
      { discount_bps: 0, cvr_multiplier_bps: 10_000 },
      { discount_bps: 1500, cvr_multiplier_bps: 12_000 },
      { discount_bps: 3000, cvr_multiplier_bps: 14_000 },
    ],
  },
  constraints: { budget_dong: 10_000_000, quota: 300 },
  objective: 'balanced',
};
