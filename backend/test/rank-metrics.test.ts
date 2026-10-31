import test from 'node:test';
import assert from 'node:assert/strict';
import { rankAtK } from '../../scripts/evaluation/rank-metrics.ts';
const close = (actual: number | null, expected: number) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('binary metrics distinguish fixed slots, returned precision, recall and first relevant rank', () => {
  const result = rankAtK(['noise', 'a', 'b'], { a: 1, b: 1, c: 1 }, 5);
  close(result.precision_at_k, 2 / 5);
  close(result.precision_at_returned, 2 / 3);
  close(result.recall_at_k, 2 / 3);
  close(result.reciprocal_rank, 1 / 2);
  assert.equal(result.mrr, result.reciprocal_rank);
  assert.equal(result.hit_at_k, 1);
  close(
    result.ndcg_at_k,
    (1 / Math.log2(3) + 1 / Math.log2(4)) / (1 + 1 / Math.log2(3) + 1 / Math.log2(4)),
  );
  assert.equal(result.relevant_count, 3);
  assert.equal(result.retrieved, 3);
  assert.equal(result.recall_ceiling_at_k, 1);
});
test('graded nDCG rewards high-grade records earlier using exponential gain', () => {
  const graded = rankAtK(['low', 'high'], { low: 1, high: 3 }, 2);
  close(graded.ndcg_at_k, (1 + 7 / Math.log2(3)) / (7 + 1 / Math.log2(3)));
  assert.equal(rankAtK(['high', 'low'], { low: 1, high: 3 }, 2).ndcg_at_k, 1);
});
test('ranking truncates at K; a relevant sixth result gets no credit at five', () => {
  const result = rankAtK(['n1', 'n2', 'n3', 'n4', 'n5', 'answer'], { answer: 1 }, 5);
  assert.equal(result.retrieved, 5);
  assert.equal(result.recall_at_k, 0);
  assert.equal(result.hit_at_k, 0);
  assert.equal(result.reciprocal_rank, 0);
});
test('empty result on positive query is zero but zero-relevance query stays undefined', () => {
  const empty = rankAtK([], { a: 1 });
  assert.equal(empty.precision_at_returned, 0);
  assert.equal(empty.ndcg_at_k, 0);
  for (const ids of [[], ['unrelated']]) {
    const result = rankAtK(ids, { zero: 0 });
    for (const key of [
      'precision_at_k',
      'precision_at_returned',
      'recall_at_k',
      'ndcg_at_k',
      'reciprocal_rank',
      'hit_at_k',
      'recall_ceiling_at_k',
    ] as const)
      assert.equal(result[key], null);
    assert.equal(result.relevant_count, 0);
  }
});
test('recall ceiling reflects more relevant records than K', () => {
  const qrels = Object.fromEntries(Array.from({ length: 96 }, (_, i) => [`doc${i}`, 1]));
  const result = rankAtK(['doc0', 'doc1', 'doc2', 'doc3'], qrels, 5);
  close(result.recall_at_k, 4 / 96);
  close(result.recall_ceiling_at_k, 5 / 96);
});
test('invalid grades, cutoffs and duplicate identity fail rather than distort ranking', () => {
  assert.throws(() => rankAtK(['a', 'a'], { a: 1 }), /duplicate/);
  assert.throws(() => rankAtK(['a', 'b', 'b'], { a: 1 }, 1), /duplicate/);
  for (const grade of [-1, NaN, Infinity, 1024])
    assert.throws(() => rankAtK(['a'], { a: grade }), /grade/);
  for (const k of [0, -1, 1.5, NaN, Infinity])
    assert.throws(() => rankAtK([], { a: 1 }, k), /k must/);
  assert.equal(rankAtK(['__proto__'], { a: 1 }).recall_at_k, 0);
});

test('finite extreme and tiny grades do not produce NaN or infinite nDCG', () => {
  assert.equal(rankAtK(['a', 'b'], { a: 1023, b: 1023 }).ndcg_at_k, 1);
  assert.equal(rankAtK(['a'], { a: 1e-20 }).ndcg_at_k, 1);
});
