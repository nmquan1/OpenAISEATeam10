import { test, expect, type Page } from '@playwright/test';
import type { EvaluationResult } from '../contracts/model.ts';

// The app shows one step per tab; tests switch tabs the way a user would.
const openStep = (page: Page, name: RegExp) => page.getByRole('tab', { name }).click();

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

test('Merged marketplace fees, portfolio and currency keyboard controls work with the new dashboard', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await openStep(page, /Kết quả/);
  await expect(page.getByTestId('dashboard-profit')).toBeVisible();
  await openStep(page, /Nhập số liệu/);
  const price = page.getByLabel('Giá bán / SP (₫)', { exact: true });
  await price.focus();
  await page.keyboard.press('ArrowUp');
  await expect(price).toHaveValue('300000');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(price).toHaveValue('290000');
  await price.fill('299001');
  const calculation = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/evaluate') &&
      response.request().postDataJSON()?.input.marketplace?.category === 'beauty',
  );
  await page.getByLabel('Ngành hàng Shopee', { exact: true }).selectOption('beauty');
  const result: EvaluationResult = await (await calculation).json();
  expect(result.engine_version).toBe('2.1.0');
  await expect(page.getByLabel('Phí tổng hợp (%)', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Thuế (%)', { exact: true })).toBeDisabled();
  await openStep(page, /Kết quả/);
  await expect(page.getByTestId('dashboard-profit')).toHaveText(
    money(result.recommended.base_profit_dong),
  );
  const discounted = result.strategies.find((strategy) => strategy.discount_dong > 0)!;
  await page.locator(`input[name="selected-strategy"][value="${discounted.id}"]`).check();
  await page.getByText(/Chi tiết phí Shopee \/ giỏ/).click();
  const feeTable = page.getByRole('region', { name: 'Chi tiết phí Shopee', exact: true });
  const total = feeTable.getByRole('row').filter({ hasText: 'Tổng phí và đồng tài trợ' });
  await expect(total.getByRole('cell').last()).toHaveText(
    money(discounted.fees!.with_voucher.total),
  );
  await expect(page.getByTestId('dashboard-profit')).toHaveText(money(discounted.base_profit_dong));
  await openStep(page, /Công cụ khác/);
  await page.getByRole('button', { name: 'Lập danh mục voucher', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Danh mục voucher được phân bổ', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Đã phân bổ 300 voucher.', { exact: true })).toBeVisible();
  await openStep(page, /Nhập số liệu/);
  await page.getByLabel('Ngành hàng Shopee', { exact: true }).selectOption('');
  await expect(page.getByLabel('Phí tổng hợp (%)', { exact: true })).toBeEnabled();
  await expect(
    page.getByRole('region', { name: 'Danh mục voucher được phân bổ', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Chi tiết phí Shopee \/ giỏ/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
