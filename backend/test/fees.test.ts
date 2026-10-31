import test from 'node:test';
import assert from 'node:assert/strict';
import { orderFees, commissionBps, feeCatalog } from '../src/engine/fees.ts';
import { evaluate } from '../src/engine/index.ts';
import { defaults } from '../../contracts/model.ts';

// Worked examples printed on banhang.shopee.vn (see contracts/fee-catalog.ts sources).
test('Voucher Xtra matches article 18182: 5.5% per product, capped at 50,000', () => {
  assert.equal(
    orderFees({ price: 500000, category: 'fashion', programme: 'voucher_xtra' }).voucherXtra,
    27500,
  );
  assert.equal(
    orderFees({ price: 5000000, category: 'fashion', programme: 'voucher_xtra' }).voucherXtra,
    50000,
  );
});

test('co-funding matches article 26053: seller pays 40% of a Shopee voucher, capped at 50,000', () => {
  assert.equal(
    orderFees({ price: 1000000, category: 'beauty', platformVoucher: 300000 }).cofund,
    50000,
  );
  assert.equal(
    orderFees({ price: 1000000, category: 'beauty', platformVoucher: 30000 }).cofund,
    12000,
  );
  assert.equal(
    orderFees({
      price: 1000000,
      category: 'beauty',
      platformVoucher: 30000,
      programme: 'voucher_xtra',
    }).cofund,
    0,
  );
});

test('withholding tax matches article 24233: base excludes seller discount and seller co-fund share', () => {
  // A=110,000, seller voucher C=10,000, seller co-fund D2=900 → 99,100 × 1.5% = 1,487.
  assert.equal(
    orderFees({ price: 110000, discount: 10000, category: 'fashion', platformVoucher: 2250 }).tax,
    1487,
  );
});

test('per-order flat fee and conservative commission bound', () => {
  const f = orderFees({ price: 200000, category: 'fashion' });
  assert.equal(f.infrastructure, 3000);
  assert.equal(f.transaction, 12000);
  assert.equal(commissionBps('fashion'), 1650);
  assert.equal(
    f.total,
    f.commission + f.transaction + f.infrastructure + f.voucherXtra + f.cofund + f.tax,
  );
  assert.throws(() => commissionBps('unknown'));
});

test('catalog selection changes campaign profit and reports actual per-strategy fees', () => {
  const manual = evaluate(defaults);
  const catalog = evaluate({
    ...defaults,
    marketplace: {
      category: 'beauty',
      programme: 'standard',
      platform_voucher_dong: 0,
    },
  });
  assert.equal(manual.recommended.fees, undefined);
  assert.equal(catalog.recommended.fees?.catalog_version, feeCatalog.version);
  assert.ok(catalog.recommended.base_profit_dong < manual.recommended.base_profit_dong);
  const discounted = catalog.strategies.find((strategy) => strategy.discount_dong > 0)!;
  assert.ok(discounted.fees!.with_voucher.total < discounted.fees!.without_voucher.total);
  const baseline = catalog.strategies.find((strategy) => strategy.discount_dong === 0)!;
  assert.deepEqual(baseline.fees!.with_voucher, baseline.fees!.without_voucher);
});
