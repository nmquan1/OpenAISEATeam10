import assert from 'node:assert/strict';
import test from 'node:test';
import { defaults } from '../../contracts/model.ts';
import type { ExplanationProposal } from '../../contracts/explanation.ts';
import { evaluate } from '../src/engine/index.ts';
import { loadEvidenceIndex } from '../src/evidence/store.ts';
import type { RetrievalResult } from '../../contracts/evidence.ts';
import { ProviderError } from '../src/agent/errors.ts';
import {
  assessExplanation,
  explainStrategies,
  renderExplanation,
  requiredExplanationClaims,
} from '../src/agent/explain.ts';

const result = evaluate(defaults);
const proposal = (): ExplanationProposal => ({
  selected_strategy_id: result.recommended.id,
  reason_codes: ['ranked_first', 'scenario_only', 'no_voucher'],
  claims: requiredExplanationClaims(result),
  evidence_ids: [],
});
const env = {
  OPENAI_API_KEY: 'fixture-only',
  OPENAI_MODEL: 'configured-fixture-model',
  OPENAI_INPUT_USD_PER_MILLION: '10',
  OPENAI_OUTPUT_USD_PER_MILLION: '50',
};
const providerResponse = (raw: unknown) =>
  new Response(
    JSON.stringify({
      status: 'completed',
      model: 'actual-fixture-model',
      id: 'resp_fixture',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(raw) }] }],
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
    { headers: { 'x-request-id': 'req_fixture' } },
  );

test('exact claims render trusted figures and do not need model prose or citations', () => {
  const assessed = assessExplanation(result, undefined, proposal());
  assert.equal(assessed.accepted, true);
  assert.equal(assessed.numerical_claim_accuracy, 1);
  assert.equal(assessed.strategy_reference_validity, 1);
  assert.equal(assessed.required_claim_coverage, 1);
  assert.equal(assessed.evidence_citation_validity, null);
  assert.equal(assessed.free_prose_groundedness, null);
  const rendered = renderExplanation(result, undefined, proposal());
  assert.match(rendered.summary, /70%.*30%/);
  assert.ok(
    rendered.facts.some((fact) =>
      fact.includes(result.recommended.base_profit_dong.toLocaleString('vi-VN')),
    ),
  );
  assert.ok(rendered.caveats.some((text) => text.includes('mô phỏng')));
});

test('one hallucinated dong, unknown strategy, unsupported reason, reranking and missing facts are rejected', () => {
  const money = proposal();
  money.claims[0]!.value += 1;
  assert.equal(assessExplanation(result, undefined, money).accepted, false);
  assert.ok(assessExplanation(result, undefined, money).numerical_claim_accuracy! < 1);
  assert.throws(() => renderExplanation(result, undefined, money), /Rejected/);
  const id = proposal();
  id.claims[0]!.strategy_id = 'invented-strategy';
  assert.ok(assessExplanation(result, undefined, id).strategy_reference_validity! < 1);
  const reason = proposal();
  reason.reason_codes.push('loss_risk');
  assert.ok(assessExplanation(result, undefined, reason).violations.includes('unsupported_reason'));
  const rerank = proposal();
  rerank.selected_strategy_id = result.strategies[1]!.id;
  assert.ok(
    assessExplanation(result, undefined, rerank).violations.includes('cannot_rerank_engine'),
  );
  const incomplete = proposal();
  incomplete.claims.pop();
  assert.ok(assessExplanation(result, undefined, incomplete).required_claim_coverage < 1);
  assert.equal(
    assessExplanation(result, undefined, { ...proposal(), summary: 'Guaranteed 999999 profit' })
      .schema_valid,
    false,
  );
  assert.equal(
    assessExplanation(result, undefined, {
      ...proposal(),
      claims: [
        {
          strategy_id: result.recommended.id,
          scenario: 'base',
          metric: 'causal_uplift',
          value: 50,
        },
      ],
    }).schema_valid,
    false,
  );
});

test('evidence IDs are checked against supplied cards; existence does not claim semantic support', async () => {
  const index = await loadEvidenceIndex();
  const evidence: RetrievalResult = {
    enabled: true,
    status: 'matched',
    query: 'fixture',
    dataset_version: index.datasetVersion,
    index_sha256: index.indexSha256,
    retrieval_version: 'fixture',
    items: [index.cards[0]!],
  };
  const cited = proposal();
  cited.evidence_ids = [index.cards[0]!.evidence_id];
  const valid = assessExplanation(result, evidence, cited);
  assert.equal(valid.evidence_citation_validity, 1);
  assert.equal(valid.evidence_card_coverage, 1);
  assert.equal(valid.citation_semantic_support, null);
  cited.evidence_ids.push('nonexistent-evidence');
  const invalid = assessExplanation(result, evidence, cited);
  assert.equal(invalid.accepted, false);
  assert.equal(invalid.evidence_citation_validity, 0.5);
  assert.ok(invalid.violations.includes('unknown_evidence_id'));
});

test('transport uses caller fetch and configured model, strict bounded output, one call, and actual usage', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (_url, options) => {
    calls++;
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, env.OPENAI_MODEL);
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 2048);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.tools, undefined);
    const payload = JSON.parse(body.input);
    assert.equal(payload.recommended_strategy_id, result.recommended.id);
    assert.deepEqual(payload.required_claims, proposal().claims);
    return providerResponse(proposal());
  };
  const response = await explainStrategies(result, undefined, { env, fetchImpl });
  assert.equal(calls, 1);
  assert.equal(response.accepted, true);
  assert.equal(response.model, 'actual-fixture-model');
  assert.equal(response.requestId, 'req_fixture');
  assert.equal(response.estimatedCostUsd, 0.0035);
  assert.equal(response.attempts, 1);
});

test('invalid model facts remain auditable but are never rendered', async () => {
  const wrong = proposal();
  wrong.claims[0]!.value += 100;
  const response = await explainStrategies(result, undefined, {
    env,
    fetchImpl: async () => providerResponse(wrong),
  });
  assert.equal(response.accepted, false);
  assert.equal(response.explanation, null);
  assert.equal(response.rawText, JSON.stringify(wrong));
  assert.equal(response.usage.output_tokens, 50);
});

test('budget rejection and cancelled request cannot retry or bypass caller control', async () => {
  let calls = 0;
  const stop = new Error('budget-denied');
  await assert.rejects(
    explainStrategies(result, undefined, {
      env,
      fetchImpl: async () => {
        calls++;
        throw stop;
      },
    }),
    (error) => error === stop,
  );
  assert.equal(calls, 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    explainStrategies(result, undefined, {
      env,
      signal: controller.signal,
      fetchImpl: async () => {
        calls++;
        return providerResponse(proposal());
      },
    }),
    (error) => error instanceof ProviderError && error.status === 499,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    explainStrategies(result, undefined, {
      env: { ...env, OPENAI_EXPLANATION_MAX_OUTPUT_TOKENS: '99999' },
      fetchImpl: async () => {
        calls++;
        return providerResponse(proposal());
      },
    }),
    (error) => error instanceof ProviderError && error.status === 503,
  );
  assert.equal(calls, 1);
});
