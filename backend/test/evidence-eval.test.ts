import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LiveBudget, BudgetStop } from '../../scripts/evaluation/budget.ts';
import {
  parseArguments,
  evaluationComplete,
  pairedSummary,
  type EvidenceCase,
} from '../../scripts/eval-evidence.ts';
import { defaults, parseRecommendationRequest } from '../../contracts/model.ts';
import { evaluate } from '../src/engine/index.ts';
import { csvValue, gridCandidates, newWinner, quantile } from '../../scripts/evaluation/metrics.ts';

const limits = { maxCalls: 2, maxCostUsd: 1, inputRate: 10, outputRate: 50 };
const request = JSON.stringify({ model: 'fixture', input: 'test', max_output_tokens: 100 });
test('live evaluation requires explicit call/cost bounds and fixture mode is the default', () => {
  assert.equal(parseArguments([]).live, false);
  assert.equal(parseArguments([]).repeats, 3);
  assert.throws(() => parseArguments(['--live']), /max-calls/);
  assert.throws(() => parseArguments(['--repeats', '0']));
  assert.throws(() => parseArguments(['--unknown']));
  assert.throws(() => new LiveBudget({ ...limits, inputRate: 0 }));
  assert.throws(() => new LiveBudget({ ...limits, maxCalls: NaN }));
});
test('estimated budget reserves before network work and settles measured usage', async () => {
  const budget = new LiveBudget(limits);
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ usage: { input_tokens: 10, output_tokens: 20 } }));
  };
  const fetch = budget.wrap(fakeFetch);
  await fetch('https://fixture.invalid', { body: request });
  assert.equal(calls, 1);
  assert.equal(budget.calls, 1);
  assert.ok(Math.abs(budget.accountedCostUsd - 0.0011) < 1e-12);
  await fetch('https://fixture.invalid', { body: request });
  await assert.rejects(fetch('https://fixture.invalid', { body: request }), BudgetStop);
  assert.equal(calls, 2);
  const insufficient = new LiveBudget({ ...limits, maxCostUsd: 0.00001 });
  await assert.rejects(
    insufficient.wrap(fakeFetch)('https://fixture.invalid', { body: request }),
    BudgetStop,
  );
  assert.equal(insufficient.calls, 0);
  assert.equal(calls, 2);
});
test('unknown usage/errors retain cost reservations and stop future live calls', async () => {
  for (const response of [new Response('{}'), new Response('{}', { status: 500 })]) {
    const budget = new LiveBudget(limits);
    await budget.wrap(async () => response)('https://fixture.invalid', { body: request });
    assert.ok(budget.stopReason);
    assert.ok(budget.accountedCostUsd > 0);
    assert.equal(budget.observedCostUsd, 0);
    assert.throws(() => budget.reserve(request), BudgetStop);
  }
  const budget = new LiveBudget(limits);
  const reservation = budget.reserve(request);
  budget.settle(reservation, reservation.inputAllowance + 1, 100);
  assert.match(budget.stopReason!, /exceeded_reservation/);
});
test('evaluation cases are versioned, unique, valid and label prohibited inferences', async () => {
  const dataset = JSON.parse(
    await readFile(new URL('../../data/eval/evidence-cases.v1.json', import.meta.url), 'utf8'),
  ) as { version: string; cases: EvidenceCase[] };
  assert.equal(dataset.version, 'evidence-eval-cases.v1');
  assert.ok(dataset.cases.length >= 20);
  assert.equal(new Set(dataset.cases.map((row) => row.id)).size, dataset.cases.length);
  assert.ok(dataset.cases.some((row) => row.expected.status === 'no_match'));
  for (const row of dataset.cases) {
    parseRecommendationRequest({ input: row.input, context: row.context });
    assert.ok(row.expected.forbidden_inferences.length >= 3);
    const proposals = gridCandidates(row.input);
    assert.equal(proposals.length, 5);
    assert.ok(
      proposals.every(
        (voucher) => voucher.seller_funding_bps === row.input.voucher.seller_funding_bps,
      ),
    );
  }
});
test('retaining a baseline is not an AI win; CSV strings and summary statistics are safe', () => {
  const baseline = evaluate(defaults);
  assert.equal(newWinner(baseline, baseline), false);
  assert.equal(quantile([], 0.95), null);
  assert.equal(quantile([3, 1, 2], 0.5), 2);
  assert.equal(csvValue('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvValue(-20), '"-20"');
});

test('partial runs are not complete and paired metrics require matching input/model/prompt', () => {
  assert.equal(evaluationComplete(150, 150, null), true);
  assert.equal(evaluationComplete(150, 6, 'max_calls_reached'), false);
  assert.equal(evaluationComplete(150, 150, 'unknown_usage'), false);
  const shared = {
    case_id: 'fixture',
    repeat: 1,
    valid: true,
    input_sha256: 'input',
    model: 'model',
    prompt_version: 'prompt',
  };
  const baseline = { ...shared, mode: 'without_reference' as const, candidate_score: 100 };
  const treatment = { ...shared, mode: 'with_reference' as const, candidate_score: 110 };
  const paired = pairedSummary([baseline, treatment]);
  assert.equal(paired.valid_paired_repetitions, 1);
  assert.equal(paired.mean_score_delta_with_minus_without, 10);
  assert.equal(paired.improved_fraction, 1);
  const mismatched = pairedSummary([baseline, { ...treatment, model: 'other' }]);
  assert.equal(mismatched.valid_paired_repetitions, 0);
  assert.equal(mismatched.mean_score_delta_with_minus_without, null);
  assert.equal(mismatched.excluded_input_model_or_prompt_mismatch, 1);
});
