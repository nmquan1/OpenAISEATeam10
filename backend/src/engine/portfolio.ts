import { feeCatalog, feeRateBps } from './fees.ts';
import { roundRatio } from './money.ts';
import { type Category, type Programme } from '../../../contracts/fee-catalog.ts';
import {
  parseStrategyRequest,
  parsePortfolioResult,
  type PortfolioResult,
  type StrategyRequest,
} from '../../../contracts/portfolio.ts';

export const strategyCatalogVersion = 'strategies@2026-10-31';
const BASIS_POINTS = 10000n;
const INFERRED_MARGIN_BPS: Partial<Record<Category, number>> = {
  beauty: 6000,
  health: 6000,
  fashion: 5000,
  fmcg_other: 2500,
  mom_baby_care: 2500,
  electronics_other: 1000,
  laptop_monitor: 1000,
  phone_tablet: 1000,
};
const DEFAULT_MARGIN_BPS = 3000;
const SHIPPING_SUBSIDY_DONG = 25000;
const MIN_PERCENT_DISCOUNT = 3;
const MAX_PERCENT_DISCOUNT = 10;
const MIN_DISCOUNT_HEADROOM_BPS = 1000;

type Product = StrategyRequest['products'][number];
type GuardedProduct = Product & {
  cost: number;
  inferred: boolean;
  fee_rate_bps: number;
  d_max: number;
  eligible: boolean;
  headroomNumerator: bigint;
  headroomDenominator: bigint;
};
type Candidate = {
  code: string;
  strategy_id: string;
  score: number;
  kind: 'freeship' | 'pct' | 'gift';
  pct?: number;
  gift?: GuardedProduct;
  rule: string;
  ok: boolean;
};

function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError('Portfolio exceeds exact monetary range');
  return number;
}
/** Floor is a percentage input: quantize its decimal representation to whole basis points. */
function floorBasisPoints(floor: number): number {
  if (floor < 0.005) return 0;
  const [whole, fraction = ''] = floor.toString().split('.');
  return safeNumber(
    roundRatio(BigInt(`${whole}${fraction}`) * 100n, 10n ** BigInt(fraction.length)),
  );
}
function guard(product: Product, floorBps: number, programme: Programme): GuardedProduct {
  const cost =
    product.cost ??
    safeNumber(
      roundRatio(
        BigInt(product.price) *
          BigInt(10000 - (INFERRED_MARGIN_BPS[product.category] ?? DEFAULT_MARGIN_BPS)),
        BASIS_POINTS,
      ),
    );
  const feeRate = feeRateBps({ category: product.category, programme });
  const room = BigInt(product.price) * BigInt(10000 - feeRate - floorBps);
  const numerator = room - BigInt(cost + feeCatalog.infrastructure.dong_per_order) * BASIS_POINTS;
  const hasRoom = room > 0n;
  return {
    ...product,
    cost,
    inferred: product.cost === undefined,
    fee_rate_bps: feeRate,
    // Dimensionless display estimate may exceed safe integer precision for extreme losses.
    // Eligibility and discount depth below still use the exact rational values, never d_max.
    d_max: hasRoom ? Number(roundRatio(numerator * 1000n, room)) / 1000 : -1,
    eligible: hasRoom && numerator * BASIS_POINTS >= BigInt(MIN_DISCOUNT_HEADROOM_BPS) * room,
    headroomNumerator: hasRoom ? numerator : -1n,
    headroomDenominator: hasRoom ? room : 1n,
  };
}

/** A repeated-product sample is represented by quantity; never allocate one object per unit. */
function contribution(
  product: GuardedProduct | undefined,
  quantity: number,
  stack: Candidate[],
  floorBps: number,
) {
  if (!product) return { cm_bps: -10000, pass: false };
  const percent = Math.max(
    0,
    ...stack.filter((voucher) => voucher.kind === 'pct').map((voucher) => voucher.pct!),
  );
  const gross = BigInt(product.price) * BigInt(quantity);
  const discount = roundRatio(gross * BigInt(percent), 100n);
  const net = gross - discount;
  const itemFees = roundRatio(
    BigInt(product.price) * BigInt(100 - percent) * BigInt(product.fee_rate_bps),
    100n * BASIS_POINTS,
  );
  const fees = itemFees * BigInt(quantity) + BigInt(feeCatalog.infrastructure.dong_per_order);
  const giftCost = stack.find((voucher) => voucher.kind === 'gift')?.gift?.cost ?? 0;
  const shipping = stack.some((voucher) => voucher.kind === 'freeship') ? SHIPPING_SUBSIDY_DONG : 0;
  const costs = BigInt(product.cost) * BigInt(quantity) + BigInt(giftCost) + BigInt(shipping);
  const contributionMargin = net - fees - costs;
  return {
    cm_bps: net > 0n ? safeNumber(roundRatio(contributionMargin * BASIS_POINTS, net)) : -10000,
    pass: net > 0n && contributionMargin * BASIS_POINTS >= BigInt(floorBps) * net,
  };
}

