import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp, type AppOptions } from '../src/api/app.ts';
import { JsonRunStore } from '../src/store/index.ts';
import { defaults } from '../../contracts/model.ts';
async function fixture(t: test.TestContext, options: AppOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'market-maker-api-'));
  const app = await buildApp({
    store: new JsonRunStore(join(directory, 'runs.json')),
    logger: false,
    ...options,
  });
  await app.ready();
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  const post = (path: string, payload: unknown) =>
    app.inject({
      method: 'POST',
      url: path,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
  return { app, post, directory };
}
test('OpenAPI documents typed requests and interactive docs are available', async (t) => {
  const { app } = await fixture(t);
  const docs = await app.inject('/api/docs/');
  assert.equal(docs.statusCode, 200);
  const spec = await app.inject('/api/docs/json');
  assert.equal(spec.statusCode, 200);
  const json = spec.json();
  assert.equal(json.openapi, '3.0.3');
  for (const path of [
    '/api/health',
    '/api/evaluate',
    '/api/recommend',
    '/api/runs',
    '/api/runs/{id}',
  ])
    assert.ok(json.paths[path], path);
  assert.ok(json.paths['/api/evaluate'].post.requestBody);
});
test('evaluation validates complete v2 inputs and persists shared history', async (t) => {
  const { app, post } = await fixture(t);
  const result = await post('/api/evaluate', { input: defaults });
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(result.json().schema_version, '2.0');
  const list = await app.inject('/api/runs');
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().runs.length, 1);
  assert.equal(list.json().runs[0].userId, undefined);
  const detail = await app.inject(`/api/runs/${list.json().runs[0].id}`);
  assert.equal(detail.statusCode, 200);
  assert.deepEqual(detail.json().input, defaults);
  for (const body of [
    {},
    { input: {} },
    { input: { ...defaults, extra: 1 } },
    { input: defaults, extra: 1 },
  ])
    assert.equal((await post('/api/evaluate', body)).statusCode, 422);
  assert.equal(
    (await app.inject('/api/runs/00000000-0000-4000-8000-000000000000')).statusCode,
    404,
  );
});
test('health exposes readiness flags without secrets and no-key AI fails explicitly', async (t) => {
  const { app, post } = await fixture(t);
  const health = await app.inject('/api/health');
  assert.deepEqual(health.json(), {
    status: 'ok',
    schema_version: '2.0',
    mode: 'scenario_only',
    aiConfigured: false,
    modelConfigured: false,
  });
  const result = await post('/api/recommend', { input: defaults, context: { seller_notes: '' } });
  assert.equal(result.statusCode, 503);
});
test('foreign hosts and origins are rejected without a login requirement', async (t) => {
  const { app } = await fixture(t);
  assert.equal(
    (await app.inject({ url: '/api/health', headers: { host: 'evil.example' } })).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: '/api/health', headers: { origin: 'https://evil.example' } }))
      .statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: '/api/health', headers: { origin: 'http://localhost:5173' } }))
      .statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: '/api/runs', remoteAddress: '203.0.113.1' })).statusCode,
    200,
  );
});
test('JSON media type and byte limits are enforced', async (t) => {
  const { app } = await fixture(t);
  assert.equal(
    (
      await app.inject({
        url: '/api/evaluate',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        payload: '{',
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        url: '/api/evaluate',
        method: 'POST',
        headers: { 'content-type': 'application/xml' },
        payload: '<x/>',
      })
    ).statusCode,
    415,
  );
  assert.equal(
    (
      await app.inject({
        url: '/api/evaluate',
        method: 'POST',
        payload: { input: defaults, extra: 'x'.repeat(33000) },
      })
    ).statusCode,
    413,
  );
});
test('static serving exposes only built frontend assets, never backend source', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'market-maker-static-'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<html>MVP</html>');
  await writeFile(join(directory, 'assets', 'app.js'), 'console.log(1)');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { app } = await fixture(t, { frontendRoot: directory });
  assert.equal((await app.inject('/')).statusCode, 200);
  assert.equal((await app.inject('/assets/app.js')).statusCode, 200);
  for (const path of [
    '/.env',
    '/backend/src/agent/recommend.ts',
    '/contracts/model.ts',
    '/src/app.js',
    '/.git/config',
  ])
    assert.equal((await app.inject(path)).statusCode, 404, path);
});
test('separate simulation quota does not consume AI quota', async (t) => {
  const { post } = await fixture(t);
  for (let n = 0; n < 60; n++)
    assert.equal((await post('/api/evaluate', { input: defaults })).statusCode, 200);
  assert.equal((await post('/api/evaluate', { input: defaults })).statusCode, 429);
  assert.equal(
    (await post('/api/recommend', { input: defaults, context: { seller_notes: '' } })).statusCode,
    503,
  );
});
test('configured CORS supports browser JSON preflight', async (t) => {
  const { app } = await fixture(t);
  const response = await app.inject({
    method: 'OPTIONS',
    url: '/api/recommend',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.match(String(response.headers['access-control-allow-headers']), /Content-Type/);
});
test('concurrent shared AI calls reserve capacity before awaiting durable quota and release on failure', async (t) => {
  let release: () => void = () => {};
  let entered: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const { post } = await fixture(t, {
    aiConfigured: true,
    recommendImpl: async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      throw Object.assign(new Error('Provider unavailable'), { status: 502 });
    },
  });
  const first = post('/api/recommend', { input: defaults, context: { seller_notes: '' } });
  const pending = Promise.resolve(first);
  await ready;
  assert.equal(
    (await post('/api/recommend', { input: defaults, context: { seller_notes: '' } })).statusCode,
    429,
  );
  release();
  assert.equal((await pending).statusCode, 502);
});
test(
  'client disconnect cancels the provider request instead of retaining paid work',
  { timeout: 5000 },
  async (t) => {
    const { request } = await import('node:http');
    let entered: () => void = () => {};
    let aborted: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const canceled = new Promise<void>((resolve) => {
      aborted = resolve;
    });
    const { app } = await fixture(t, {
      aiConfigured: true,
      recommendImpl: async (_body, { signal }) => {
        entered();
        await new Promise<void>((_resolve, reject) =>
          signal.addEventListener(
            'abort',
            () => {
              aborted();
              reject(signal.reason);
            },
            { once: true },
          ),
        );
        throw new Error('Unreachable');
      },
    });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const client = request(`${address}/api/recommend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    client.on('error', () => undefined);
    client.end(JSON.stringify({ input: defaults, context: { seller_notes: '' } }));
    await ready;
    client.destroy();
    await canceled;
  },
);
test('daily AI attempts survive provider failures and enforce a durable workspace ceiling', async (t) => {
  let calls = 0;
  const { post } = await fixture(t, {
    aiConfigured: true,
    dailyAiLimit: 1,
    recommendImpl: async () => {
      calls++;
      throw Object.assign(new Error('Provider unavailable'), { status: 502 });
    },
  });
  assert.equal(
    (await post('/api/recommend', { input: defaults, context: { seller_notes: '' } })).statusCode,
    502,
  );
  assert.equal(
    (await post('/api/recommend', { input: defaults, context: { seller_notes: '' } })).statusCode,
    429,
  );
  assert.equal(calls, 1);
});
test('CSV endpoint validates history and never invents calibrated inputs', async (t) => {
  const { post } = await fixture(t);
  const response = await post('/api/history/validate', {
    csv: 'label,visits,orders,revenue_dong,voucher_spend_dong\nSale,100,10,1000000,50000',
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().source, 'user_reported');
  assert.equal(response.json().campaigns[0].orders, 10);
  assert.equal(
    (
      await post('/api/history/validate', {
        csv: 'label,visits,orders,revenue_dong,voucher_spend_dong\nSale,1,10,100,50',
      })
    ).statusCode,
    422,
  );
});
test('public binding serves the shared workspace without a session or bearer token', async (t) => {
  const { app } = await fixture(t, {
    host: '0.0.0.0',
    allowedHosts: ['api.example.test'],
    allowedOrigins: ['https://app.example.test'],
  });
  const response = await app.inject({
    url: '/api/runs',
    headers: { host: 'api.example.test', origin: 'https://app.example.test' },
    remoteAddress: '203.0.113.2',
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { runs: [] });
  assert.equal(
    (await app.inject({ url: '/api/health', headers: { host: 'api.example.test' } })).json()
      .authRequired,
    undefined,
  );
  const spec = (
    await app.inject({ url: '/api/docs/json', headers: { host: 'api.example.test' } })
  ).json();
  assert.equal(spec.components?.securitySchemes, undefined);
});
