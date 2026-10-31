import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaults,
  parseEvaluationResult,
  type EvaluationInput,
  type Voucher,
} from '../../contracts/model.ts';
import { evaluate, evaluateVouchers, roundRatio } from '../src/engine/index.ts';
const fixture = () => structuredClone(defaults);
const full = (result: ReturnType<typeof evaluate>, discount: number) =>
  result.strategies.find((s) => s.discount_dong === discount)!;

test('exact half-away-from-zero ratio handles positive/negative half-dong', () => {
  assert.equal(roundRatio(40n * 125n, 10_000n), 1n);
  assert.equal(roundRatio(-40n * 125n, 10_000n), -1n);
  assert.equal(roundRatio(1n, 3n), 0n);
  assert.equal(roundRatio(2n, 3n), 1n);
});
test('results are reproducible, versioned, schema checked and preserve inputs', () => {
  const input = fixture(),
    before = structuredClone(input),
    result = evaluate(input);
  assert.deepEqual(evaluate(input), result);
  assert.deepEqual(input, before);
  assert.equal(result.mode, 'scenario_only');
  assert.equal(result.schema_version, '2.0');
  assert.deepEqual(parseEvaluationResult(result), result);
});
test('identical effective voucher has exactly the same demand in manual and AI paths', () => {
  const input = fixture();
  input.constraints = { budget_dong: 100_000_000, quota: 1000 };
  input.product.lines[0]!.stock_units = 1000;
  const manual = evaluate(input);
  const measured = manual.strategies.find((s) => s.name.includes('40%'))!;
  const ai = evaluateVouchers(input, [measured.voucher]);
  const same = ai.strategies.find((s) => s.discount_dong === measured.discount_dong)!;
  assert.deepEqual(same.scenarios, measured.scenarios);
  assert.ok(ai.recommended.score >= manual.recommended.score);
});
test('zero/tiny discounts cannot receive an unrelated flat uplift', () => {
  const input = fixture();
  input.constraints.quota = 1000;
  input.constraints.budget_dong = 100_000_000;
  input.product.lines[0]!.stock_units = 1000;
  const baseline = evaluate(input).strategies.find((s) => s.discount_dong === 0)!;
  const tiny: Voucher = {
    type: 'fixed',
    amount_dong: 1,
    minimum_dong: 0,
    seller_funding_bps: 10000,
  };
  const ai = full(evaluateVouchers(input, [tiny]), 1);
  assert.equal(ai.scenarios[1]!.orders, baseline.scenarios[1]!.orders);
});
test('funding exhaustion removes uplift and cannot falsely report stockout', () => {
  const input = fixture();
  input.constraints = { budget_dong: 0, quota: 0 };
  input.assumptions.visits = 1000;
  input.assumptions.cvr_bps = 1000;
  input.assumptions.traffic = { low_bps: 10000, base_bps: 10000, high_bps: 10000 };
  input.product.lines[0]!.stock_units = 200;
  for (const strategy of evaluate(input).strategies)
    for (const row of strategy.scenarios) {
      assert.equal(row.orders, 100);
      assert.equal(row.stockout, false);
      assert.equal(row.redeemed, 0);
      assert.equal(row.spend_dong, 0);
    }
});
test('all paths use consistent CVR arithmetic without losing the 29th order', () => {
  const input = fixture();
  input.assumptions.visits = 100;
  input.assumptions.cvr_bps = 2900;
  input.assumptions.traffic = { low_bps: 10000, base_bps: 10000, high_bps: 10000 };
  input.assumptions.response_curve = [{ discount_bps: 0, cvr_multiplier_bps: 10000 }];
  for (const strategy of evaluate(input).strategies) {
    assert.equal(strategy.scenarios[1]!.orders, 29);
    if (strategy.discount_dong > 0) assert.equal(strategy.scenarios[1]!.redeemed, 29);
  }
});
test('fixed multi-SKU basket qualifies voucher at basket total and stock limits every line', () => {
  const input = fixture();
  input.product.lines = [
    {
      sku_id: 'A',
      quantity: 2,
      unit_price_dong: 10000,
      unit_cost_dong: 2000,
      packaging_dong: 100,
      stock_units: 15,
    },
    {
      sku_id: 'B',
      quantity: 1,
      unit_price_dong: 15000,
      unit_cost_dong: 3000,
      packaging_dong: 100,
      stock_units: 100,
    },
  ];
  input.voucher = {
    type: 'percent',
    rate_bps: 5000,
    cap_dong: 10000,
    minimum_dong: 30000,
    seller_funding_bps: 10000,
  };
  const current = full(evaluate(input), 10000);
  assert.ok(current);
  for (const strategy of evaluate(input).strategies)
    for (const row of strategy.scenarios) assert.ok(row.orders <= 7);
});
test('platform funding changes seller spend, not buyer response', () => {
  const input = fixture();
  input.constraints = { budget_dong: 100_000_000, quota: 1000 };
  input.product.lines[0]!.stock_units = 1000;
  const seller: Voucher = {
    type: 'fixed',
    amount_dong: 10000,
    minimum_dong: 0,
    seller_funding_bps: 10000,
  };
  const platform: Voucher = { ...seller, seller_funding_bps: 0 };
  const result = evaluateVouchers(input, [seller, platform]);
  const rows = result.strategies.filter((s) => s.discount_dong === 10000);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.scenarios[1]!.orders, rows[1]!.scenarios[1]!.orders);
  assert.ok(rows.some((row) => row.scenarios[1]!.spend_dong === 0));
});
test('per-order monetary lines round before campaign aggregation and returns refund revenue/tax', () => {
  const input = fixture();
  input.product.lines = [
    {
      sku_id: 'A',
      quantity: 1,
      unit_price_dong: 40,
      unit_cost_dong: 0,
      packaging_dong: 0,
      stock_units: 2,
    },
  ];
  input.assumptions.visits = 2;
  input.assumptions.cvr_bps = 10000;
  input.assumptions.traffic = { low_bps: 10000, base_bps: 10000, high_bps: 10000 };
  input.economics = {
    fee_bps: 9875,
    tax_bps: 0,
    shipping_dong: 0,
    ads_dong: 0,
    return_rate_bps: 0,
    return_resale_bps: 10000,
    nonrefunded_fee_bps: 10000,
    return_shipping_dong: 0,
  };
  assert.equal(evaluate(input).strategies[0]!.scenarios[1]!.profit_dong, 0); // 39.5 fee rounds to 40 per order.
  input.economics = { ...input.economics, fee_bps: 0, tax_bps: 1000, return_rate_bps: 10000 };
  const row = evaluate(input).strategies[0]!.scenarios[1]!;
  assert.equal(row.revenue_dong, 0);
  assert.equal(row.profit_dong, 0);
  input.economics.return_shipping_dong = 3;
  assert.equal(evaluate(input).strategies[0]!.scenarios[1]!.profit_dong, -6);
});
test('semantic voucher duplicates do not inflate strategy count', () => {
  const input = fixture();
  const a: Voucher = {
    type: 'fixed',
    amount_dong: 10000,
    minimum_dong: 0,
    seller_funding_bps: 10000,
  };
  const b: Voucher = {
    type: 'percent',
    rate_bps: 10000,
    cap_dong: 10000,
    minimum_dong: 0,
    seller_funding_bps: 10000,
  };
  assert.equal(
    evaluateVouchers(input, [a, b]).strategies.filter((row) => row.discount_dong === 10000).length,
    1,
  );
});
test('scenario bounds hold across supply, conversion saturation, returns and funding edge cases', () => {
  const inputs: EvaluationInput[] = [];
  for (const cvr of [0, 2900, 10000])
    for (const stock of [0, 17, 500])
      for (const funding of [0, 10000]) {
        const input = fixture();
        input.assumptions.cvr_bps = cvr;
        input.product.lines[0]!.stock_units = stock;
        input.voucher.seller_funding_bps = funding;
        input.economics.return_rate_bps = 1234;
        inputs.push(input);
      }
  for (const input of inputs)
    for (const strategy of evaluate(input).strategies)
      for (const row of strategy.scenarios) {
        assert.ok(row.orders <= input.product.lines[0]!.stock_units);
        assert.ok(row.orders <= row.visits);
        assert.ok(row.redeemed <= row.orders);
        assert.ok(row.redeemed <= input.constraints.quota);
        assert.ok(row.spend_dong <= input.constraints.budget_dong);
        for (const key of [
          'orders',
          'redeemed',
          'spend_dong',
          'revenue_dong',
          'profit_dong',
        ] as const)
          assert.ok(Number.isSafeInteger(row[key]));
      }
});

