import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../../contracts/model.ts';
import { retrieveEvidence, RETRIEVAL_VERSION } from '../src/evidence/retrieve.ts';
import { retrieveEvidence as legacy } from '../src/evidence/retrieve-legacy.ts';
const retrieve = (reference_query: string) =>
  retrieveEvidence(defaults, { seller_notes: '', reference_query });

test('v2 profile intent returns canonical category profiles without associations or substring siblings', async () => {
  for (const [query, entities] of [
    ['source:cj product profile milk', ['FLUID MILK PRODUCTS']],
    ['source:cj product profile coffee', ['COFFEE']],
    ['source:cj hồ sơ sữa chua', ['YOGURT']],
    ['source:cj product profile bread', ['BREAD', 'BAKED BREAD/BUNS/ROLLS']],
    ['source:cj product profile diapers', ['DIAPERS & DISPOSABLES']],
  ] as const) {
    const result = await retrieve(query);
    assert.equal(result.retrieval_version, RETRIEVAL_VERSION);
    assert.equal(result.status, 'matched', query);
    assert.ok(
      result.items.every(
        (card) =>
          card.kind === 'profile' &&
          card.entity_ids.every((entity) => (entities as readonly string[]).includes(entity)),
      ),
      query,
    );
  }
});

test('specific sibling intent overrides broader aliases without crossing category identities', async () => {
  for (const [query, entity] of [
    ['source:cj profile coffee filters', 'COFFEE FILTERS'],
    ['source:cj profile frozen bread', 'FROZEN BREAD/DOUGH'],
    ['source:cj profile canned milk', 'CANNED MILK'],
    ['source:cj profile milk by-products', 'MILK BY-PRODUCTS'],
  ]) {
    const result = await retrieve(query!);
    assert.equal(result.items.length, 1, query);
    assert.deepEqual(result.items[0]!.entity_ids, [entity]);
  }
});

test('bread milk association scope excludes frozen dough and nonfluid milk, keeps directions and denominators', async () => {
  const result = await retrieve('source:cj bread milk bundle');
  assert.equal(result.items.length, 3);
  assert.ok(
    result.items.every(
      (card) =>
        card.kind === 'association' &&
        card.entity_ids.includes('FLUID MILK PRODUCTS') &&
        card.entity_ids.some((entity) => ['BREAD', 'BAKED BREAD/BUNS/ROLLS'].includes(entity)),
    ),
  );
  const baked = result.items.find(
    (card) => card.label === 'BAKED BREAD/BUNS/ROLLS → FLUID MILK PRODUCTS',
  );
  assert.equal(baked?.population.joint_baskets, 4899);
  assert.equal(baked?.money_unit, 'dollar_unspecified');
});

test('unknown qualifiers and conflicting intents do not silently fall back to known popular terms', async () => {
  for (const query of [
    'source:cj profile quantum milk',
    'source:cj profile coffee spacehelmet',
    'source:cj skincare serum',
    'source:uci milk profile',
    'source:cj profile milk bundle',
  ]) {
    assert.equal((await retrieve(query)).status, 'no_match', query);
  }
});

test('v2 preserves retrieval isolation, fail-safe loading, input immutability and top5 bounds', async () => {
  const input = structuredClone(defaults);
  const before = structuredClone(input);
  const query = { seller_notes: '', reference_query: 'source:uci percent cap minimum' };
  const result = await retrieveEvidence(input, query, { limit: 100 });
  assert.ok(result.items.length > 0 && result.items.length <= 5);
  assert.ok(
    result.items.every(
      (card) =>
        card.source_dataset === 'uci_online_retail_ii' &&
        card.money_unit === 'GBP' &&
        card.evidence_scope === 'hypothetical_static_mechanical_replay',
    ),
  );
  assert.deepEqual(input, before);
  assert.deepEqual(result, await retrieveEvidence(input, query));
  assert.equal(
    (
      await retrieveEvidence(input, query, {
        loadIndex: async () => {
          throw Error('corrupt');
        },
      })
    ).status,
    'unavailable',
  );
  assert.equal((await retrieveEvidence(input, { seller_notes: 'milk' })).status, 'disabled');
});

test('frozen legacy retains its version and prior broader milk retrieval independently', async () => {
  const context = { seller_notes: '', reference_query: 'source:cj product profile milk' };
  const old = await legacy(defaults, context, { limit: 5 });
  const current = await retrieveEvidence(defaults, context, { limit: 5 });
  assert.equal(old.retrieval_version, 'evidence-lexical.v1');
  assert.equal(current.retrieval_version, 'evidence-lexical.v2');
  assert.ok(old.items.length > current.items.length);
});
