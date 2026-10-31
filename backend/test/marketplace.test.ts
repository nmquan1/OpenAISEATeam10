import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, parseInput, type EvaluationInput } from '../../contracts/model.ts';
import { basketFees, orderFees } from '../src/engine/fees.ts';
import { evaluate } from '../src/engine/index.ts';

function input(): EvaluationInput {
  return {
    ...structuredClone(defaults),
    product: {
      name: 'One order',
      lines: [
        {
          sku_id: 'one',
          quantity: 1,
          unit_price_dong: 110000,
          unit_cost_dong: 20000,
          packaging_dong: 0,
          stock_units: 1,
        },
      ],
    },
    voucher: { type: 'fixed', amount_dong: 10000, minimum_dong: 0, seller_funding_bps: 10000 },
    marketplace: { category: 'fashion', programme: 'standard', platform_voucher_dong: 2250 },
    assumptions: {
      visits: 1,
      cvr_bps: 10000,
      traffic: { low_bps: 10000, base_bps: 10000, high_bps: 10000 },
      response_curve: [{ discount_bps: 0, cvr_multiplier_bps: 10000 }],
    },
  };
}

test('catalog co-funding reduces revenue once, replaces manual fee/tax and keeps shop funding separate', () => {
  const source = input();
  const result = evaluate(source);
  const selected = result.strategies.find((strategy) => strategy.discount_dong === 10000)!;
  const fees = selected.fees!.with_voucher;
  const base = selected.scenarios[1]!;
  assert.equal(fees.cofund, 900);
  assert.equal(fees.tax, 1487);
  assert.equal(base.revenue_dong, 99100);
  assert.equal(base.profit_dong, 100000 - fees.total - 20000);
  assert.equal(base.spend_dong, 10000);
  const ignoredManualRates = evaluate({
    ...source,
    economics: { ...source.economics, fee_bps: 10000, tax_bps: 10000 },
  });
  assert.deepEqual(ignoredManualRates.strategies, result.strategies);
});

test('catalog returns use the existing nonrefunded-fee policy without withholding tax or cofund twice', () => {
  const source = input();
  source.economics.return_rate_bps = 10000;
  source.economics.nonrefunded_fee_bps = 5000;
  source.economics.return_shipping_dong = 1000;
  const selected = evaluate(source).strategies.find(
    (strategy) => strategy.discount_dong === 10000,
  )!;
  const fees = selected.fees!.with_voucher;
  assert.equal(selected.scenarios[1]!.revenue_dong, 0);
  assert.equal(
    selected.scenarios[1]!.profit_dong,
    -(fees.total - fees.tax - fees.cofund) / 2 - 1000,
  );
});

test('basket fees apply infrastructure once and Xtra/cofund caps per unit', () => {
  const lines = [{ unit_price_dong: 1000000, quantity: 2 }];
  const xtra = basketFees(lines, 0n, {
    category: 'beauty',
    programme: 'voucher_xtra',
    platform_voucher_dong: 300000,
  });
  assert.equal(xtra.infrastructure, 3000);
  assert.equal(xtra.voucherXtra, 100000);
  assert.equal(xtra.cofund, 0);
  const standard = basketFees(lines, 0n, {
    category: 'beauty',
    programme: 'standard',
    platform_voucher_dong: 300000,
  });
  assert.equal(standard.cofund, 100000);
  assert.equal(standard.infrastructure, 3000);
});

test('integer proportional allocation conserves odd discounts and tax rounds half up', () => {
  const fees = basketFees([{ unit_price_dong: 100, quantity: 2 }], 1n, {
    category: 'beauty',
    programme: 'standard',
    platform_voucher_dong: 0,
  });
  assert.equal(fees.commission, 34);
  assert.equal(fees.transaction, 12);
  assert.equal(fees.tax, 3);
  assert.equal(orderFees({ price: 100, category: 'beauty' }).tax, 2);
});

test('marketplace schema rejects unknown category/programme and fractional platform money', () => {
  const source = input();
  assert.throws(() =>
    parseInput({ ...source, marketplace: { ...source.marketplace, category: 'unknown' } }),
  );
  assert.throws(() =>
    parseInput({ ...source, marketplace: { ...source.marketplace, programme: 'unknown' } }),
  );
  assert.throws(() =>
    parseInput({ ...source, marketplace: { ...source.marketplace, platform_voucher_dong: 0.5 } }),
  );
});
