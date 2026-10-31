import { Type, type Static } from '@sinclair/typebox';
import { categories } from './fee-catalog.ts';

export const CategorySchema = Type.Union(categories.map((category) => Type.Literal(category)));
export const ProgrammeSchema = Type.Union([Type.Literal('standard'), Type.Literal('voucher_xtra')]);
export const MarketplaceSchema = Type.Object(
  {
    category: CategorySchema,
    programme: ProgrammeSchema,
    platform_voucher_dong: Type.Integer({ minimum: 0, maximum: 1_000_000_000 }),
  },
  { additionalProperties: false },
);
export type Marketplace = Static<typeof MarketplaceSchema>;
const money = () => Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
export const OrderFeesSchema = Type.Object(
  {
    commission: money(),
    transaction: money(),
    infrastructure: money(),
    voucherXtra: money(),
    cofund: money(),
    tax: money(),
    total: money(),
  },
  { additionalProperties: false },
);
export type OrderFees = Static<typeof OrderFeesSchema>;
export const StrategyFeesSchema = Type.Object(
  {
    catalog_version: Type.String(),
    without_voucher: OrderFeesSchema,
    with_voucher: OrderFeesSchema,
  },
  { additionalProperties: false },
);
