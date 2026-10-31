import {
  parseInput,
  parseEvaluationResult,
  VoucherSchema,
  ValidationError,
  type EvaluationInput,
  type EvaluationResult,
  type Voucher,
  type Strategy,
  type Scenario,
} from '../../../contracts/model.ts';
import { Value } from '@sinclair/typebox/value';
import { basketFees, feeCatalog, feeAssumptions } from './fees.ts';
import { roundRatio } from './money.ts';
export { roundRatio } from './money.ts';

const BPS = 10_000n;
function number(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new ValidationError('Calculated money exceeds exact supported range');
  return result;
}
const rate = (amount: bigint, bps: number) => roundRatio(amount * BigInt(bps), BPS);
const min = (...values: bigint[]) => values.reduce((a, b) => (a < b ? a : b));
function basket(input: EvaluationInput) {
  const lines = input.product.lines;
  const sum = (key: 'unit_price_dong' | 'unit_cost_dong' | 'packaging_dong') =>
    lines.reduce((total, line) => total + BigInt(line[key]) * BigInt(line.quantity), 0n);
  return {
    gross: sum('unit_price_dong'),
    cost: sum('unit_cost_dong'),
    packaging: sum('packaging_dong'),
    capacity: BigInt(
      Math.min(...lines.map((line) => Math.floor(line.stock_units / line.quantity))),
    ),
  };
}
function discount(gross: bigint, voucher: Voucher): bigint {
  if (gross < BigInt(voucher.minimum_dong)) return 0n;
  return min(
    gross,
    voucher.type === 'fixed'
      ? BigInt(voucher.amount_dong)
      : min(rate(gross, voucher.rate_bps), BigInt(voucher.cap_dong)),
  );
}
function multiplier(input: EvaluationInput, gross: bigint, amount: bigint): bigint {
  const curve = input.assumptions.response_curve;
  // Interpolate on the exact effective discount ratio, without first rounding bps.
  const position = amount * BPS;
  for (let i = 1; i < curve.length; i++) {
    const left = curve[i - 1]!,
      right = curve[i]!;
    if (position <= BigInt(right.discount_bps) * gross) {
      const step = position - BigInt(left.discount_bps) * gross;
      return (
        BigInt(left.cvr_multiplier_bps) +
        roundRatio(
          step * BigInt(right.cvr_multiplier_bps - left.cvr_multiplier_bps),
          gross * BigInt(right.discount_bps - left.discount_bps),
        )
      );
    }
  }
  return BigInt(curve[curve.length - 1]!.cvr_multiplier_bps);
}
function scaled(voucher: Voucher): Voucher {
  if (voucher.type === 'fixed')
    return { ...voucher, amount_dong: number(roundRatio(BigInt(voucher.amount_dong) * 6n, 10n)) };
  return {
    ...voucher,
    rate_bps: number(roundRatio(BigInt(voucher.rate_bps) * 6n, 10n)),
    cap_dong: number(roundRatio(BigInt(voucher.cap_dong) * 6n, 10n)),
  };
}
function orderEconomics(input: EvaluationInput, amount: bigint, base: ReturnType<typeof basket>) {
  const e = input.economics;
  const sellerDiscount = rate(amount, input.voucher.seller_funding_bps);
  const catalogFees = input.marketplace
    ? basketFees(input.product.lines, sellerDiscount, input.marketplace)
    : undefined;
  const entitlement = base.gross - sellerDiscount - BigInt(catalogFees?.cofund ?? 0);
  const fee = catalogFees
    ? BigInt(catalogFees.total - catalogFees.tax - catalogFees.cofund)
    : rate(entitlement, e.fee_bps);
  const tax = catalogFees ? BigInt(catalogFees.tax) : rate(entitlement, e.tax_bps);
  const sunk = base.packaging + BigInt(e.shipping_dong) + BigInt(e.ads_dong);
  const kept = entitlement - fee - tax - base.cost - sunk;
  const returned =
    -rate(fee, e.nonrefunded_fee_bps) -
    sunk -
    rate(base.cost, 10_000 - e.return_resale_bps) -
    BigInt(e.return_shipping_dong);
  return {
    sellerDiscount,
    catalogFees,
    profit: roundRatio(
      kept * BigInt(10_000 - e.return_rate_bps) + returned * BigInt(e.return_rate_bps),
      BPS,
    ),
    revenue: rate(entitlement, 10_000 - e.return_rate_bps),
  };
}
export function evaluate(input: EvaluationInput): EvaluationResult {
  return evaluateVouchers(input, []);
}
export function evaluateVouchers(rawInput: EvaluationInput, vouchers: Voucher[]): EvaluationResult {
  const input = parseInput(rawInput);
  if (vouchers.length > 5 || vouchers.some((voucher) => !Value.Check(VoucherSchema, voucher)))
    throw new ValidationError('Expected at most five valid voucher candidates');
  const base = basket(input);
  const baseline: Voucher = {
    type: 'fixed',
    amount_dong: 0,
    minimum_dong: 0,
    seller_funding_bps: 10_000,
  };
  const options = [
    { voucher: baseline, name: 'Không voucher' },
    { voucher: scaled(input.voucher), name: 'Giảm 40% ưu đãi hiện tại' },
    { voucher: input.voucher, name: 'Voucher hiện tại' },
    ...vouchers.map((voucher, index) => ({ voucher, name: `Ứng viên ${index + 1}` })),
  ];
  const seen = new Set<string>();
  const strategies: Strategy[] = [];
  for (const option of options) {
    const amount = discount(base.gross, option.voucher);
    const economicInput = { ...input, voucher: option.voucher };
    const withVoucher = orderEconomics(economicInput, amount, base);
    const withoutVoucher = orderEconomics(economicInput, 0n, base);
    // Configurations with the same buyer benefit and seller cost are equivalent in this fixed basket.
    const id = `discount:${amount}:seller:${withVoucher.sellerDiscount}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const lift = multiplier(input, base.gross, amount);
    const fundingCapacity =
      withVoucher.sellerDiscount > 0n
        ? BigInt(input.constraints.budget_dong) / withVoucher.sellerDiscount
        : BigInt(input.constraints.quota);
    const capacity = amount > 0n ? min(fundingCapacity, BigInt(input.constraints.quota)) : 0n;
    const scenarios: Scenario[] = (['low', 'base', 'high'] as const).map((key) => {
      const visits =
        (BigInt(input.assumptions.visits) * BigInt(input.assumptions.traffic[`${key}_bps`])) / BPS;
      const baselineConversion = BigInt(input.assumptions.cvr_bps) * BPS;
      const conversion = min(BPS * BPS, BigInt(input.assumptions.cvr_bps) * lift);
      const demand = (visits * conversion) / (BPS * BPS);
      const potentialRedeemed = min(capacity, demand, base.capacity);
      // Keep fractional baseline and funded uplift until their combined order count is floored.
      // Separately flooring each term erases real low-volume conversions (0.5 + 0.5 = 1).
      const expectedOrders =
        conversion > 0n
          ? (visits * BigInt(input.assumptions.cvr_bps) * conversion +
              potentialRedeemed * (conversion - baselineConversion) * BPS) /
            (BPS * conversion)
          : 0n;
      const unconstrainedOrders = min(visits, expectedOrders);
      const orders = min(base.capacity, unconstrainedOrders);
      const redeemed = min(potentialRedeemed, orders);
      const profit = (orders - redeemed) * withoutVoucher.profit + redeemed * withVoucher.profit;
      const revenue = (orders - redeemed) * withoutVoucher.revenue + redeemed * withVoucher.revenue;
      return {
        key,
        visits: number(visits),
        orders: number(orders),
        redeemed: number(redeemed),
        spend_dong: number(redeemed * withVoucher.sellerDiscount),
        revenue_dong: number(revenue),
        profit_dong: number(profit),
        stockout: base.capacity > 0n && unconstrainedOrders >= base.capacity,
        exhausted: amount > 0n && demand > capacity,
      };
    });
    const baseProfit = scenarios[1]!.profit_dong,
      worst = Math.min(...scenarios.map((s) => s.profit_dong));
    const score =
      input.objective === 'safe'
        ? worst
        : input.objective === 'growth'
          ? scenarios[1]!.revenue_dong
          : number(roundRatio(BigInt(baseProfit) * 7n + BigInt(worst) * 3n, 10n));
    strategies.push({
      id,
      name: option.name,
      voucher: option.voucher,
      discount_dong: number(amount),
      ...(withVoucher.catalogFees && withoutVoucher.catalogFees
        ? {
            fees: {
              catalog_version: feeCatalog.version,
              without_voucher: withoutVoucher.catalogFees,
              with_voucher: withVoucher.catalogFees,
            },
          }
        : {}),
      scenarios,
      base_profit_dong: baseProfit,
      worst_profit_dong: worst,
      score,
    });
  }
  strategies.sort(
    (a, b) => b.score - a.score || a.discount_dong - b.discount_dong || a.id.localeCompare(b.id),
  );
  return parseEvaluationResult({
    schema_version: '2.0',
    engine_version: '2.1.0',
    mode: 'scenario_only',
    input,
    strategies,
    recommended: strategies[0]!,
    limitations: [
      'Scenario only: conversion response curves are seller assumptions, not calibrated causal effects or statistical forecasts.',
      'Fixed basket composition; orders use integer expected counts and stock is limited by the scarcest SKU. No basket substitution or line-level profit allocation.',
      ...(input.marketplace
        ? feeAssumptions
        : [
            'Fees and taxes are configured aggregate rates on seller entitlement; this is not a verified Shopee fee schedule.',
          ]),
      'No automatic publication; platform co-funding is separate from the shop voucher budget.',
      'Money rounds half away from zero per order before campaign aggregation. Returns use expected per-order loss; voucher budget is conservatively not refunded on returns.',
      'Funding-limited uplift is proportional to funded redemptions; no time-of-day demand, customer segmentation or measured elasticity is inferred.',
    ],
  });
}
