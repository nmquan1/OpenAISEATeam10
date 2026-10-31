import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { defaults } from '../contracts/model.ts';
import { evaluate, evaluateVouchers } from '../backend/src/engine/index.ts';

// The app shows one step per tab; tests switch tabs the way a user would.
const openStep = (page: Page, name: RegExp) => page.getByRole('tab', { name }).click();

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

test('Top five offers keep engine order, update financial dashboards and export the chosen strategy', async ({
  page,
}) => {
  const input = structuredClone(defaults);
  input.objective = 'growth';
  input.product.lines[0]!.stock_units = 10000;
  input.constraints = { budget_dong: 100000000, quota: 10000 };
  input.assumptions.response_curve = [
    { discount_bps: 0, cvr_multiplier_bps: 10000 },
    { discount_bps: 3000, cvr_multiplier_bps: 40000 },
  ];
  const result = evaluateVouchers(
    input,
    [10000, 20000, 30000, 50000, 60000].map((amount_dong) => ({
      type: 'fixed',
      amount_dong,
      minimum_dong: 0,
      seller_funding_bps: 10000,
    })),
  );
  expect(result.strategies).toHaveLength(8);
  const offers = result.strategies.slice(0, 5);
  const baseline = result.strategies.find((strategy) => strategy.discount_dong === 0)!;
  expect(offers).not.toContain(baseline);
  await page.route('**/api/evaluate', (route) => route.fulfill({ json: result }));
  await page.goto('/');
  await openStep(page, /Kết quả/);
  const radios = page.getByRole('radio');
  await expect(radios).toHaveCount(5);
  expect(
    await radios.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLInputElement).value),
    ),
  ).toEqual(offers.map((strategy) => strategy.id));

  for (const [index, strategy] of offers.entries()) {
    await radios.nth(index).check();
    await expect(
      page.getByRole('region', { name: `Dashboard chiến lược ${strategy.name}`, exact: true }),
    ).toBeVisible();
    const base = strategy.scenarios[1]!;
    await expect(page.getByTestId('dashboard-revenue')).toHaveText(money(base.revenue_dong));
    await expect(page.getByTestId('dashboard-profit')).toHaveText(money(base.profit_dong));
    await expect(page.getByTestId('dashboard-spend')).toHaveText(money(base.spend_dong));
  }

  const selected = offers[4]!;
  await page.getByLabel('Chỉ số biểu đồ', { exact: true }).selectOption('revenue_dong');
  const high = page
    .getByRole('group', { name: 'Biểu đồ Doanh thu', exact: true })
    .getByRole('button', { name: /^Cao:/ });
  await high.focus();
  await page.keyboard.press('Enter');
  await expect(high).toBeFocused();
  await expect(high).toHaveAttribute('aria-pressed', 'true');
  const highRow = selected.scenarios[2]!;
  await expect(page.getByTestId('dashboard-revenue')).toHaveText(money(highRow.revenue_dong));
  await expect(page.getByTestId('dashboard-profit')).toHaveText(money(highRow.profit_dong));
  await expect(page.getByTestId('dashboard-orders')).toHaveText(
    new Intl.NumberFormat('vi-VN').format(highRow.orders),
  );
  await expect(page.locator('.dashboard-difference')).toContainText(
    money(highRow.profit_dong - baseline.scenarios[2]!.profit_dong),
  );

  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất phương án đang chọn' }).click();
  const saved = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(saved.selected_strategy).toEqual(selected);
  expect(saved.result.strategies).toHaveLength(8);
});

test('Mobile dashboard shows losses and handles zero traffic without overflow or invalid values', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const input = structuredClone(defaults);
  input.product.lines[0]!.unit_cost_dong = 500000;
  input.assumptions.traffic.low_bps = 0;
  const result = evaluate(input);
  await page.route('**/api/evaluate', (route) => route.fulfill({ json: result }));
  await page.goto('/');
  await openStep(page, /Kết quả/);
  const strategy = result.recommended;
  expect(strategy.base_profit_dong).toBeLessThan(0);
  await expect(page.getByTestId('dashboard-profit')).toHaveText(money(strategy.base_profit_dong));
  await expect(page.getByTestId('dashboard-profit')).toHaveClass(/negative/);
  const dashboard = page.getByRole('region', {
    name: `Dashboard chiến lược ${strategy.name}`,
    exact: true,
  });
  await dashboard
    .getByRole('group', { name: 'Kịch bản traffic' })
    .getByRole('button', { name: 'Thấp', exact: true })
    .click();
  await expect(page.getByTestId('dashboard-profit')).toHaveText(money(0));
  await expect(page.getByTestId('dashboard-orders')).toHaveText('0');
  await expect(dashboard).not.toContainText(/NaN|Infinity|undefined/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
