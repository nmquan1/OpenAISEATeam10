import test from 'node:test';
import assert from 'node:assert/strict';
import { planPortfolio } from '../src/engine/portfolio.ts';
import { parseStrategyRequest } from '../../contracts/portfolio.ts';
import { ValidationError } from '../../contracts/model.ts';

// docs/agent-strategy/examples/beauty-mock-input.json with the beauty category.
const request = {
  customers: 8000,
  vouchers: 2500,
  products: [
    { name: 'Serum Vitamin C 30ml', price: 350000, cost: 120000, category: 'beauty' },
    { name: 'Kem chống nắng SPF50', price: 280000, category: 'beauty' },
    { name: 'Sữa rửa mặt dịu nhẹ', price: 159000, cost: 95000, category: 'beauty' },
    { name: 'Mặt nạ giấy (hộp 10)', price: 199000, category: 'beauty' },
    { name: 'Bông tẩy trang 120 miếng', price: 45000, cost: 33000, category: 'beauty' },
  ],
};
// docs/agent-strategy/01-strategy-engine.md fashion example.
const fashion = {
  customers: 3000,
  vouchers: 600,
  products: [
    { name: 'Áo thun basic', price: 199000, cost: 99000, category: 'fashion' },
    { name: 'Quần jean', price: 499000, cost: 275000, category: 'fashion' },
    { name: 'Tất cổ ngắn', price: 49000, category: 'fashion' },
  ],
};

test('portfolio is deterministic and allocates exactly the voucher budget', () => {
  const a = planPortfolio(parseStrategyRequest(request)),
    b = planPortfolio(parseStrategyRequest(request));
  assert.deepEqual(a, b);
  assert.equal(a.status, 'ok');
  assert.equal(
    a.vouchers.reduce((s, v) => s + v.qty, 0),
    2500,
  );
  for (const v of a.vouchers) assert.ok(v.qty >= 0 && Number.isSafeInteger(v.qty));
});

test('verified fees exclude low-headroom products from percent vouchers', () => {
  const r = planPortfolio(parseStrategyRequest(request));
  assert.ok(r.excluded_from_pct.includes('Bông tẩy trang 120 miếng'));
  assert.ok(r.assumptions.inferred.includes('cost:Mặt nạ giấy (hộp 10)'));
});

test('no feasible voucher is reported instead of forcing one (fashion example at 20% floor)', () => {
  const r = planPortfolio(parseStrategyRequest(fashion));
  assert.equal(r.status, 'no_feasible_strategy');
  assert.deepEqual(r.vouchers, []);
  assert.ok(r.excluded_from_pct.includes('Quần jean'));
});

test('every kept stack passes the floor on its worst basket', () => {
  const r = planPortfolio(parseStrategyRequest(request));
  const kept = new Set(r.vouchers.map((v) => v.code));
  for (const w of r.worst_stack)
    if (w.stack.every((c) => kept.has(c)) && r.matrix[w.stack[0]]?.[w.stack[1]] !== 'no') {
      if (w.stack.length === 1) assert.ok(w.pass, w.stack.join('+'));
    }
  for (const [a, row] of Object.entries(r.matrix))
    for (const [b, v] of Object.entries(row)) assert.equal(r.matrix[b][a], v);
});

test('heavy voucher coverage is warned', () => {
  const r = planPortfolio(parseStrategyRequest({ ...request, vouchers: 4000 }));
  assert.ok(r.warnings.some((w) => w.includes('dạy')));
});

test('strategy request rejects unknown categories and malformed products', () => {
  for (const body of [
    { ...request, products: [] },
    { ...request, products: [{ name: 'x', price: 1, category: 'cars' }] },
    { ...request, products: [{ name: 'x', price: 1.5, category: 'beauty' }] },
    { ...request, extra: 1 },
    { ...request, floor: 95 },
  ]) {
    assert.throws(() => parseStrategyRequest(body), ValidationError);
  }
});

test('defaults and zero-customer coverage remain explicit without NaN', () => {
  const result = planPortfolio({ ...request, customers: 0 });
  assert.equal(result.assumptions.floor_pct, 20);
  assert.equal(result.assumptions.programme, 'standard');
  assert.equal(result.mode, 'heuristic_only');
  assert.ok(result.warnings.some((warning) => warning.includes('Chưa có số khách')));
  assert.ok(!JSON.stringify(result).includes('null'));
});

test('large threshold with a cheap eligible item avoids allocating one object per unit', () => {
  const result = planPortfolio({
    customers: 100,
    vouchers: 10,
    floor: 0,
    products: [
      { name: 'Cheap', price: 5000, cost: 0, category: 'beauty' },
      { name: 'High A', price: 1000000000, cost: 1, category: 'beauty' },
      { name: 'High B', price: 1000000000, cost: 1, category: 'beauty' },
    ],
  });
  assert.ok(result.assumptions.min_order > 1000000000);
  assert.equal(
    result.vouchers.reduce((sum, voucher) => sum + voucher.qty, 0),
    10,
  );
  assert.ok(result.worst_stack.every((row) => Number.isSafeInteger(row.cm_bps)));
});

test('portfolio engine validates direct callers and fractional integer fields', () => {
  for (const body of [
    { ...request, customers: '8000' },
    { ...request, vouchers: 1.5 },
    { ...request, programme: 'unknown' },
  ])
    assert.throws(() => planPortfolio(body), ValidationError);
});

test('tiny prices and large losses remain valid inputs with a finite headroom estimate', () => {
  const result = planPortfolio({
    products: [{ name: '__proto__', price: 1, cost: 1000000000, category: 'beauty' }],
    customers: 0,
    vouchers: 0,
    floor: 75.49,
  });
  assert.equal(result.status, 'no_feasible_strategy');
  assert.equal(result.products[0]!.name, '__proto__');
  assert.ok(Number.isFinite(result.products[0]!.d_max));
  assert.deepEqual(result.vouchers, []);
  assert.deepEqual(result.matrix, {});
});

test('decimal floors round half up to basis points and zero voucher allocations stay zero', () => {
  for (const [floor, normalized] of [
    [1.005, 1.01],
    [20.005, 20.01],
    [0.00000001, 0],
  ]) {
    const result = planPortfolio({ ...request, vouchers: 0, floor });
    assert.equal(result.assumptions.floor_pct, normalized);
    assert.equal(
      result.vouchers.reduce((sum, voucher) => sum + voucher.qty, 0),
      0,
    );
  }
});

test('prototype-like categories and extra JSON keys cannot enter the catalog lookup', () => {
  for (const category of ['__proto__', 'constructor', 'toString']) {
    assert.throws(
      () =>
        planPortfolio({
          ...request,
          products: [{ name: category, price: 100000, category }],
        }),
      ValidationError,
    );
  }
  const payload = JSON.parse(JSON.stringify(request));
  Object.defineProperty(payload.products[0], '__proto__', {
    value: { polluted: true },
    enumerable: true,
  });
  assert.throws(() => planPortfolio(payload), ValidationError);
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false);
});
