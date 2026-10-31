import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/api/app.ts';
import { exampleStrategyRequest, parsePortfolioResult } from '../../contracts/portfolio.ts';

test('portfolio API exposes the migrated strategy workflow and Swagger contract', async (t) => {
  const app = await buildApp({ logger: false });
  t.after(() => app.close());
  const response = await app.inject({
    method: 'POST',
    url: '/api/strategy',
    payload: exampleStrategyRequest,
  });
  assert.equal(response.statusCode, 200, response.body);
  const result = parsePortfolioResult(response.json());
  assert.equal(result.mode, 'heuristic_only');
  assert.equal(
    result.vouchers.reduce((sum, voucher) => sum + voucher.qty, 0),
    exampleStrategyRequest.vouchers,
  );
  const openapi = await app.inject('/api/docs/json');
  assert.ok(openapi.json().paths['/api/strategy'].post.requestBody);
  assert.ok(openapi.json().paths['/api/strategy'].post.responses['200']);
  for (const payload of [
    { ...exampleStrategyRequest, extra: 1 },
    { ...exampleStrategyRequest, products: [] },
    { ...exampleStrategyRequest, vouchers: '10' },
  ]) {
    const invalid = await app.inject({ method: 'POST', url: '/api/strategy', payload });
    assert.equal(invalid.statusCode, 422, invalid.body);
  }
});
