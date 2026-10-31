import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createApp} from '../src/api/app.mjs';
import {defaults, evaluate} from '../src/engine/index.js';
import {HttpError} from '../src/api/http.mjs';

async function fixture(t, options = {}) {
  const logs = [];
  const server = createApp({logger:{error: entry=>logs.push(entry)}, ...options});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async()=>{server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));});
  const port = server.address().port;
  const request = (path, {method = 'GET', headers = {}, body} = {})=>new Promise((resolve,reject)=>{
    const req = http.request({hostname:'127.0.0.1',port,path,method,headers}, res=>{
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk=>{text += chunk;});
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text,json:()=>JSON.parse(text)}));
    });
    req.on('error',reject);
    req.end(body);
  });
  const post = (path, body, headers = {})=>request(path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  return {request,post,port,logs};
}

test('health and deterministic evaluation have stable HTTP contracts', async t=>{
  const {request,post} = await fixture(t);
  const health = await request('/api/health');
  assert.equal(health.status,200);
  assert.equal(health.json().mode,'scenario_only');
  assert.equal(health.headers['cache-control'],'no-store');
  assert.match(health.headers['x-request-id'],/^[\da-f-]{36}$/);
  const response = await post('/api/evaluate',{input:defaults});
  assert.equal(response.status,200);
  assert.deepEqual(response.json(),evaluate(defaults));
});

test('API rejects incomplete input, extra fields, coercion and invalid monetary/count values', async t=>{
  const {post} = await fixture(t);
  for (const body of [{},{input:{}},{input:null},{input:[]},{input:defaults,extra:true},
    {input:{...defaults,unknown:1}},{input:{...defaults,price:'299000'}},
    {input:{...defaults,cost:0.5}},{input:{...defaults,stock:0.5}},
    {input:{...defaults,scope:'all'}},{input:{...defaults,start:'2026-02-30T00:00'}}]) {
    const response = await post('/api/evaluate',body);
    assert.equal(response.status,422,JSON.stringify(body));
    const problem = response.json();
    assert.equal(problem.status,422);
    assert.equal(problem.instance,'/api/evaluate');
    assert.equal(problem.requestId,response.headers['x-request-id']);
    assert.match(response.headers['content-type'],/^application\/problem\+json/);
  }
});

test('routing reports missing routes and allowed methods',async t=>{
  const {request,post} = await fixture(t);
  const response = await request('/api/recommend');
  assert.equal(response.status,405);
  assert.equal(response.headers.allow,'POST');
  assert.equal((await request('/api/unknown')).status,404);
  assert.equal((await post('/',{})).status,405);
});

test('host and origin validation reject foreign browser origins and DNS rebinding hosts',async t=>{
  const {request,post,port} = await fixture(t);
  assert.equal((await request('/api/health',{headers:{host:`evil.example:${port}`}})).status,403);
  assert.equal((await post('/api/evaluate',{input:defaults},{origin:'https://evil.example'})).status,403);
  assert.equal((await post('/api/evaluate',{input:defaults},{origin:'null'})).status,403);
  assert.equal((await post('/api/evaluate',{input:defaults},{origin:`http://localhost:${port}`})).status,200);
});

test('JSON parser distinguishes malformed JSON, unsupported media and oversized input', async t=>{
  const {request} = await fixture(t);
  const send = (body, type='application/json')=>request('/api/evaluate',{method:'POST',headers:{'content-type':type},body});
  assert.equal((await send('{')).status,400);
  assert.equal((await send('')).status,400);
  assert.equal((await send('{}','text/plain')).status,415);
  assert.equal((await send(JSON.stringify({input:defaults}),'application/json; charset=utf-8')).status,200);
  assert.equal((await send(JSON.stringify({input:defaults,context:'x'.repeat(33000)}))).status,413);
});

