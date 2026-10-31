import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseRecommendationRequest } from '../../contracts/model.ts';
import { evaluateVouchers } from '../src/engine/index.ts';
import { loadEvidenceIndex } from '../src/evidence/store.ts';
import {
  relevanceMatches,
  retrievalMetrics,
  type RelevanceRule,
} from '../../scripts/evaluation/retrieval-audit.ts';

const suite = JSON.parse(
  await readFile(new URL('../../data/eval/technical-cases.v1.json', import.meta.url), 'utf8'),
) as { cases: { id: string; stratum: string; input: unknown; context: unknown }[] };

test('technical fixture has 12 valid case clusters, balanced objective coverage and three strata', () => {
  assert.equal(suite.cases.length, 12);
  assert.equal(new Set(suite.cases.map((item) => item.id)).size, 12);
  const objectives: Record<string, number> = {};
  const strata: Record<string, number> = {};
  for (const item of suite.cases) {
    const request = parseRecommendationRequest({ input: item.input, context: item.context });
    assert.ok(request.context.reference_query);
    objectives[request.input.objective] = (objectives[request.input.objective] ?? 0) + 1;
    strata[item.stratum] = (strata[item.stratum] ?? 0) + 1;
  }
  assert.deepEqual(objectives, { balanced: 4, growth: 4, safe: 4 });
  assert.deepEqual(strata, { quality: 5, safety_control: 4, adversarial: 3 });
});

test('three synthetic quality cases have genuine engine score headroom over no voucher', () => {
  for (const id of [
    'strong-response-balanced',
    'strong-response-growth',
    'unmatched-serum-reference',
  ]) {
    const item = suite.cases.find((item) => item.id === id)!;
    const { input, context } = parseRecommendationRequest({
      input: item.input,
      context: item.context,
    });
    assert.match(context.seller_notes, /hypothetical|synthetic/i);
    const result = evaluateVouchers(input, [
      {
        type: 'fixed',
        amount_dong: 14950,
        minimum_dong: 0,
        seller_funding_bps: input.voucher.seller_funding_bps,
      },
    ]);
    const noVoucher = result.strategies.find((strategy) => strategy.discount_dong === 0)!;
    assert.ok(result.recommended.score > noVoucher.score, id);
    assert.ok(result.recommended.discount_dong > 0, id);
  }
});

test('retrieval metrics account for rank, empty slots and all-corpus denominator', () => {
  const result = retrievalMetrics(['wrong', 'b', 'a'], ['a', 'b', 'c', 'd']);
  assert.equal(result.precision_at_actual_k, 2 / 3);
  assert.equal(result.precision_at_6, 2 / 6);
  assert.equal(result.recall_at_6, 2 / 4);
  const expected =
    (1 / Math.log2(3) + 1 / Math.log2(4)) /
    (1 / Math.log2(2) + 1 / Math.log2(3) + 1 / Math.log2(4) + 1 / Math.log2(5));
  assert.equal(result.ndcg_at_6, expected);
  assert.equal(retrievalMetrics([], ['a']).precision_at_actual_k, 0);
  assert.equal(retrievalMetrics([], ['a']).ndcg_at_6, 0);
  assert.equal(retrievalMetrics(['unexpected'], []).precision_at_actual_k, null);
  assert.equal(retrievalMetrics([], []).recall_at_6, null);
  assert.throws(() => retrievalMetrics(['a', 'a'], ['a']));
});

test('frozen qrels equal exhaustive corpus matches and preserve strict profile intent', async () => {
  const qrels = JSON.parse(
    await readFile(new URL('../../data/eval/retrieval-qrels.v1.json', import.meta.url), 'utf8'),
  ) as {
    index_sha256: string;
    queries: { id: string; rule: RelevanceRule; relevant_ids: string[] }[];
  };
  const index = await loadEvidenceIndex();
  assert.equal(index.cards.length, 4328);
  assert.equal(index.indexSha256, qrels.index_sha256);
  for (const query of qrels.queries) {
    const ids = index.cards
      .filter((card) => relevanceMatches(card, query.rule))
      .map((card) => card.evidence_id)
      .sort();
    assert.deepEqual(ids, [...query.relevant_ids].sort(), query.id);
  }
  const coffee = qrels.queries.find((query) => query.id === 'coffee-profile')!;
  const cards = index.cards.filter((card) => relevanceMatches(card, coffee.rule));
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.kind, 'profile');
  assert.deepEqual(cards[0]!.entity_ids, ['COFFEE']);
});
