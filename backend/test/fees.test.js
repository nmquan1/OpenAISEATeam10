import test from 'node:test';
import assert from 'node:assert/strict';
import {orderFees, commissionBps, feeCatalog} from '../src/engine/fees.js';
import {evaluate, defaults} from '../src/engine/index.js';

// Worked examples printed on banhang.shopee.vn (see contracts/fee-catalog.js sources).
test('Voucher Xtra matches article 18182: 5.5% per product, capped at 50,000', () => {
  assert.equal(orderFees({price:500000, category:'fashion', programme:'voucher_xtra'}).voucherXtra, 27500);
  assert.equal(orderFees({price:5000000, category:'fashion', programme:'voucher_xtra'}).voucherXtra, 50000);
});

test('co-funding matches article 26053: seller pays 40% of a Shopee voucher, capped at 50,000', () => {
  assert.equal(orderFees({price:1000000, category:'beauty', platformVoucher:300000}).cofund, 50000);
  assert.equal(orderFees({price:1000000, category:'beauty', platformVoucher:30000}).cofund, 12000);
  assert.equal(orderFees({price:1000000, category:'beauty', platformVoucher:30000, programme:'voucher_xtra'}).cofund, 0);
});

test('withholding tax matches article 24233: base excludes seller discount and seller co-fund share', () => {
  // A=110,000, seller voucher C=10,000, seller co-fund D2=900 → 99,100 × 1.5% = 1,487.
  assert.equal(orderFees({price:110000, discount:10000, category:'fashion', platformVoucher:2250}).tax, 1487);
});

test('per-order flat fee and conservative commission bound', () => {
  const f = orderFees({price:200000, category:'fashion'});
  assert.equal(f.infrastructure, 3000);
  assert.equal(f.transaction, 12000);
  assert.equal(commissionBps('fashion'), 1650);
  assert.equal(f.total, f.commission + f.transaction + f.infrastructure + f.voucherXtra + f.cofund + f.tax);
  assert.throws(()=>commissionBps('unknown'));
});

test('a category switches profit to the verified catalog and returns its version', () => {
  const legacy = evaluate(defaults);
  const verified = evaluate({...defaults, category:'beauty'});
  assert.equal(legacy.fees, null);
  assert.equal(verified.fees.catalog_version, feeCatalog.version);
  // Beauty fees (17% + 6% + 1.5% + 3,000/order) exceed the 15% placeholder.
  assert.ok(verified.recommended.expected < legacy.recommended.expected);
  assert.ok(verified.portfolio);
});

test('with-voucher fees use a strategy that actually discounts', () => {
  const r = evaluate({...defaults, category:'beauty'});
  assert.ok(r.fees.per_order.with_voucher.total < r.fees.per_order.without_voucher.total);
});
