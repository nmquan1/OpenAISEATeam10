import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { recommend } from '../backend/src/agent/recommend.ts';

// The app shows one step per tab; tests switch tabs the way a user would.
const openStep = (page: Page, name: RegExp) => page.getByRole('tab', { name }).click();

test('Built app calculates, keeps keyboard focus, exports the selected strategy and restores draft', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await openStep(page, /Kết quả/);
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  const low = page
    .getByRole('group', { name: 'Kịch bản traffic' })
    .getByRole('button', { name: 'Thấp', exact: true });
  await low.click();
  await expect(low).toBeFocused();
  await openStep(page, /Nhờ AI/);
  await page.getByLabel('Ghi chú về shop và khách hàng').fill('Shop ưu tiên lợi nhuận');
  await expect(page.getByText('Bản nháp đã lưu trên trình duyệt.')).toBeVisible();
  await openStep(page, /Kết quả/);
  const radios = page.getByRole('radio');
  await radios.last().check();
  const chosen = await radios.last().inputValue();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất phương án đang chọn' }).click();
  const download = await downloading;
  const path = await download.path();
  const exported = JSON.parse(await readFile(path!, 'utf8'));
  expect(exported.selected_strategy.id).toBe(chosen);
  expect(exported.context.seller_notes).toBe('Shop ưu tiên lợi nhuận');
  await page.reload();
  await openStep(page, /Nhờ AI/);
  await expect(page.getByLabel('Ghi chú về shop và khách hàng')).toHaveValue(
    'Shop ưu tiên lợi nhuận',
  );
  expect(errors).toEqual([]);
});

test('Without credentials AI is explicitly disabled and API docs allow interactive requests', async ({
  page,
}) => {
  await page.goto('/');
  await openStep(page, /Kết quả/);
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  await openStep(page, /Nhờ AI/);
  await expect(page.getByRole('button', { name: 'Đề xuất bằng AI', exact: false })).toBeDisabled();
  await page.goto('/api/docs');
  await expect(page.getByRole('heading', { name: 'Market Maker API' })).toBeVisible();
  await expect(page.getByText('/api/evaluate', { exact: true })).toBeVisible();
  await page.getByText('/api/evaluate', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Execute', exact: true })).toBeVisible();
});

test('Historical CSV is validated and enters context without changing forecast assumptions', async ({
  page,
}) => {
  await page.goto('/');
  await openStep(page, /Kết quả/);
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  await openStep(page, /Nhờ AI/);
  await page.getByLabel('Nhập lịch sử sale CSV', { exact: true }).setInputFiles({
    name: 'history.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'label,visits,orders,revenue_dong,voucher_spend_dong\nSale A,1000,30,8970000,300000\n',
    ),
  });
  await expect(page.getByText(/Đã kiểm tra 1 đợt sale từ CSV/)).toBeVisible();
  await page.getByText('Lịch sử sale tổng hợp · tùy chọn (1)', { exact: true }).click();
  await expect(page.getByLabel('Tên đợt sale')).toHaveValue('Sale A');
});

test('AI fixture can be selected, exported with provenance and applied to the form', async ({
  page,
}) => {
  await page.route('**/api/health', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), aiConfigured: true, modelConfigured: true },
    });
  });
  await page.route('**/api/recommend', async (route) => {
    const body = route.request().postDataJSON();
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          status: 'completed',
          model: 'e2e-fixture',
          usage: { input_tokens: 10, output_tokens: 20 },
          output: [
            {
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    candidates: [
                      {
                        type: 'fixed',
                        amount_dong: 10000,
                        minimum_dong: 0,
                        seller_funding_bps: 10000,
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
      );
    const result = await recommend(body, {
      env: { OPENAI_API_KEY: 'fixture', OPENAI_MODEL: 'fixture' },
      fetchImpl,
    });
    await route.fulfill({ json: result });
  });
  await page.goto('/');
  await openStep(page, /Kết quả/);
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  await openStep(page, /Nhờ AI/);
  await page.getByRole('button', { name: 'Đề xuất bằng AI', exact: false }).click();
  await expect(
    page.getByRole('heading', { name: 'Ứng viên AI đã được engine kiểm tra' }),
  ).toBeVisible();
  const radios = page.getByRole('radio');
  await radios.last().check();
  const selected = await radios.last().inputValue();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất phương án đang chọn' }).click();
  const saved = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(saved.selected_strategy.id).toBe(selected);
  expect(saved.result.provider).toBe('openai');
  expect(saved.result.model).toBe('e2e-fixture');
  await page.getByRole('button', { name: 'Áp dụng voucher vào thiết lập' }).click();
  await expect(page.getByText(/Đã đưa voucher/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
});

test('Step tabs show one step at a time and support arrow-key navigation', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('tab', { name: /Nhập số liệu/ });
  const results = page.getByRole('tab', { name: /Kết quả/ });
  await expect(input).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Nhập số liệu giỏ hàng' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeHidden();
  await expect(results).toContainText('Đề xuất:');
  await input.focus();
  await page.keyboard.press('ArrowRight');
  await expect(results).toBeFocused();
  await expect(results).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: /Công cụ khác/ })).toBeFocused();
  await page.getByRole('tab', { name: /Kết quả/ }).click();
  await page.getByRole('button', { name: 'Nhờ AI gợi ý thêm voucher' }).click();
  await expect(page.getByRole('tab', { name: /Nhờ AI/ })).toHaveAttribute('aria-selected', 'true');
});
