import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {defaults,evaluate} from '../src/engine/index.js';
import {rankCandidates} from '../src/agent/recommend.mjs';

// Exercise the actual UI event handlers with a small DOM double, without a browser dependency.
const source=(await readFile(new URL('../../frontend/src/app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
function fixture(fetchImpl) {
 const nodes=new Map();
 function element() {
  const listeners=new Map();
  return {value:'',innerHTML:'',textContent:'',step:'1',
   addEventListener(type,handler){const list=listeners.get(type)??[];list.push(handler);listeners.set(type,list);},
   async emit(type){for(const handler of listeners.get(type)??[])await handler({preventDefault(){}});},
   replaceChildren(){this.innerHTML='';this.textContent='';},setAttribute(){},append(){},click(){}};
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 const form=get('inputs');
 form.elements=Object.fromEntries(Object.keys(defaults).map(key=>[key,element()]));
 form.checkValidity=form.reportValidity=()=>{
  const field=form.elements.value, value=Number(field.value);
  return value>=0 && value<=Number(field.max) && (field.step==='any' || Number.isInteger(value));
 };
 let exported;
 vm.runInNewContext(source,{
  defaults,evaluate,Blob,AbortController,Intl,Date,
  document:{querySelector:selector=>get(selector.slice(1)),getElementById:get,querySelectorAll:()=>[],createElement:element},
  FormData:class {constructor(){return Object.entries(form.elements).map(([key,field])=>[key,String(field.value)]);}},
  URL:{createObjectURL(blob){exported=blob;return 'blob:test';},revokeObjectURL(){}},
  setTimeout:()=>1,clearTimeout(){},fetch:fetchImpl
 });
 return {get,form,async exportPlan(){exported=null;await get('export').emit('click');return exported?JSON.parse(await exported.text()):null;}};
}
function proposal() {
 const candidates=rankCandidates(defaults,[{type:'fixed',value:1,cap:0,minimum:0}]);
 return {provider:'openai',model:'test-model',candidates,recommended:candidates[0],limitations:['Scenario only']};
}

test('UI accepts fractional percent vouchers and requires integer fixed amounts',async()=>{
 const ui=fixture();
 ui.form.elements.value.value='12.5';
 await ui.form.emit('change');
 assert.equal((await ui.exportPlan()).input.value,12.5);
 assert.equal(ui.form.elements.value.step,'any');
 ui.form.elements.type.value='fixed';
 await ui.form.emit('change');
 assert.equal(await ui.exportPlan(),null);
 ui.form.elements.value.value='12500';
 await ui.form.emit('change');
 assert.equal((await ui.exportPlan()).input.value,12500);
 await ui.get('reset').emit('click');
 assert.equal(ui.form.elements.value.step,'any');
});

test('plan export preserves the displayed AI winner, candidates and request context',async()=>{
 const data=proposal();let request;
 const ui=fixture(async(_url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>data};});
 ui.get('ai-context').value='Ưu tiên khách quay lại';
 await ui.get('ai-recommend').emit('click');
 const plan=await ui.exportPlan();
 assert.equal(plan.mode,'ai-assisted');
 assert.deepEqual(plan.recommended,data.recommended);
 assert.deepEqual(plan.ai.result,data);
 assert.deepEqual(plan.ai.input,request.input);
 assert.equal(plan.ai.context,request.context);
 assert.equal(plan.context,request.context);
 assert.deepEqual(plan.simulation,evaluate(defaults));
 assert.notEqual(plan.recommended.discount,plan.simulation.recommended.discount);
});

test('editing inputs or context, resetting and failed retries discard saved AI results',async()=>{
 let fail=false;
 const ui=fixture(async()=>({ok:!fail,json:async()=>fail?{error:'Provider unavailable'}:proposal()}));
 for(const action of ['input','context','reset','retry']) {
  await ui.get('ai-recommend').emit('click');
  assert.equal((await ui.exportPlan()).mode,'ai-assisted');
  if(action==='input'){ui.form.elements.price.value=300000;await ui.form.emit('input');}
  if(action==='context'){ui.get('ai-context').value='Bối cảnh mới';await ui.get('ai-context').emit('input');}
  if(action==='reset')await ui.get('reset').emit('click');
  if(action==='retry'){fail=true;await ui.get('ai-recommend').emit('click');}
  const plan=await ui.exportPlan();
  assert.equal(plan.ai,null,action);
  assert.equal(plan.mode,'deterministic-demo',action);
  assert.deepEqual(plan.recommended,plan.simulation.recommended,action);
 }
});

test('AI response arriving after an edit is not displayed or exported',async()=>{
 let resolveResponse;
 const ui=fixture(()=>new Promise(resolve=>{resolveResponse=resolve;}));
 const pending=ui.get('ai-recommend').emit('click');
 ui.get('ai-context').value='Changed while waiting';
 await ui.get('ai-context').emit('input');
 resolveResponse({ok:true,json:async()=>proposal()});
 await pending;
 assert.equal(ui.get('ai-output').innerHTML,'');
 assert.equal((await ui.exportPlan()).ai,null);
});
