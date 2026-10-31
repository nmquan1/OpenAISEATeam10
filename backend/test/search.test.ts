import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaults,
  type EvaluationInput,
  type Strategy,
  type Voucher,
} from '../../contracts/model.ts';
import { evaluate, evaluateVouchers } from '../src/engine/index.ts';
import {
  searchVouchers,
  hybridSearchVouchers,
  voucherEconomicId,
  evaluateCandidate,
} from '../src/engine/search.ts';

function smallInput(price: number, objective: EvaluationInput['objective']): EvaluationInput {
  const input = structuredClone(defaults);
  input.product.lines = [
    {
      sku_id: 'SMALL',
      quantity: 1,
      unit_price_dong: price,
      unit_cost_dong: Math.floor(price / 3),
      packaging_dong: 0,
      stock_units: 700,
    },
  ];
  input.voucher = {
    type: 'percent',
    rate_bps: 2300,
    cap_dong: price,
    minimum_dong: 0,
    seller_funding_bps: 7500,
  };
  input.objective = objective;
  input.assumptions.response_curve = [
    { discount_bps: 0, cvr_multiplier_bps: 10000 },
    { discount_bps: 2000, cvr_multiplier_bps: 25000 },
    { discount_bps: 6000, cvr_multiplier_bps: 30000 },
  ];
  input.constraints = { budget_dong: 1700, quota: 100 };
  return input;
}
const ranking = (a: Strategy, b: Strategy) =>
  b.score - a.score || a.discount_dong - b.discount_dong || a.id.localeCompare(b.id);
/** Independent brute force enumerates every integer discount; engine performs all economics. */
function bruteForce(input: EvaluationInput, maximum: number) {
  const scored: Strategy[] = [];
  for (let amount = 0; amount <= maximum; amount++) {
    const candidate: Voucher = {
      type: 'fixed',
      amount_dong: amount,
      minimum_dong: 0,
      seller_funding_bps: input.voucher.seller_funding_bps,
    };
    const strategy = evaluateVouchers(input, [candidate]).strategies.find(
      (row) => row.discount_dong === amount,
    );
    assert.ok(strategy);
    scored.push(strategy);
  }
  return scored.sort(ranking).slice(0, 5);
}
test('bounded exhaustive small domains match independent brute-force winner and top five', () => {
  for (const [price, objective] of [
    [40, 'safe'],
    [83, 'balanced'],
    [251, 'growth'],
  ] as const) {
    const input = smallInput(price, objective);
    const result = searchVouchers(input);
    assert.equal(result.exhaustive_integer_search, true);
    assert.equal(result.evaluation_count, price + 1);
    assert.deepEqual(
      result.strategies.map((row) => [row.id, row.score]),
      bruteForce(input, price).map((row) => [row.id, row.score]),
    );
  }
});
test('large-basket search stays bounded, deterministic, distinct and at least baseline', () => {
  const input = structuredClone(defaults);
  const first = searchVouchers(input);
  const second = searchVouchers(input);
  assert.ok(first.evaluation_count <= 1000);
  assert.ok(first.engine_calls <= 1000);
  assert.ok(first.recommended.score >= evaluate(input).recommended.score);
  assert.equal(new Set(first.strategies.map((row) => row.id)).size, 5);
  assert.deepEqual(first.strategies, second.strategies);
  assert.equal(first.exhaustive_integer_search, false);
  for (const strategy of first.strategies) {
    assert.equal(strategy.voucher.seller_funding_bps, input.voucher.seller_funding_bps);
    assert.equal(voucherEconomicId(input, strategy.voucher), strategy.id);
  }
  for (const baseline of evaluate(input).strategies)
    assert.ok(first.evaluated_discounts_dong.includes(baseline.discount_dong));
  assert.ok(searchVouchers(input, { maxEvaluations: 5 }).evaluation_count <= 5);
  assert.throws(() => searchVouchers(input, { maxEvaluations: 4 }));
});
test('zero budget, zero funding, zero stock, and ineligible current vouchers preserve exact constraints', () => {
  for (const variant of ['zero-budget', 'zero-funding', 'zero-stock', 'ineligible'] as const) {
    const input = smallInput(80, 'balanced');
    if (variant === 'zero-budget') input.constraints.budget_dong = 0;
    if (variant === 'zero-funding') input.voucher.seller_funding_bps = 0;
    if (variant === 'zero-stock') input.product.lines[0]!.stock_units = 0;
    if (variant === 'ineligible') input.voucher.minimum_dong = 1000;
    const result = searchVouchers(input);
    assert.ok(result.recommended.score >= evaluate(input).recommended.score);
    assert.deepEqual(
      result.strategies.map((row) => row.id),
      bruteForce(input, 80).map((row) => row.id),
    );
    assert.ok(result.evaluated_discounts_dong.includes(0));
    for (const strategy of result.strategies)
      for (const scenario of strategy.scenarios) {
        assert.ok(scenario.spend_dong <= input.constraints.budget_dong);
        assert.ok(scenario.redeemed <= input.constraints.quota);
        assert.ok(scenario.orders <= input.product.lines[0]!.stock_units);
      }
  }
});
test('candidate lookup scores zero/measured equivalents directly; hybrid rejects funding override', () => {
  const input = smallInput(80, 'balanced');
  for (const strategy of evaluate(input).strategies)
    assert.equal(evaluateCandidate(input, strategy.voucher).score, strategy.score);
  const valid: Voucher = {
    type: 'fixed',
    amount_dong: 15,
    minimum_dong: 0,
    seller_funding_bps: input.voucher.seller_funding_bps,
  };
  const result = hybridSearchVouchers(input, [
    valid,
    valid,
    { ...valid, seller_funding_bps: 0 },
    { ...valid, amount_dong: -1 },
  ]);
  assert.equal(result.accepted_ai_candidates, 2);
  assert.equal(result.rejected_ai_candidates, 2);
  assert.equal(result.additional_ai_engine_calls, 2);
  assert.ok(result.recommended.score >= result.search_only_score);
  assert.equal(new Set(result.strategies.map((row) => row.id)).size, result.strategies.length);
  assert.throws(() => hybridSearchVouchers(input, Array(6).fill(valid)));
});
