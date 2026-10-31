import { feeCatalog, type Category, type Programme } from '../../../contracts/fee-catalog.ts';
import type { Marketplace, OrderFees } from '../../../contracts/marketplace.ts';
import { roundRatio } from './money.ts';
export { feeCatalog };

const bps = (amount: bigint, rate: number) => roundRatio(amount * BigInt(rate), 10000n);
const min = (left: bigint, right: bigint) => (left < right ? left : right);

export function commissionBps(category: string): number {
  if (!Object.hasOwn(feeCatalog.commission.categories, category))
    throw new Error(`Unknown category ${category}`);
  return feeCatalog.commission.categories[category as Category].bps[1]!;
}

/** Cumulative proportional allocation preserves the exact total despite integer VND. */
function allocate(total: bigint, weights: bigint[]): bigint[] {
  const denominator = weights.reduce((sum, weight) => sum + weight, 0n);
  let cumulative = 0n;
  let allocated = 0n;
  return weights.map((weight) => {
    cumulative += weight;
    const target = denominator === 0n ? 0n : (total * cumulative) / denominator;
    const share = target - allocated;
    allocated = target;
    return share;
  });
}

/**
 * One fixed basket, one category and programme. Seller/platform vouchers are allocated
 * proportionally across units; item caps and item commission rounding apply per unit.
 * Transaction, withholding tax and the flat infrastructure fee apply once per order.
 */
export function basketFees(
  lines: readonly { unit_price_dong: number; quantity: number }[],
  sellerDiscount: bigint,
  marketplace: Marketplace,
): OrderFees {
  const prices = lines.flatMap((line) =>
    Array<bigint>(line.quantity).fill(BigInt(line.unit_price_dong)),
  );
  const gross = prices.reduce((sum, price) => sum + price, 0n);
  if (sellerDiscount < 0n || sellerDiscount > gross)
    throw new RangeError('Invalid seller discount');
  const discounts = allocate(sellerDiscount, prices);
  const netPrices = prices.map((price, index) => price - discounts[index]!);
  const sellerPrice = gross - sellerDiscount;
  const platformDiscounts = allocate(
    min(BigInt(marketplace.platform_voucher_dong), sellerPrice),
    netPrices,
  );
  const xtraOn = marketplace.programme === 'voucher_xtra';
  const commission = netPrices.reduce(
    (sum, price) => sum + bps(price, commissionBps(marketplace.category)),
    0n,
  );
  const transaction = bps(sellerPrice, feeCatalog.transaction.bps);
  const infrastructure = BigInt(feeCatalog.infrastructure.dong_per_order);
  const voucherXtra = xtraOn
    ? prices.reduce(
        (sum, price) =>
          sum +
          min(bps(price, feeCatalog.voucher_xtra.bps), BigInt(feeCatalog.voucher_xtra.cap_dong)),
        0n,
      )
    : 0n;
  const cofund = xtraOn
    ? 0n
    : platformDiscounts.reduce(
        (sum, amount) =>
          sum + min(bps(amount, feeCatalog.cofund.seller_bps), BigInt(feeCatalog.cofund.cap_dong)),
        0n,
      );
  const tax = bps(sellerPrice - cofund, feeCatalog.tax.vat_bps + feeCatalog.tax.pit_bps);
  const amounts = {
    commission,
    transaction,
    infrastructure,
    voucherXtra,
    cofund,
    tax,
    total: commission + transaction + infrastructure + voucherXtra + cofund + tax,
  };
  return Object.fromEntries(
    Object.entries(amounts).map(([key, amount]) => {
      const value = Number(amount);
      if (!Number.isSafeInteger(value)) throw new RangeError('Fee exceeds supported exact range');
      return [key, value];
    }),
  ) as OrderFees;
}

/** Original one-product fee interface retained for portfolio and catalog regression examples. */
export function orderFees({
  price,
  discount = 0,
  category,
  programme = 'standard',
  platformVoucher = 0,
}: {
  price: number;
  discount?: number;
  category: Category;
  programme?: Programme;
  platformVoucher?: number;
}): OrderFees {
  return basketFees([{ unit_price_dong: price, quantity: 1 }], BigInt(discount), {
    category,
    programme,
    platform_voucher_dong: platformVoucher,
  });
}

export function feeRateBps({
  category,
  programme = 'standard',
}: {
  category: Category;
  programme?: Programme;
}) {
  return (
    commissionBps(category) +
    feeCatalog.transaction.bps +
    feeCatalog.tax.vat_bps +
    feeCatalog.tax.pit_bps +
    (programme === 'voucher_xtra' ? feeCatalog.voucher_xtra.bps : 0)
  );
}

export const feeAssumptions = [
  `Catalog snapshot ${feeCatalog.version}; source provenance is recorded in contracts/fee-catalog.ts. Rates are not re-verified at runtime.`,
  'A single category/programme applies to every unit in the fixed basket. Commission uses the category upper bound.',
  'Seller and platform discounts are allocated proportionally in integer VND across units; Xtra/co-fund caps and commission rounding apply per unit.',
  'Transaction and tax round once per order; infrastructure is charged once per order. Buyer-paid shipping and bank promotions are not included in the fee base.',
  'Withholding tax models household/individual goods sellers. Platform voucher is assumed available on every order; it does not increase the configured demand curve or consume the shop voucher quota/budget.',
];