test('static allowlist serves app modules while hiding credentials and backend files',async t=>{
  const {request} = await fixture(t);
  for (const path of ['/', '/src/app.js', '/src/style.css', '/engine/index.js', '/contracts/model.js']) {
    const response = await request(path);
    assert.equal(response.status,200,path);
    assert.equal(response.headers['x-content-type-options'],'nosniff');
    assert.equal(response.headers['x-frame-options'],'DENY');
    assert.match(response.headers['content-security-policy'],/script-src 'self'/);
  }
  const head = await request('/',{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(head.text,'');
  for (const path of ['/.env','/.git/config','/server/recommend.mjs','/package.json','/src/../.env','/%2e%2e/.env', '/src/engine.js', '/src/model.js', '/backend/src/api/app.mjs', '/backend/src/agent/recommend.mjs', '/backend/src/engine/index.js', '/frontend/src/app.js', '/contracts/README.md']) assert.equal((await request(path)).status,404,path);
});

test('configured API token protects computation and AI; health remains readable',async t=>{
  let calls = 0;
  const {request,post} = await fixture(t,{apiToken:'test-token',recommendImpl:async()=>{calls++; return {ok:true};}});
  assert.equal((await request('/api/health')).status,200);
  assert.equal((await post('/api/evaluate',{input:defaults})).status,401);
  assert.equal((await post('/api/recommend',{input:defaults},{authorization:'Bearer wrong'})).status,401);
  assert.equal(calls,0);
  assert.equal((await post('/api/recommend',{input:defaults},{authorization:'Bearer test-token'})).status,200);
  assert.equal(calls,1);
});

test('invalid recommendation input never reaches provider',async t=>{
  let calls = 0;
  const {post} = await fixture(t,{recommendImpl:async()=>{calls++; return {};}});
  for (const body of [{input:defaults,context:42},{input:defaults,context:'x'.repeat(10001)},{input:{...defaults,value:101}},{input:defaults,override:true}]) assert.equal((await post('/api/recommend',body)).status,422);
  assert.equal(calls,0);
});

test('AI concurrency is bounded and provider failure releases the slot',async t=>{
  let release;
  let entered;
  const ready = new Promise(resolve=>{entered=resolve;});
  let calls = 0;
  const {post} = await fixture(t,{recommendImpl:async()=>{
    calls++;
    if (calls === 1) {entered(); await new Promise(resolve=>{release=resolve;}); throw new HttpError(502,'Provider failed');}
    return {ok:true};
  }});
  const first = post('/api/recommend',{input:defaults});
  await ready;
  const busy = await post('/api/recommend',{input:defaults});
  assert.equal(busy.status,429);
  assert.equal(busy.headers['retry-after'],'60');
  // Local simulation remains available while an AI request runs.
  assert.equal((await post('/api/evaluate',{input:defaults})).status,200);
  release();
  assert.equal((await first).status,502);
  assert.equal((await post('/api/recommend',{input:defaults})).status,200);
});

test('HTTP errors distinguish configuration, timeout, gateway failure and hidden internal errors',async t=>{
  let error;
  const {post,logs} = await fixture(t,{recommendImpl:async()=>{throw error;}});
  for (const [failure,status] of [[new HttpError(503,'Not configured'),503],[new DOMException('Too slow','TimeoutError'),504],[new HttpError(502,'Provider failed'),502],[new Error('secret value must never appear'),500]]) {
    error = failure;
    const response = await post('/api/recommend',{input:defaults});
    assert.equal(response.status,status);
    assert.equal(response.json().status,status);
    assert.ok(!response.text.includes('secret value'));
  }
  assert.equal(logs.length,4);
  assert.ok(!JSON.stringify(logs).includes('secret value'));
});

test('request rate is bounded for each app instance',async t=>{
  const {post,request} = await fixture(t);
  for (let i=0;i<60;i++) assert.equal((await post('/api/evaluate',{input:defaults})).status,200);
  const blocked = await post('/api/evaluate',{input:defaults});
  assert.equal(blocked.status,429);
  assert.equal(blocked.headers['retry-after'],'60');
  assert.equal((await request('/api/health')).status,200);
});


test('browser entry and transitive ES modules resolve through the public source routes', async t=>{
  const {request} = await fixture(t);
  const html = await request('/');
  assert.equal(html.status,200);
  const scripts = [...html.text.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/g)].map(match=>new URL(match[1],'http://localhost/').pathname);
  assert.deepEqual(scripts,['/src/app.js']);
  const styles = [...html.text.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match=>new URL(match[1],'http://localhost/').pathname);
  assert.deepEqual(styles,['/src/style.css']);
  for (const path of styles) {
    const asset=await request(path);
    assert.equal(asset.status,200,path);
    assert.match(asset.headers['content-type'],/^text\/css/);
  }
  const visited = new Set();
  const queue = [...scripts];
  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    const asset = await request(path);
    assert.equal(asset.status,200,`Browser dependency unavailable: ${path}`);
    assert.match(asset.headers['content-type'],/^text\/javascript/,path);
    const imports = [...asset.text.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)].map(match=>match[1]);
    for (const specifier of imports) {
      assert.ok(specifier.startsWith('.'),`Browser module must not import a Node/bare dependency: ${specifier}`);
      queue.push(new URL(specifier,`http://localhost${path}`).pathname);
    }
  }
  assert.deepEqual([...visited].sort(),['/contracts/fee-catalog.js','/contracts/model.js','/engine/fees.js','/engine/index.js','/engine/portfolio.js','/src/app.js']);
});

test('strategy route returns a validated multi-voucher portfolio and merged outputs carry it', async t=>{
  const {post} = await fixture(t);
  const body = {customers:8000, vouchers:2500, products:[{name:'Serum Vitamin C 30ml',price:350000,cost:120000,category:'beauty'},{name:'Bông tẩy trang 120 miếng',price:45000,cost:33000,category:'beauty'}]};
  const ok = await post('/api/strategy', body);
  assert.equal(ok.status, 200);
  assert.equal(ok.json().catalog_version, 'fees@2026-10-31');
  assert.equal(ok.json().vouchers.reduce((s,v)=>s + v.qty, 0), 2500);
  assert.equal((await post('/api/strategy', {...body, products:[{name:'x',price:1,category:'cars'}]})).status, 422);
  const merged = await post('/api/evaluate', {input:{...defaults, category:'beauty'}});
  assert.equal(merged.status, 200);
  assert.equal(merged.json().fees.catalog_version, 'fees@2026-10-31');
  assert.ok(merged.json().portfolio.status);
});
