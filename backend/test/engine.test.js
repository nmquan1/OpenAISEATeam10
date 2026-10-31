import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, defaults } from '../src/engine/index.js';
test('scenario is reproducible and respects inventory, quota and budget', () => {
 const input = {...defaults, stock:17, quota:3, budget:50000};
 assert.deepEqual(evaluate(input), evaluate(input));
 for (const s of evaluate(input).strategies) for (const r of s.scenarios) {
  assert.ok(r.orders <= input.stock);
  assert.ok(r.redeemed <= input.quota);
  assert.ok(r.spend <= input.budget);
  assert.ok(r.redeemed <= r.orders);
 }
});
test('ineligible basket and zero budget never subsidize orders', () => {
 for (const input of [{minimum:9999999}, {budget:0}]) {
  for (const s of evaluate(input).strategies) for (const r of s.scenarios) assert.equal(r.spend,0);
 }
});
test('discount cannot exceed selling price', () => {
 const result = evaluate({type:'fixed',value:9999999});
 for (const s of result.strategies) assert.ok(s.discount <= defaults.price);
});
test('invalid inputs fail before recommendation', () => {
 for (const input of [{price:0},{cost:-1},{traffic:NaN},{cvr:101},{low:10,base:1},{start:'invalid'},{risk:'unknown'}]) assert.throws(()=>evaluate(input));
});
test('safe ranking maximizes worst scenario profit', () => {
 const result=evaluate({risk:'safe'});
 assert.equal(result.recommended.worst,Math.max(...result.strategies.map(s=>s.worst)));
});

test('decimal conversion rates do not lose whole voucher redemptions', () => {
 const result=evaluate({price:100000,cost:0,fee:0,stock:100,traffic:100,cvr:29,low:1,base:1,high:1,uplift:0,type:'fixed',value:10000,minimum:0,quota:100,budget:1000000});
 const row=result.strategies.find(s=>s.id==='full').scenarios[1];
 assert.equal(row.orders,29);
 assert.equal(row.redeemed,29);
 assert.equal(row.spend,290000);
 assert.equal(row.profit,2610000);
});

test('conversion flooring preserves decimal boundaries, uplift and the visit cap', () => {
 const input={stock:1000000,traffic:10000,low:1,base:1,high:1,type:'fixed',value:1,minimum:0,quota:1000000,budget:1000000};
 for(const [cvr,uplift,expected] of [[0.29,0,29],[28.999999999999996,0,2899],[29,20,3480],[80,100,10000],[1e-7,1000,0]]) {
  const row=evaluate({...input,cvr,uplift}).strategies.find(s=>s.id==='full').scenarios[1];
  assert.equal(row.redeemed,expected,`${cvr}% + ${uplift}% uplift`);
 }
 const measured=evaluate({...input,cvr:29,uplift:20,value:10}).strategies.find(s=>s.id==='measured').scenarios[1];
 assert.equal(measured.redeemed,3248);
});

test('resource warnings reflect funding and stock constraints together', () => {
 const base={traffic:1000,cvr:9,low:1,base:1,high:1,uplift:100};
 const full=patch=>evaluate({...base,...patch}).strategies.find(s=>s.id==='full').scenarios[1];
 const unfunded=full({stock:100,budget:0});
 assert.equal(unfunded.orders,90);
 assert.equal(unfunded.stockout,false);
 assert.equal(unfunded.exhausted,true);
 const limitedStock=full({stock:10,quota:300,budget:100000000});
 assert.equal(limitedStock.stockout,true);
 assert.equal(limitedStock.exhausted,false);
 assert.equal(full({stock:100,quota:10,budget:100000000}).exhausted,true);
 assert.equal(full({stock:0,traffic:0}).stockout,false);
 assert.equal(full({stock:0,traffic:0}).exhausted,false);
 assert.equal(full({stock:0}).stockout,true);
 assert.equal(full({stock:0}).exhausted,false);
});
