import { defaults, type Voucher } from '@market-maker/contracts';
import { evaluate, evaluateVouchers } from '../backend/src/engine/index.ts';
import { recommend } from '../backend/src/agent/recommend.ts';
try {
  process.loadEnvFile('.env');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const live = process.argv.includes('--live');
const cases = [
  { name: 'default', input: structuredClone(defaults) },
  {
    name: 'zero-budget',
    input: { ...structuredClone(defaults), constraints: { budget_dong: 0, quota: 0 } },
  },
  {
    name: 'tight-stock',
    input: {
      ...structuredClone(defaults),
      product: {
        ...defaults.product,
        lines: defaults.product.lines.map((line) => ({ ...line, stock_units: 2 })),
      },
    },
  },
];
const grid: Voucher[] = [100, 500, 1000, 1500, 2000].map((rate_bps) => ({
  type: 'percent',
  rate_bps,
  cap_dong: 50000,
  minimum_dong: 0,
  seller_funding_bps: 10000,
}));
const rows = [];
for (const { name, input } of cases) {
  const baseline = evaluate(input);
  const gridBest = Math.max(
    ...grid.map((voucher) => evaluateVouchers(input, [voucher]).recommended.score),
  );
  const result = live
    ? await recommend({
        input,
        context: { seller_notes: 'Protect profit; do not change seller constraints.' },
      })
    : evaluateVouchers(input, [grid[1]!, grid[3]!]);
  rows.push({
    case: name,
    mode: live ? 'live_openai' : 'fixture_no_provider',
    baseline_score: baseline.recommended.score,
    candidate_score: result.recommended.score,
    grid_score: gridBest,
    gap_to_grid: gridBest - result.recommended.score,
    baseline_preserved: result.recommended.score >= baseline.recommended.score,
  });
}
console.table(rows);
console.log(
  'Synthetic scenarios only. Scores measure the configured engine, not real-world sales lift or causal benefit of AI.',
);
if (rows.some((row) => !row.baseline_preserved)) process.exitCode = 1;
