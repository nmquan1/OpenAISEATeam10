import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { defaults } from '../../contracts/model.ts';
import { retrieveEvidence } from '../src/evidence/retrieve.ts';
import { loadEvidenceIndex, readEvidenceIndex } from '../src/evidence/store.ts';

const context = (reference_query: string) => ({ seller_notes: '', reference_query });

test('reference retrieval is explicit opt-in and never reads the pack without a query', async () => {
  const disabled = await retrieveEvidence(
    defaults,
    { seller_notes: 'bread and milk' },
    {
      loadIndex: async () => {
        throw new Error('must not read');
      },
    },
  );
  assert.equal(disabled.status, 'disabled');
  assert.deepEqual(disabled.items, []);
  const unavailable = await retrieveEvidence(defaults, context('bread'), {
    loadIndex: async () => {
      throw new Error('missing pack');
    },
  });
  assert.equal(unavailable.status, 'unavailable');
  assert.deepEqual(unavailable.items, []);
});

test('bilingual category retrieval preserves source-native denominators and leaves merchant assumptions unchanged', async () => {
  const input = structuredClone(defaults);
  const before = structuredClone(input);
  const result = await retrieveEvidence(
    input,
    context('source:cj cát vệ sinh thức ăn cho mèo mua kèm'),
  );
  assert.equal(result.status, 'matched');
  assert.ok(result.index_sha256);
  const association = result.items.find((card) => card.label === 'CAT LITTER → CAT FOOD');
  assert.ok(association);
  assert.equal(association.source_dataset, 'completejourney');
  assert.equal(association.money_unit, 'dollar_unspecified');
  assert.equal(association.entity_type, 'category');
  assert.equal(association.population.antecedent_baskets, 510);
  assert.equal(association.population.joint_baskets, 212);
  assert.equal(association.metrics.lift, '16.0574092504');
  assert.deepEqual(input, before);
});

test('bread references keep baked bread distinct from the separate BREAD category', async () => {
  const result = await retrieveEvidence(defaults, context('source:cj bread milk bundle'));
  assert.equal(result.status, 'matched');
  const baked = result.items.find(
    (card) => card.label === 'BAKED BREAD/BUNS/ROLLS → FLUID MILK PRODUCTS',
  );
  const plain = result.items.find((card) => card.label === 'BREAD → FLUID MILK PRODUCTS');
  assert.ok(baked);
  assert.ok(plain);
  assert.equal(baked.population.joint_baskets, 4899);
  assert.equal(plain.population.joint_baskets, 567);
  assert.notEqual(baked.evidence_id, plain.evidence_id);
});

test('unknown subjects and conflicting or invalid source filters do not return popular unrelated evidence', async () => {
  for (const query of [
    'quantum graphics card xyz',
    'source:uci cat litter cat food bundle',
    'source:cj percent cap minimum',
    'source:uci source:cj bread',
    'source:unknown bread',
    'source:__proto__ bread',
  ]) {
    const result = await retrieveEvidence(defaults, context(query));
    assert.equal(result.status, 'no_match', query);
    assert.deepEqual(result.items, [], query);
  }
});

test('mechanical voucher references remain hypothetical GBP with no merchant money conversion', async () => {
  const result = await retrieveEvidence(defaults, context('source:uci % cap minimum'));
  assert.equal(result.status, 'matched');
  assert.ok(result.items.every((card) => card.kind === 'voucher_geometry'));
  assert.ok(result.items.every((card) => card.money_unit === 'GBP'));
  assert.ok(
    result.items.every((card) => card.evidence_scope === 'hypothetical_static_mechanical_replay'),
  );
  assert.equal(
    new Set(result.items.map((card) => card.metrics.payout_equivalence_group)).size,
    result.items.length,
  );
  assert.ok(result.items.every((card) => !Object.hasOwn(card.metrics, 'recommended_vnd')));
});

test('retrieval ordering and budgets are deterministic and callers cannot mutate the cached cards', async () => {
  const query = context('source:cj bread milk bundle');
  const first = await retrieveEvidence(defaults, query, { limit: 100 });
  const second = await retrieveEvidence(defaults, query);
  assert.deepEqual(first, second);
  assert.ok(first.items.length <= 6);
  assert.ok(JSON.stringify(first.items).length <= 15000);
  assert.equal(new Set(first.items.map((card) => card.source_dataset)).size, 1);
  const originalLabel = second.items[0]!.label;
  first.items[0]!.label = 'Changed by caller';
  assert.equal((await retrieveEvidence(defaults, query)).items[0]!.label, originalLabel);
});

test('pack checksum, count and duplicate identity are verified before reference use', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'market-maker-evidence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const index = await loadEvidenceIndex();
  const root = resolve(import.meta.dirname, '../../data/evidence');
  const originalManifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  const oneCard = JSON.stringify(index.cards[0]) + '\n';
  const writePack = async (body: string, count: number, digest?: string) => {
    await writeFile(join(directory, 'decision_evidence.jsonl'), body);
    await writeFile(
      join(directory, 'manifest.json'),
      JSON.stringify({
        ...originalManifest,
        record_count: count,
        index: {
          file: 'decision_evidence.jsonl',
          bytes: Buffer.byteLength(body),
          sha256: digest ?? createHash('sha256').update(body).digest('hex'),
        },
      }),
    );
  };
  await writePack(oneCard, 1, '0'.repeat(64));
  await assert.rejects(readEvidenceIndex(directory), /checksum/i);
  await writePack(oneCard, 2);
  await assert.rejects(readEvidenceIndex(directory), /count/i);
  await writePack(oneCard + oneCard, 2);
  await assert.rejects(readEvidenceIndex(directory), /identity/i);
  await writePack(oneCard, 1);
  assert.equal((await readEvidenceIndex(directory)).cards.length, 1);
});

test('long Vietnamese aliases do not accidentally require a second broader category', async () => {
  const result = await retrieveEvidence(defaults, context('source:cj sữa chua'));
  assert.equal(result.status, 'matched');
  assert.ok(result.items.every((card) => /yogurt|yoghurt/i.test(card.label)));
});
