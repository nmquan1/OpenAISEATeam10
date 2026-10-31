import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaults,
  parseInput,
  parseRequest,
  parseRecommendationRequest,
  parseCandidateProposal,
  ValidationError,
} from '../../contracts/model.ts';
const input = () => structuredClone(defaults);
test('canonical input rejects coercion, unknown fields, incomplete payloads and invalid object shapes', () => {
  for (const value of [
    null,
    [],
    {},
    'input',
    { ...input(), extra: 1 },
    { ...input(), objective: 'profit' },
  ])
    assert.throws(() => parseInput(value), ValidationError);
  const value = input();
  const invalid = {
    ...value,
    product: {
      ...value.product,
      lines: [{ ...value.product.lines[0]!, unit_price_dong: '299000' }],
    },
  };
  assert.throws(() => parseInput(invalid), ValidationError);
  assert.deepEqual(parseRequest({ input: input() }).input, defaults);
  assert.throws(() => parseRequest({ input: input(), context: {} }), ValidationError);
});
test('money/count/rate domains reject fractional units and out-of-bounds bps', () => {
  for (const field of [
    'unit_price_dong',
    'unit_cost_dong',
    'quantity',
    'packaging_dong',
    'stock_units',
  ] as const) {
    const value = input();
    value.product.lines[0]![field] = 1.5;
    assert.throws(() => parseInput(value), ValidationError);
  }
  const value = input();
  value.economics.fee_bps = 10001;
  assert.throws(() => parseInput(value), ValidationError);
  value.economics.fee_bps = 100.5;
  assert.throws(() => parseInput(value), ValidationError);
});
test('cross-field validation rejects duplicate SKUs, reversed traffic and invalid response curves', () => {
  let value = input();
  value.product.lines.push({ ...value.product.lines[0]! });
  assert.throws(() => parseInput(value), /Duplicate/);
  value = input();
  value.assumptions.traffic.low_bps = 100000;
  assert.throws(() => parseInput(value), ValidationError);
  for (const curve of [
    [{ discount_bps: 1, cvr_multiplier_bps: 10000 }],
    [{ discount_bps: 0, cvr_multiplier_bps: 11000 }],
    [
      { discount_bps: 0, cvr_multiplier_bps: 10000 },
      { discount_bps: 100, cvr_multiplier_bps: 12000 },
      { discount_bps: 100, cvr_multiplier_bps: 13000 },
    ],
    [
      { discount_bps: 0, cvr_multiplier_bps: 10000 },
      { discount_bps: 100, cvr_multiplier_bps: 12000 },
      { discount_bps: 200, cvr_multiplier_bps: 11000 },
    ],
  ]) {
    value = input();
    value.assumptions.response_curve = curve;
    assert.throws(() => parseInput(value), ValidationError);
  }
});
test('campaign aggregate limit prevents unsafe serialized numeric totals', () => {
  const value = input();
  value.product.lines = [
    {
      sku_id: 'A',
      quantity: 1000,
      unit_price_dong: 1000000000,
      unit_cost_dong: 1000000000,
      packaging_dong: 1000000000,
      stock_units: 1000000,
    },
  ];
  value.product.lines.push({ ...value.product.lines[0]!, sku_id: 'B' });
  assert.throws(() => parseInput(value), ValidationError);
});
test('structured historical context is bounded, typed and explicitly user reported', () => {
  const context = {
    seller_notes: 'Shop ưu tiên lợi nhuận',
    history: {
      source: 'user_reported',
      campaigns: [
        {
          label: '11.11',
          visits: 1000,
          orders: 100,
          revenue_dong: 1000000,
          voucher_spend_dong: 10000,
        },
      ],
    },
  };
  assert.deepEqual(parseRecommendationRequest({ input: input(), context }).context, context);
  for (const invalid of [
    null,
    'text',
    { seller_notes: 'a'.repeat(4001) },
    { seller_notes: 'x', history: { ...context.history, source: 'verified' } },
    {
      seller_notes: 'x',
      history: {
        ...context.history,
        campaigns: [{ ...context.history.campaigns[0], orders: 1001 }],
      },
    },
  ])
    assert.throws(
      () => parseRecommendationRequest({ input: input(), context: invalid }),
      ValidationError,
    );
});
test('provider proposal schema enforces all currency/rate bounds and candidate count', () => {
  const voucher = { type: 'fixed', amount_dong: 10000, minimum_dong: 0, seller_funding_bps: 10000 };
  assert.deepEqual(parseCandidateProposal({ candidates: [voucher] }), { candidates: [voucher] });
  for (const proposal of [
    { candidates: [] },
    { candidates: Array(6).fill(voucher) },
    { candidates: [{ ...voucher, amount_dong: 0.5 }] },
    { candidates: [{ ...voucher, seller_funding_bps: 10001 }] },
    { candidates: [{ ...voucher, stock_units: 999 }] },
    {
      candidates: [
        {
          type: 'percent',
          rate_bps: 10001,
          cap_dong: 1000,
          minimum_dong: 0,
          seller_funding_bps: 10000,
        },
      ],
    },
  ])
    assert.throws(() => parseCandidateProposal(proposal), ValidationError);
});

test('direct historical JSON cannot bypass duplicate campaign and unsafe-label protection', () => {
  const campaign = {
    label: 'Sale A',
    visits: 100,
    orders: 10,
    revenue_dong: 100000,
    voucher_spend_dong: 10000,
  };
  for (const label of ['Sale A', ' sale a ', '=SUM(A1)', 'A\u0000B']) {
    assert.throws(
      () =>
        parseRecommendationRequest({
          input: input(),
          context: {
            seller_notes: '',
            history: { source: 'user_reported', campaigns: [campaign, { ...campaign, label }] },
          },
        }),
      ValidationError,
    );
  }
  const result = parseRecommendationRequest({
    input: input(),
    context: {
      seller_notes: '',
      history: { source: 'user_reported', campaigns: [{ ...campaign, label: ' Sale A ' }] },
    },
  });
  assert.equal(result.context.history!.campaigns[0]!.label, 'Sale A');
});