export function planPortfolio(raw: unknown): PortfolioResult {
  const { products, customers, vouchers, floor, programme } = parseStrategyRequest(raw);
  const floorBps = floorBasisPoints(floor);
  const rows = products.map((product) => guard(product, floorBps, programme));
  const eligible = rows.filter((product) => product.eligible);
  const gifts = rows
    .filter((product) => !product.eligible)
    .sort((left, right) => left.cost - right.cost);
  const sortedPrices = rows.map((product) => product.price).sort((left, right) => left - right);
  const middle = sortedPrices.length >> 1;
  const medianNumerator =
    sortedPrices.length % 2
      ? BigInt(sortedPrices[middle]!) * 2n
      : BigInt(sortedPrices[middle - 1]!) + BigInt(sortedPrices[middle]!);
  const aov = safeNumber(roundRatio(medianNumerator * 7n, 8n));
  const minimum = Math.max(1000, Math.ceil(aov / 100000) * 100000 - 1000);
  const coverageBps =
    customers > 0 ? safeNumber(roundRatio(BigInt(vouchers) * BASIS_POINTS, BigInt(customers))) : 0;
  const warnings: string[] = [];
  if (customers > 0 && BigInt(vouchers) * 4n > BigInt(customers))
    warnings.push(
      `Số voucher bằng ${Math.round((vouchers / customers) * 100)}% số khách: dễ "dạy" khách chờ giảm giá. Nên giảm số lượng và dùng mã riêng cho từng người.`,
    );
  if (customers === 0 && vouchers > 0)
    warnings.push(
      'Chưa có số khách: không thể suy ra độ phủ voucher; phân bổ dưới đây chỉ là giả định.',
    );
  for (const product of rows)
    if (!product.eligible)
      warnings.push(
        `${product.name}: sau phí sàn ${(product.fee_rate_bps / 100).toFixed(1)}% chỉ còn giảm được tối đa ${(Math.max(0, product.d_max) * 100).toFixed(1)}%, loại khỏi voucher %.`,
      );
  const depth = eligible.length
    ? Math.min(
        MAX_PERCENT_DISCOUNT,
        ...eligible.map((product) =>
          safeNumber((product.headroomNumerator * 100n) / product.headroomDenominator),
        ),
      )
    : 0;
  const percentAllowed = depth >= MIN_PERCENT_DISCOUNT;
  const candidates: Candidate[] = [
    {
      code: `FREESHIP${Math.round(minimum / 1000)}`,
      strategy_id: 'AOV-02',
      score: 18,
      kind: 'freeship',
      rule: `free_ship min_order=${minimum}`,
      ok: eligible.length > 0,
    },
    {
      code: `TIER${Math.round(minimum / 1000)}-${depth}`,
      strategy_id: 'AOV-01',
      score: 15,
      kind: 'pct',
      pct: depth,
      rule: `percent=${depth} min_order=${minimum}`,
      ok: percentAllowed,
    },
    {
      code: `WELCOME${depth}`,
      strategy_id: 'ACQ-01',
      score: 14,
      kind: 'pct',
      pct: depth,
      rule: `percent=${depth} first_order unique_code`,
      ok: percentAllowed,
    },
    {
      code: `GWP${Math.round(minimum / 1000)}`,
      strategy_id: 'AOV-03',
      score: 13,
      kind: 'gift',
      gift: gifts[0],
      rule: `gift=${gifts[0]?.name ?? ''} min_order=${minimum}`,
      ok: gifts.length > 0 && eligible.length > 0,
    },
  ];
  const keep = customers === 0 || BigInt(vouchers) * 10n < BigInt(customers) ? 2 : 4;
  let picked = candidates.filter((candidate) => candidate.ok).slice(0, keep);
  const worstItem = eligible.slice().sort((left, right) => {
    const difference =
      left.headroomNumerator * right.headroomDenominator -
      right.headroomNumerator * left.headroomDenominator;
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  })[0];
  const quantity = worstItem ? Math.max(1, Math.ceil(minimum / worstItem.price)) : 0;
  const basketLabel = worstItem ? `${quantity} × ${worstItem.name}` : '—';
  const matrix: PortfolioResult['matrix'] = Object.fromEntries(
    picked.map((voucher) => [voucher.code, {}]),
  );
  const worst: PortfolioResult['worst_stack'] = [];
  for (let index = 0; index < picked.length; index++)
    for (let next = index + 1; next < picked.length; next++) {
      const left = picked[index]!,
        right = picked[next]!;
      if (left.kind === 'pct' && right.kind === 'pct') {
        matrix[left.code]![right.code] = matrix[right.code]![left.code] = 'best_of';
        continue;
      }
      const result = contribution(worstItem, quantity, [left, right], floorBps);
      const pass = result.pass;
      matrix[left.code]![right.code] = matrix[right.code]![left.code] = pass ? 'yes' : 'no';
      worst.push({
        basket: basketLabel,
        stack: [left.code, right.code],
        cm_bps: result.cm_bps,
        pass,
      });
    }
  const dropped = new Set<string>();
  for (const voucher of picked) {
    const result = contribution(worstItem, quantity, [voucher], floorBps);
    const pass = result.pass;
    worst.push({ basket: basketLabel, stack: [voucher.code], cm_bps: result.cm_bps, pass });
    if (!pass) {
      dropped.add(voucher.code);
      warnings.push(
        `${voucher.code}: giỏ kiểm tra chỉ còn biên ${(result.cm_bps / 100).toFixed(1)}% < floor ${floorBps / 100}%, đã bỏ.`,
      );
    }
  }
  picked = picked.filter((voucher) => !dropped.has(voucher.code));
  for (const code of dropped) {
    delete matrix[code];
    for (const row of Object.values(matrix)) delete row[code];
  }
  const totalScore = picked.reduce((sum, voucher) => sum + voucher.score, 0);
  const allocation = picked.map((voucher) => ({
    ...voucher,
    qty: safeNumber(((BigInt(vouchers) * BigInt(voucher.score)) / BigInt(totalScore) / 10n) * 10n),
  }));
  if (allocation.length)
    allocation[0]!.qty += vouchers - allocation.reduce((sum, voucher) => sum + voucher.qty, 0);
  if (!allocation.length)
    warnings.push(
      `Không có voucher nào giữ được floor ${floorBps / 100}% trong giỏ kiểm tra sau phí sàn. Cân nhắc tăng giá, giảm giá vốn hoặc hạ floor.`,
    );
  return parsePortfolioResult({
    mode: 'heuristic_only',
    status: allocation.length ? 'ok' : 'no_feasible_strategy',
    catalog_version: feeCatalog.version,
    strategy_version: strategyCatalogVersion,
    assumptions: {
      aov,
      min_order: minimum,
      floor_pct: floorBps / 100,
      programme,
      ship_subsidy: SHIPPING_SUBSIDY_DONG,
      coverage_bps: coverageBps,
      inferred: rows.filter((product) => product.inferred).map((product) => `cost:${product.name}`),
    },
    products: rows.map(
      ({ name, price, cost, category, inferred, fee_rate_bps, d_max, eligible }) => ({
        name,
        price,
        cost,
        category,
        inferred,
        fee_rate_bps,
        d_max,
        eligible,
      }),
    ),
    excluded_from_pct: rows.filter((product) => !product.eligible).map((product) => product.name),
    vouchers: allocation.map(({ code, strategy_id, qty, rule }) => ({
      code,
      strategy_id,
      qty,
      rule,
    })),
    matrix,
    worst_stack: worst,
    warnings,
    limitations: [
      'Heuristic portfolio only: AOV is 1.75 times median product price; missing cost is inferred from a category margin assumption, not historical evidence.',
      'Stack checks sample repeated units of the eligible product with lowest discount headroom; they do not enumerate every mixed basket or combinations of three or more vouchers.',
      'Portfolio fees use conservative aggregate catalog rates plus one infrastructure fee; caps, platform co-funding, shipping paid by buyers, ads, packaging and returns are not modeled here.',
      'Scores and allocation weights are fixed policy, not measured incremental profit. No revenue forecast or guaranteed margin is provided.',
    ],
  });
}
