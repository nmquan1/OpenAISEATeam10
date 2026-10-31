import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, defaults } from '../src/engine.js';
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
