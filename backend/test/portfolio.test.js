import test from 'node:test';
import assert from 'node:assert/strict';
import {planPortfolio} from '../src/engine/portfolio.js';
import {parseStrategyRequest, ValidationError} from '../../contracts/model.js';

// docs/agent-strategy/examples/beauty-mock-input.json with the beauty category.
const request = {
  customers:8000, vouchers:2500,
  products:[
    {name:'Serum Vitamin C 30ml', price:350000, cost:120000, category:'beauty'},
    {name:'Kem chống nắng SPF50', price:280000, category:'beauty'},
    {name:'Sữa rửa mặt dịu nhẹ', price:159000, cost:95000, category:'beauty'},
    {name:'Mặt nạ giấy (hộp 10)', price:199000, category:'beauty'},
    {name:'Bông tẩy trang 120 miếng', price:45000, cost:33000, category:'beauty'}
  ]
};
// docs/agent-strategy/01-strategy-engine.md fashion example.
const fashion = {
  customers:3000, vouchers:600,
  products:[
    {name:'Áo thun basic', price:199000, cost:99000, category:'fashion'},
    {name:'Quần jean', price:499000, cost:275000, category:'fashion'},
    {name:'Tất cổ ngắn', price:49000, category:'fashion'}
  ]
};

test('portfolio is deterministic and allocates exactly the voucher budget', () => {
  const a = planPortfolio(parseStrategyRequest(request)), b = planPortfolio(parseStrategyRequest(request));
  assert.deepEqual(a, b);
  assert.equal(a.status, 'ok');
  assert.equal(a.vouchers.reduce((s,v)=>s + v.qty, 0), 2500);
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
  const kept = new Set(r.vouchers.map(v=>v.code));
  for (const w of r.worst_stack) if (w.stack.every(c=>kept.has(c)) && r.matrix[w.stack[0]]?.[w.stack[1]] !== 'no') {
    if (w.stack.length === 1) assert.ok(w.pass, w.stack.join('+'));
  }
  for (const [a,row] of Object.entries(r.matrix)) for (const [b,v] of Object.entries(row)) assert.equal(r.matrix[b][a], v);
});

test('heavy voucher coverage is warned', () => {
  const r = planPortfolio(parseStrategyRequest({...request, vouchers:4000}));
  assert.ok(r.warnings.some(w=>w.includes('dạy')));
});

test('strategy request rejects unknown categories and malformed products', () => {
  for (const body of [{...request, products:[]}, {...request, products:[{name:'x', price:1, category:'cars'}]}, {...request, products:[{name:'x', price:1.5, category:'beauty'}]}, {...request, extra:1}, {...request, floor:95}]) {
    assert.throws(()=>parseStrategyRequest(body), ValidationError);
  }
});
