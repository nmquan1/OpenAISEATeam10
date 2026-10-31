import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Value } from '@sinclair/typebox/value';
import {
  EvidenceCardSchema,
  type EvidenceCard,
  parseRetrievalResult,
} from '../../contracts/evidence.ts';

const root = fileURLToPath(new URL('../../data/evidence/', import.meta.url));
const bytes = readFileSync(`${root}decision_evidence.jsonl`);
const manifest = JSON.parse(readFileSync(`${root}manifest.json`, 'utf8'));
const cards: EvidenceCard[] = bytes
  .toString()
  .trimEnd()
  .split('\n')
  .map((line) => JSON.parse(line));

test('frozen evidence matches manifest checksum and all source-native cards satisfy the contract', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.index.sha256);
  assert.equal(bytes.length, manifest.index.bytes);
  assert.equal(cards.length, 4328);
  assert.equal(cards.length, manifest.record_count);
  assert.equal(new Set(cards.map((card) => card.evidence_id)).size, cards.length);
  const counts: Record<string, number> = {};
  for (const card of cards) {
    assert.ok(Value.Check(EvidenceCardSchema, card), card.evidence_id);
    assert.equal(card.dataset_version, manifest.dataset_version);
    assert.equal(card.feature_version, manifest.feature_version);
    assert.equal(
      card.lineage.sha256,
      manifest.source_artifacts[card.lineage.file.replace('features/', '')],
    );
    assert.ok(Number(card.lineage.row_id) >= 2);
    assert.equal(
      card.money_unit,
      card.source_dataset === 'completejourney' ? 'dollar_unspecified' : 'GBP',
    );
    assert.ok(card.limitations.some((limit) => /historical|Hypothetical/i.test(limit)));
    counts[card.kind] = (counts[card.kind] ?? 0) + 1;
  }
  assert.deepEqual(counts, manifest.counts_by_kind);
});

test('association evidence keeps directed denominators and distinguishes similarly named categories', () => {
  const baked = cards.find(
    (card) =>
      card.kind === 'association' && card.label === 'BAKED BREAD/BUNS/ROLLS → FLUID MILK PRODUCTS',
  )!;
  const bread = cards.find(
    (card) => card.kind === 'association' && card.label === 'BREAD → FLUID MILK PRODUCTS',
  )!;
  assert.equal(baked.population.antecedent_baskets, 9846);
  assert.equal(baked.population.joint_baskets, 4899);
  assert.equal(bread.population.antecedent_baskets, 1291);
  assert.equal(bread.population.joint_baskets, 567);
  for (const card of cards.filter((card) => card.kind === 'association')) {
    const counts = card.population;
    assert.ok(
      counts.joint_baskets! <= Math.min(counts.antecedent_baskets!, counts.consequent_baskets!),
    );
    assert.ok(
      Math.abs(
        Number(card.metrics.confidence_b_given_a) -
          counts.joint_baskets! / counts.antecedent_baskets!,
      ) < 1e-9,
    );
    assert.equal(counts.early_joint_baskets! + counts.late_joint_baskets!, counts.joint_baskets);
  }
});

test('voucher replay preserves cohort identity and source precision; unknown discounts remain null', () => {
  const replay = cards.filter((card) => card.kind === 'voucher_geometry');
  assert.equal(replay.length, 96);
  assert.equal(new Set(replay.map((card) => card.metrics.payout_equivalence_group)).size, 42);
  assert.equal(
    replay.filter((card) => card.metrics.same_exact_payout_as_lower_rate === 'true').length,
    54,
  );
  assert.equal(new Set(replay.map((card) => card.metrics.cohort_sha256)).size, 1);
  assert.ok(
    replay.every((card) => card.evidence_scope === 'hypothetical_static_mechanical_replay'),
  );
  for (const card of cards.filter(
    (card) => card.kind === 'profile' && card.source_dataset === 'uci_online_retail_ii',
  )) {
    assert.equal(card.metrics.loyalty_discount_basket_share, null);
    assert.equal(card.metrics.manufacturer_coupon_basket_share, null);
  }
});

test('retrieval envelope cannot mislabel an empty or disabled result as a matched reference', () => {
  const empty = {
    enabled: false,
    status: 'disabled',
    dataset_version: null,
    index_sha256: null,
    retrieval_version: 'test',
    query: '',
    items: [],
  };
  assert.deepEqual(parseRetrievalResult(empty), empty);
  assert.throws(() => parseRetrievalResult({ ...empty, status: 'matched' }));
  assert.throws(() => parseRetrievalResult({ ...empty, items: [cards[0]] }));
});