test('fully funded uplift rounds total conversion once instead of erasing low-volume orders', () => {
  const input = fixture();
  input.product.lines = [
    {
      sku_id: 'A',
      quantity: 1,
      unit_price_dong: 100,
      unit_cost_dong: 0,
      packaging_dong: 0,
      stock_units: 100,
    },
  ];
  input.voucher = { type: 'fixed', amount_dong: 50, minimum_dong: 0, seller_funding_bps: 10000 };
  input.assumptions = {
    visits: 1,
    cvr_bps: 5000,
    traffic: { low_bps: 10000, base_bps: 10000, high_bps: 10000 },
    response_curve: [
      { discount_bps: 0, cvr_multiplier_bps: 10000 },
      { discount_bps: 5000, cvr_multiplier_bps: 20000 },
    ],
  };
  const current = full(evaluate(input), 50);
  for (const row of current.scenarios) {
    assert.equal(row.orders, 1);
    assert.equal(row.redeemed, 1);
  }
});

test('maximum supported basket money stays exact through full fees and total returns', () => {
  const input = fixture();
  input.product.lines = [
    {
      sku_id: 'BOUND',
      quantity: 1,
      unit_price_dong: 1_000_000_000,
      unit_cost_dong: 1_000_000_000,
      packaging_dong: 0,
      stock_units: 1_000_000,
    },
  ];
  input.assumptions.visits = 1_000_000;
  input.assumptions.cvr_bps = 10_000;
  input.assumptions.traffic = { low_bps: 10_000, base_bps: 10_000, high_bps: 10_000 };
  input.economics = {
    fee_bps: 10_000,
    tax_bps: 10_000,
    shipping_dong: 0,
    ads_dong: 0,
    return_rate_bps: 10_000,
    return_resale_bps: 0,
    nonrefunded_fee_bps: 10_000,
    return_shipping_dong: 0,
  };
  const baseline = evaluate(input).strategies.find((strategy) => strategy.discount_dong === 0)!;
  for (const row of baseline.scenarios) {
    assert.equal(row.profit_dong, -2_000_000_000_000_000);
    assert.equal(row.revenue_dong, 0);
    assert.equal(row.orders, 1_000_000);
  }
});
