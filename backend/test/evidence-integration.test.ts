import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildApp, type AppOptions } from '../src/api/app.ts';
import { JsonRunStore } from '../src/store/index.ts';
import { recommend } from '../src/agent/recommend.ts';
import { defaults, parseRecommendationResult } from '../../contracts/model.ts';
import { parseRetrievalResult } from '../../contracts/evidence.ts';

class CountingStore extends JsonRunStore {
  attempts = 0;
  override async consumeAi(limit: number) {
    this.attempts++;
    return super.consumeAi(limit);
  }
}

async function appFixture(t: test.TestContext, options: AppOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'market-maker-evidence-api-'));
  const store = new CountingStore(join(directory, 'runs.json'));
  const app = await buildApp({ logger: false, store, ...options });
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  const post = (url: string, payload: unknown) =>
    app.inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
  return { app, store, post };
}

const request = () => ({
  input: structuredClone(defaults),
  context: { seller_notes: '', reference_query: 'source:cj cat litter cat food' },
});

test('free evidence preview works without AI credentials, quota use or saved AI runs', async (t) => {
  let providerCalls = 0;
  const { app, post, store } = await appFixture(t, {
    aiConfigured: false,
    recommendImpl: async () => {
      providerCalls++;
      throw new Error('Preview must not call OpenAI');
    },
  });
  const response = await post('/api/evidence/retrieve', request());
  assert.equal(response.statusCode, 200, response.body);
  const result = parseRetrievalResult(response.json());
  assert.equal(result.status, 'matched');
  assert.ok(result.items.some((card) => card.label === 'CAT LITTER → CAT FOOD'));
  assert.equal(providerCalls, 0);
  assert.equal(store.attempts, 0);
  assert.equal((await app.inject('/api/runs')).json().runs.length, 0);
  const docs = (await app.inject('/api/docs/json')).json();
  assert.ok(docs.paths['/api/evidence/retrieve'].post.requestBody);
  assert.ok(docs.paths['/api/evidence/retrieve'].post.responses['200']);
});

test('evidence endpoint rejects client-supplied evidence, invalid query and merchant input coercion', async (t) => {
  const { post } = await appFixture(t);
  const body = request();
  for (const payload of [
    { ...body, reference_evidence: { items: [] } },
    { ...body, context: { ...body.context, reference_evidence: { items: [] } } },
    { ...body, context: { ...body.context, reference_query: 123 } },
    { ...body, context: { ...body.context, reference_query: 'a'.repeat(501) } },
    {
      ...body,
      input: { ...body.input, assumptions: { ...body.input.assumptions, cvr_bps: '300' } },
    },
  ]) {
    const response = await post('/api/evidence/retrieve', payload);
    assert.equal(response.statusCode, 422, response.body);
  }
  const disabled = await post('/api/evidence/retrieve', {
    input: defaults,
    context: { seller_notes: 'cat litter cat food' },
  });
  assert.equal(disabled.json().status, 'disabled');
  const unmatched = await post('/api/evidence/retrieve', {
    ...body,
    context: { ...body.context, reference_query: 'unknown quantum computer hardware xyz' },
  });
  assert.equal(unmatched.json().status, 'no_match');
  assert.deepEqual(unmatched.json().items, []);
});

test('AI receives the preview evidence with unchanged merchant assumptions and persists the same trace', async (t) => {
  const body = request();
  body.input.assumptions.cvr_bps = 111;
  body.input.constraints.budget_dong = 123456;
  body.context.seller_notes = 'Foreign history is a reference only; keep my assumptions.';
  const before = structuredClone(body);
  let providerCalls = 0;
  let sentPayload: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (_url, options) => {
    providerCalls++;
    const providerRequest = JSON.parse(options!.body as string);
    sentPayload = JSON.parse(providerRequest.input);
    assert.equal(providerRequest.store, false);
    assert.match(providerRequest.instructions, /reference|evidence/i);
    return new Response(
      JSON.stringify({
        status: 'completed',
        model: 'evidence-integration-fixture',
        usage: { input_tokens: 42, output_tokens: 24 },
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  candidates: [
                    {
                      type: 'fixed',
                      amount_dong: 10000,
                      minimum_dong: 0,
                      seller_funding_bps: defaults.voucher.seller_funding_bps,
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
      { headers: { 'x-request-id': 'evidence-integration-request' } },
    );
  };
  const { app, post, store } = await appFixture(t, {
    aiConfigured: true,
    dailyAiLimit: 1,
    recommendImpl: (payload, options) =>
      recommend(payload, {
        ...options,
        env: {
          OPENAI_API_KEY: 'fixture-not-a-key',
          OPENAI_MODEL: 'fixture',
          OPENAI_MAX_RETRIES: '0',
        },
        fetchImpl,
      }),
  });
  const preview = await post('/api/evidence/retrieve', body);
  assert.equal(preview.statusCode, 200, preview.body);
  const response = await post('/api/recommend', body);
  assert.equal(response.statusCode, 200, response.body);
  const result = parseRecommendationResult(response.json());
  assert.equal(providerCalls, 1);
  assert.equal(store.attempts, 1);
  assert.deepEqual(sentPayload!.input, before.input);
  assert.deepEqual(sentPayload!.reference_evidence, preview.json());
  assert.deepEqual(result.reference_evidence, preview.json());
  assert.deepEqual(result.input, before.input);
  assert.deepEqual(body, before);
  assert.equal(result.provider_request_id, 'evidence-integration-request');
  assert.equal(result.decision_context.applied_to_forecast, false);
  const runs = (await app.inject('/api/runs')).json().runs;
  assert.equal(runs.length, 1);
  const saved = (await app.inject(`/api/runs/${runs[0].id}`)).json();
  assert.deepEqual(saved.result.reference_evidence, preview.json());
  assert.deepEqual(saved.input, before.input);
  assert.equal((await post('/api/recommend', body)).statusCode, 429);
  assert.equal(providerCalls, 1);
});
