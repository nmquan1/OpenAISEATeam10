import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, type Voucher } from '../../contracts/model.ts';
import { evaluate } from '../src/engine/index.ts';
import { generateCandidates } from '../src/agent/openai.ts';
import {
  assessProposal,
  comparison,
  economicId,
  references,
  scoreVoucher,
  distribution,
} from '../../scripts/evaluation/technical-metrics.ts';
import { fixtureFetch, parseArguments, runCase } from '../../scripts/eval-technical.ts';
import { LiveBudget } from '../../scripts/evaluation/budget.ts';

const input = structuredClone(defaults);
const funding = input.voucher.seller_funding_bps;
const zero: Voucher = {
  type: 'fixed',
  amount_dong: 0,
  minimum_dong: 0,
  seller_funding_bps: funding,
};
test('exact candidate matching never substitutes recommended baseline score', () => {
  const baseline = evaluate(input);
  for (const strategy of baseline.strategies) {
    const assessment = assessProposal(input, { candidates: [strategy.voucher] });
    assert.equal(assessment.best?.id, strategy.id);
    assert.equal(assessment.best?.score, strategy.score);
    assert.equal(comparison(assessment, references(input)).genuine_new_winner, false);
  }
  const costly: Voucher = { ...zero, amount_dong: 1_000_000_000 };
  assert.equal(scoreVoucher(input, costly).id, economicId(input, costly));
  assert.ok(scoreVoucher(input, costly).score < baseline.recommended.score);
});
test('zero and ineligible discount deduplicate economically without inventing success', () => {
  const ineligible: Voucher = { ...zero, amount_dong: 1000, minimum_dong: 1_000_000_000 };
  const assessed = assessProposal(input, { candidates: [zero, ineligible, zero] });
  assert.equal(assessed.distinct_economic_count, 1);
  assert.equal(assessed.distinct_economic_rate, 1 / 3);
  assert.equal(assessed.best?.id, 'discount:0:seller:0');
  assert.equal(comparison(assessed, references(input)).genuine_new_winner, false);
});
test('BigInt ID preserves half-up discount and funding rounding', () => {
  const small = structuredClone(input);
  small.product.lines = [{ ...small.product.lines[0]!, unit_price_dong: 40, quantity: 1 }];
  assert.equal(
    economicId(small, {
      type: 'percent',
      rate_bps: 125,
      cap_dong: 10,
      minimum_dong: 0,
      seller_funding_bps: 5000,
    }),
    'discount:1:seller:1',
  );
});
test('strict first pass rejects extra fields and malformed vouchers while recording partial scores and funding violations', () => {
  const malformed = { ...zero, amount_dong: -1 };
  const wrongFunding = { ...zero, seller_funding_bps: funding === 0 ? 1 : 0 };
  const assessed = assessProposal(input, {
    candidates: [zero, malformed, wrongFunding],
    explanation: 'injected',
  });
  assert.equal(assessed.pass_at_1, false);
  assert.equal(assessed.schema_valid_count, 2);
  assert.equal(assessed.valid_candidate_count, 1);
  assert.equal(assessed.funding_violations, 1);
  assert.equal(assessProposal(input, null).best, null);
});
test('dense reference includes a zero voucher and matches candidates only', () => {
  const reference = references(input);
  assert.equal(reference.grid5_candidates.length, 5);
  assert.ok(reference.dense_candidates.some((candidate) => candidate.id === 'discount:0:seller:0'));
  assert.equal(
    reference.grid5_candidate_score,
    Math.max(...reference.grid5_candidates.map((candidate) => candidate.score)),
  );
  assert.ok(reference.grid5_production_score >= reference.grid5_candidate_score);
  assert.ok(reference.normalization_scale >= 1);
  assert.equal(distribution([null]).mean, null);
});
test('offline fixtures exercise provider invalid schema without network and retries stay disabled', async () => {
  const env = { OPENAI_API_KEY: 'fixture', OPENAI_MODEL: 'fixture', OPENAI_MAX_RETRIES: '0' };
  const result = await generateCandidates(
    {},
    { env, fetchImpl: fixtureFetch({ candidates: [{ ...zero, extra: true }] }) },
  );
  assert.equal(result.attempts, 1);
  assert.equal(assessProposal(input, { candidates: result.candidates }).pass_at_1, false);
  await assert.rejects(
    generateCandidates({}, { env, fetchImpl: fixtureFetch({ candidates: [zero], extra: true }) }),
  );
  assert.equal(parseArguments([]).live, false);
  assert.throws(() => parseArguments(['--live']), /max-calls/);
});
test('shared reservation ledger bounds concurrent calls and preserves unknown costs', async () => {
  const budget = new LiveBudget({ maxCalls: 2, maxCostUsd: 10, inputRate: 10, outputRate: 50 });
  let calls = 0;
  const wrapped = budget.wrap(async () => {
    calls++;
    return new Response(JSON.stringify({ usage: {} }));
  });
  await Promise.allSettled(
    Array.from({ length: 3 }, () =>
      wrapped('https://fixture.invalid', { body: JSON.stringify({ max_output_tokens: 256 }) }),
    ),
  );
  assert.equal(calls, 2);
  assert.equal(budget.calls, 2);
  assert.ok(budget.accountedCostUsd > 0);
  assert.match(budget.stopReason!, /unknown_provider_usage/);
});

test('paired treatment keeps merchant context/query fixed and changes only evidence envelope', async () => {
  const item = {
    id: 'paired',
    description: 'test',
    input,
    context: {
      ...(await import('../../contracts/model.ts')).parseRecommendationRequest({
        input,
        context: { seller_notes: '' },
      }).context,
      reference_query: 'source:uci percent cap minimum',
    },
  };
  const payloads: Record<string, unknown>[] = [];
  const capture: typeof fetch = async (url, options) => {
    const request = JSON.parse(String(options?.body));
    payloads.push(JSON.parse(request.input));
    return fixtureFetch({ candidates: [zero] })(url, options);
  };
  const env = { OPENAI_API_KEY: 'fixture', OPENAI_MODEL: 'fixture', OPENAI_MAX_RETRIES: '0' };
  await runCase(item, 1, 'without_reference', env, capture, false);
  await runCase(item, 1, 'with_reference', env, capture, false);
  const [
    { reference_evidence: without, ...left },
    { reference_evidence: withReference, ...right },
  ] = payloads;
  assert.deepEqual(left, right);
  assert.notDeepEqual(without, withReference);
});
test('provider-rejected envelope preserves raw scores but cannot count as an AI winner', async () => {
  const item = {
    id: 'rejected',
    description: 'test',
    input,
    context: (await import('../../contracts/model.ts')).parseRecommendationRequest({
      input,
      context: { seller_notes: '' },
    }).context,
  };
  const env = { OPENAI_API_KEY: 'fixture', OPENAI_MODEL: 'fixture', OPENAI_MAX_RETRIES: '0' };
  const row = await runCase(
    item,
    1,
    'without_reference',
    env,
    fixtureFetch({ candidates: [zero], injected: true }),
    false,
  );
  assert.equal(row.pass_at_1, false);
  assert.equal(row.assessment.valid_candidate_count, 1);
  assert.equal(row.best_ai_score, null);
  assert.equal(row.genuine_new_winner, false);
  assert.equal(row.vs_baseline, null);
});
