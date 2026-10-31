import test from 'node:test';
import assert from 'node:assert/strict';
import { recommend,rankCandidates } from '../src/agent/recommend.mjs';
import {defaults} from '../src/engine/index.js';
const voucher={type:'percent',value:50,cap:10000,minimum:20000};
test('50 percent capped at 10k respects cap and budget',()=>{
 const rows=rankCandidates(defaults,[voucher]);
 const s=rows.find(s=>s.voucher.value===50);
 assert.equal(s.discount,10000);
 for(const r of s.scenarios)assert.ok(r.spend<=defaults.budget);
});
test('reject model attempts to inject inputs and invalid discounts',()=>{
 assert.throws(()=>rankCandidates(defaults,[{...voucher,stock:999}]));
 assert.throws(()=>rankCandidates(defaults,[{...voucher,value:101}]));
 assert.throws(()=>rankCandidates(defaults,[]));
});
test('missing credentials explicit, no mock fallback',async()=>{
 await assert.rejects(recommend({input:defaults},{env:{}}),/OPENAI_API_KEY/);
});
test('Responses transport uses structured output and deterministic ranking',async()=>{
 const result=await recommend({input:defaults,context:'Skincare; existing customers'}, {env:{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'},fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(options.body);assert.equal(body.text.format.strict,true);assert.equal(body.store,false);
  return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({candidates:[voucher]})}]}]})};
 }});
 assert.equal(result.provider,'openai');assert.equal(result.recommended.score,Math.max(...result.candidates.map(c=>c.score)));
});
test('provider failures and incomplete responses never become recommendations',async()=>{
 for(const reply of [{ok:false,status:401},{ok:true,json:async()=>({status:'incomplete'})},{ok:true,json:async()=>({status:'completed',output:[]})}])await assert.rejects(recommend({input:defaults},{env:{OPENAI_API_KEY:'test-only'},fetchImpl:async()=>reply}));
});
