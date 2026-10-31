import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, type EvaluationInput } from '../../contracts/model.ts';
import { evaluateCandidate, searchVouchers } from '../src/engine/search.ts';
import { diverseOffers, minimumOfferDistanceDong } from '../src/engine/diversity.ts';

function scored(input: EvaluationInput, discounts: number[]) {
  return discounts.map((amount_dong) =>
    evaluateCandidate(input, {
      type: 'fixed',
      amount_dong,
      minimum_dong: 0,
      seller_funding_bps: input.voucher.seller_funding_bps,
    }),
  );
}
const rank = (
  a: { score: number; discount_dong: number; id: string },
  b: { score: number; discount_dong: number; id: string },
) => b.score - a.score || a.discount_dong - b.discount_dong || a.id.localeCompare(b.id);
test('preserves exact best and input pool while dropping adjacent one-dong variations', () => {
  const input = structuredClone(defaults);
  const pool = scored(input, [0, 1, 2, 3, 4, 3000, 6000, 9000, 12000, 15000]);
  const before = JSON.stringify(pool);
  const expectedBest = [...pool].sort(rank)[0]!;
  const offers = diverseOffers(input, pool);
  assert.equal(offers[0], expectedBest);
  assert.equal(offers.length, 5);
  assert.equal(JSON.stringify(pool), before);
  for (let i = 0; i < offers.length; i++)
    for (let j = i + 1; j < offers.length; j++)
      assert.ok(
        Math.abs(offers[i]!.discount_dong - offers[j]!.discount_dong) >=
          minimumOfferDistanceDong(input),
      );
  assert.equal(diverseOffers(input, pool.slice(0, 5)).length, 1);
});
test('threshold uses integer basket total and ceiling; respects limit and empty pools', () => {
  const input = structuredClone(defaults);
  input.product.lines[0]!.unit_price_dong = 100_001;
  assert.equal(minimumOfferDistanceDong(input), 1001);
  input.product.lines[0]!.unit_price_dong = 40;
  assert.equal(minimumOfferDistanceDong(input), 1000);
  const pool = scored(input, [0, 1, 20, 40]);
  assert.equal(diverseOffers(input, pool).length, 1);
  assert.deepEqual(diverseOffers(input, []), []);
  assert.throws(() => diverseOffers(input, pool, 0));
  assert.throws(() => diverseOffers(input, pool, 6));
});
test('zero funding and zero budget retain engine scores and constraints without inventing offers', () => {
  for (const funding of [0, 10000]) {
    const input = structuredClone(defaults);
    input.voucher.seller_funding_bps = funding;
    input.constraints.budget_dong = 0;
    const search = searchVouchers(input);
    const pool = scored(input, search.evaluated_discounts_dong);
    const offers = diverseOffers(input, pool, 3);
    assert.equal(offers[0]!.id, search.recommended.id);
    assert.equal(offers[0]!.score, search.recommended.score);
    assert.ok(offers.length <= 3);
    for (const offer of offers) {
      assert.equal(offer.voucher.seller_funding_bps, funding);
      assert.ok(offer.scenarios.every((scenario) => scenario.spend_dong === 0));
      assert.ok(pool.includes(offer));
    }
  }
});
