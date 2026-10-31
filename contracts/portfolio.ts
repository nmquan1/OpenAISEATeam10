import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { CategorySchema, ProgrammeSchema } from './marketplace.ts';
import { ValidationError } from './model.ts';

const object = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });
const money = () => Type.Integer({ minimum: 0, maximum: 1_000_000_000 });
const integer = (maximum = Number.MAX_SAFE_INTEGER) => Type.Integer({ minimum: 0, maximum });
const text = (maxLength = 200) => Type.String({ minLength: 1, maxLength, pattern: '\\S' });
const category = CategorySchema;
const programme = ProgrammeSchema;
export const StrategyRequestSchema = object({
  products: Type.Array(
    object({
      name: text(100),
      price: Type.Integer({ minimum: 1, maximum: 1_000_000_000 }),
      cost: Type.Optional(money()),
      category,
    }),
    { minItems: 1, maxItems: 50 },
  ),
  customers: integer(1_000_000),
  vouchers: integer(1_000_000),
  floor: Type.Optional(Type.Number({ minimum: 0, maximum: 90, default: 20 })),
  programme: Type.Optional({ ...programme, default: 'standard' }),
});
export type StrategyRequest = Static<typeof StrategyRequestSchema>;
export type ParsedStrategyRequest = StrategyRequest & {
  floor: number;
  programme: 'standard' | 'voucher_xtra';
};

const MatrixRule = Type.Union([Type.Literal('yes'), Type.Literal('no'), Type.Literal('best_of')]);
export const PortfolioResultSchema = object({
  mode: Type.Literal('heuristic_only'),
  status: Type.Union([Type.Literal('ok'), Type.Literal('no_feasible_strategy')]),
  catalog_version: text(),
  strategy_version: text(),
  assumptions: object({
    aov: integer(),
    min_order: integer(),
    floor_pct: Type.Number({ minimum: 0, maximum: 90 }),
    programme,
    ship_subsidy: integer(),
    coverage_bps: integer(),
    inferred: Type.Array(text()),
  }),
  products: Type.Array(
    object({
      name: text(100),
      price: integer(),
      cost: integer(),
      category,
      inferred: Type.Boolean(),
      fee_rate_bps: integer(),
      d_max: Type.Number(),
      eligible: Type.Boolean(),
    }),
    { minItems: 1, maxItems: 50 },
  ),
  excluded_from_pct: Type.Array(text(100)),
  vouchers: Type.Array(
    object({ code: text(), strategy_id: text(), qty: integer(), rule: text(400) }),
    { maxItems: 4 },
  ),
  matrix: Type.Record(Type.String(), Type.Record(Type.String(), MatrixRule)),
  worst_stack: Type.Array(
    object({
      basket: text(200),
      stack: Type.Array(text(), { minItems: 1, maxItems: 2 }),
      cm_bps: Type.Integer(),
      pass: Type.Boolean(),
    }),
  ),
  warnings: Type.Array(Type.String()),
  limitations: Type.Array(Type.String()),
});
export type PortfolioResult = Static<typeof PortfolioResultSchema>;

export function parseStrategyRequest(value: unknown): ParsedStrategyRequest {
  if (!Value.Check(StrategyRequestSchema, value))
    throw new ValidationError(
      Value.Errors(StrategyRequestSchema, value).First()?.message ?? 'Invalid strategy request',
    );
  return structuredClone({
    ...value,
    floor: value.floor ?? 20,
    programme: value.programme ?? 'standard',
  });
}
export function parsePortfolioResult(value: unknown): PortfolioResult {
  if (!Value.Check(PortfolioResultSchema, value))
    throw new ValidationError(
      Value.Errors(PortfolioResultSchema, value).First()?.message ?? 'Invalid portfolio result',
    );
  return structuredClone(value);
}
export const exampleStrategyRequest: StrategyRequest = {
  products: [
    { name: 'Serum Vitamin C 30ml', price: 350000, cost: 120000, category: 'beauty' },
    { name: 'Bông tẩy trang', price: 45000, cost: 33000, category: 'beauty' },
  ],
  customers: 8000,
  vouchers: 2500,
  floor: 20,
  programme: 'standard',
};
