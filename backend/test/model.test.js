import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults, parseInput, parseRequest, ValidationError} from '../../contracts/model.js';
import {evaluate} from '../src/engine/index.js';
import {rankCandidates, recommend} from '../src/agent/recommend.mjs';

test('contract rejects non-object input, unknown fields and coercion', () => {
  for (const input of [null, [], 'campaign', 0, {price:'299000'}, {stock:true}, {fee:Infinity}, {budget:NaN}, {extra:'ignored'}, JSON.parse('{"__proto__":{}}')]) {
    assert.throws(()=>parseInput(input), ValidationError);
  }
  assert.deepEqual(parseInput(), defaults);
});

test('money and inventory are integer units, with percentage precision retained', () => {
  for (const field of ['price','cost','stock','traffic','cap','minimum','quota','budget']) {
    assert.throws(()=>parseInput({[field]:1.5}), ValidationError, field);
    assert.throws(()=>parseInput({[field]:-1}), ValidationError, field);
    assert.throws(()=>parseInput({[field]:Number.MAX_SAFE_INTEGER + 1}), ValidationError, field);
  }
  assert.throws(()=>parseInput({type:'fixed',value:1.5}), ValidationError);
  assert.equal(parseInput({type:'percent',value:12.5}).value, 12.5);
  assert.throws(()=>parseInput({type:'percent',value:100.01}), ValidationError);
});

test('API requests require complete input and reject unrecognized request fields', () => {
  for (const body of [{}, {input:{}}, {input:defaults,products:[]}, {input:{...defaults,currency:'USD'}}]) {
    assert.throws(()=>parseRequest(body), ValidationError);
  }
  assert.deepEqual(parseRequest({input:defaults}), {input:defaults});
  assert.throws(()=>parseRequest({input:defaults,context:'x'}), ValidationError);
  assert.equal(parseRequest({input:defaults,context:'x'.repeat(10000)}, {context:true}).context.length,10000);
  for (const context of [null, [], {}, 4, 'x'.repeat(10001)]) {
    assert.throws(()=>parseRequest({input:defaults,context}, {context:true}), ValidationError);
  }
});

test('campaign calendar validation rejects normalization, offsets and reversed windows', () => {
  for (const start of ['2026-02-30T12:00', '2026-11-11T24:00', '2026-11-11T00:00Z', '2026-11-11T00:00+07:00', '2026-1-01T01:00']) {
    assert.throws(()=>parseInput({start}), ValidationError, start);
  }
  assert.throws(()=>parseInput({end:defaults.start}), ValidationError);
  assert.throws(()=>parseInput({end:'2026-11-10T00:00'}), ValidationError);
  assert.equal(parseInput({start:'2028-02-29T00:00',end:'2028-03-01T00:00'}).start,'2028-02-29T00:00');
});

test('model enforces text, scope, traffic ordering and enum contracts', () => {
  for (const input of [{name:''}, {name:' '.repeat(3)}, {name:'x'.repeat(101)}, {code:'x'.repeat(31)}, {code:null}, {scope:'cart'}, {risk:'maximum'}, {type:'cashback'}, {low:4,base:3}, {base:6,high:5}, {cvr:100.1}, {fee:100.1}]) {
    assert.throws(()=>parseInput(input), ValidationError);
  }
});

test('scenario totals reconcile and remain bounded under zero supply and exhausted funding', () => {
  for (const patch of [{stock:0}, {quota:0}, {budget:0}, {traffic:0}, {cvr:0}, {fee:100}, {price:1001,cost:2000,type:'percent',value:12.5,cap:1000}, {stock:17,quota:3,budget:15000}]) {
    const result=evaluate(patch), x=result.input;
    for (const strategy of result.strategies) for (const row of strategy.scenarios) {
      assert.equal(row.revenue, row.orders*x.price-row.spend);
      assert.equal(row.spend, row.redeemed*strategy.discount);
      assert.ok(row.orders>=0 && row.orders<=x.stock);
      assert.ok(row.redeemed>=0 && row.redeemed<=row.orders && row.redeemed<=x.quota);
      assert.ok(row.spend<=x.budget);
      for (const key of ['orders','redeemed','spend','revenue','profit']) assert.ok(Number.isSafeInteger(row[key]),key);
    }
  }
});

test('unsafe aggregate money is rejected before it can become a misleading result', () => {
  assert.throws(()=>evaluate({price:1e9,cost:1e9,stock:1e7,traffic:1e7,cvr:100,low:1,base:1,high:1}), ValidationError);
});

test('AI candidates cannot modify seller constraints and all results are recalculated', () => {
  const voucher={type:'percent',value:50,cap:10000,minimum:20000};
  for (const invalid of [{...voucher,budget:1e9}, {...voucher,type:'cashback'}, {...voucher,cap:0.1}, {...voucher,minimum:0.1}, {...voucher,value:101}, {...voucher,value:'50'}]) {
    assert.throws(()=>rankCandidates(defaults,[invalid]));
  }
  for (const candidate of rankCandidates(defaults,[voucher])) {
    const recalculated=evaluate({...defaults,...candidate.voucher}).strategies.find(row=>row.id==='full');
    assert.deepEqual(candidate.scenarios,recalculated.scenarios);
    assert.equal(candidate.score,recalculated.score);
  }
});

test('equivalent AI vouchers are deduplicated independently of JSON key order', () => {
  const a={type:'percent',value:50,cap:10000,minimum:20000};
  const b={minimum:20000,cap:10000,value:50,type:'percent'};
  const rows=rankCandidates(defaults,[a,b]);
  assert.equal(rows.filter(row=>row.voucher.type==='percent' && row.voucher.value===50).length,1);
});

test('provider contract rejects incomplete, malformed and extra-field proposals', async () => {
  for (const proposal of [{candidates:[]}, {candidates:[{type:'fixed',value:1,cap:0,minimum:0}],price:1}, null]) {
    await assert.rejects(recommend({input:defaults}, {env:{OPENAI_API_KEY:'test-only'},fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(proposal)}]}]})})}),error=>error.status===502);
  }
});

test('negative half-dong profit rounds away from zero consistently with positive money', () => {
  const result=evaluate({price:1,cost:1,fee:50,stock:1,traffic:1,cvr:100,low:1,base:1,high:1,type:'fixed',value:0,minimum:0});
  for (const strategy of result.strategies) for (const row of strategy.scenarios) assert.equal(row.profit,-1);
});

test('malformed provider envelopes are gateway failures rather than internal errors', async () => {
  for (const output of [{}, [null], [{content:{}}], [{content:[null]}]]) {
    await assert.rejects(recommend({input:defaults}, {env:{OPENAI_API_KEY:'test-only'},fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output})})}),error=>error.status===502);
  }
});
