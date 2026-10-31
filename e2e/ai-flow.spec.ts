import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Download } from '@playwright/test';
import type { RecommendationResult } from '../contracts/model.ts';
import { recommend } from '../backend/src/agent/recommend.ts';

const fixed = (amount_dong: number, seller_funding_bps = 10000) => ({
  type: 'fixed',
  amount_dong,
  minimum_dong: 0,
  seller_funding_bps,
});
// Four valid candidates plus one with changed seller funding, which the backend must reject.
const candidates = [fixed(10000), fixed(20000), fixed(30000), fixed(40000), fixed(5000, 5000)];

async function mockAiConfigured(page: Page) {
  await page.route('**/api/health', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), aiConfigured: true, modelConfigured: true },
    });
  });
}
async function readDownload(pending: Promise<Download>) {
  return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
// The app shows one step per tab; tests switch tabs the way a user would.
const openStep = (page: Page, name: RegExp) => page.getByRole('tab', { name }).click();
async function openApp(page: Page) {
  await page.goto('/');
  await openStep(page, /Kết quả/);
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  await openStep(page, /Nhờ AI/);
}
const aiButton = (page: Page) => page.getByRole('button', { name: 'Đề xuất bằng AI', exact: true });

test('Mock AI: top 5 → dashboard → export → apply → export uses the applied voucher and shows the context AI used', async ({
  page,
}) => {
  await mockAiConfigured(page);
  let result: RecommendationResult | undefined;
  await page.route('**/api/recommend', async (route) => {
    // The real recommendation service runs against a mocked provider response.
    result = await recommend(route.request().postDataJSON(), {
      env: { OPENAI_API_KEY: 'fixture', OPENAI_MODEL: 'fixture' },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            status: 'completed',
            model: 'e2e-fixture',
            usage: { input_tokens: 10, output_tokens: 20 },
            output: [{ content: [{ type: 'output_text', text: JSON.stringify({ candidates }) }] }],
          }),
        ),
    });
    await route.fulfill({ json: result });
  });
  await openApp(page);
  await page.getByLabel('Ghi chú về shop và khách hàng').fill('Khách quen, ưu tiên ít rủi ro');
  await page.getByLabel('Nhập lịch sử sale CSV', { exact: true }).setInputFiles({
    name: 'history.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'label,visits,orders,revenue_dong,voucher_spend_dong\nSale A,1000,30,8970000,300000\n',
    ),
  });
  await expect(page.getByText(/Đã kiểm tra 1 đợt sale từ CSV/)).toBeVisible();

  await aiButton(page).click();
  await expect(
    page.getByRole('heading', { name: 'Ứng viên AI đã được engine kiểm tra' }),
  ).toBeVisible();
  const offers = result!.strategies.slice(0, 5);
  const radios = page.getByRole('radio');
  await expect(radios).toHaveCount(offers.length);
  expect(
    await radios.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLInputElement).value),
    ),
  ).toEqual(offers.map((strategy) => strategy.id));

  // Context the AI used: seller notes, history aggregates and candidate audit.
  await expect(page.getByText('Ghi chú người bán: Khách quen, ưu tiên ít rủi ro')).toBeVisible();
  await expect(page.getByTestId('ai-observed-history')).toContainText('CVR quan sát 3%');
  await expect(page.getByTestId('ai-candidate-audit')).toContainText('Loại 1 ứng viên');

  const chosen = offers.find(
    (strategy) =>
      strategy.voucher.type === 'fixed' &&
      strategy.discount_dong > 0 &&
      strategy.id !== result!.recommended.id,
  )!;
  await page.locator(`input[type="radio"][value="${chosen.id}"]`).check();
  await expect(
    page.getByRole('region', { name: `Dashboard chiến lược ${chosen.name}`, exact: true }),
  ).toBeVisible();

  const exportButton = page.getByRole('button', { name: 'Xuất phương án đang chọn' });
  let pending = page.waitForEvent('download');
  await exportButton.click();
  const aiPlan = await readDownload(pending);
  expect(aiPlan.selected_strategy.id).toBe(chosen.id);
  expect(aiPlan.result.provider).toBe('openai');
  expect(aiPlan.result.rejected_candidates).toBe(1);
  expect(aiPlan.result.decision_context.campaign_count).toBe(1);
  expect(aiPlan.context.seller_notes).toBe('Khách quen, ưu tiên ít rủi ro');

  await page.getByRole('button', { name: 'Áp dụng voucher vào thiết lập' }).click();
  await expect(page.getByText(/Đã đưa voucher/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  await openStep(page, /Nhập số liệu/);
  await expect(page.getByLabel('Mức giảm / giỏ (₫)')).toHaveValue(
    String(chosen.voucher.type === 'fixed' && chosen.voucher.amount_dong),
  );
  await openStep(page, /Kết quả/);

  pending = page.waitForEvent('download');
  await exportButton.click();
  const appliedPlan = await readDownload(pending);
  expect(appliedPlan.result.provider).toBeUndefined();
  expect(appliedPlan.result.input.voucher).toEqual(chosen.voucher);
});

test('AI request shows loading, can be cancelled, and keeps the simulation usable', async ({
  page,
}) => {
  await mockAiConfigured(page);
  // Never answered: only the user's cancel can end this request.
  await page.route('**/api/recommend', () => {});
  await openApp(page);
  await aiButton(page).click();
  await expect(page.getByRole('button', { name: 'Đang tạo và kiểm tra ứng viên…' })).toBeDisabled();
  await expect(page.locator('.ai-panel')).toHaveAttribute('aria-busy', 'true');
  await page.getByRole('button', { name: 'Hủy yêu cầu AI' }).click();
  await expect(page.getByRole('status')).toHaveText('Đã hủy yêu cầu AI.');
  await expect(page.getByRole('button', { name: 'Hủy yêu cầu AI' })).toHaveCount(0);
  await expect(aiButton(page)).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await openStep(page, /Kết quả/);
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
});

test('AI provider error is shown with its request id and the simulation stays visible', async ({
  page,
}) => {
  await mockAiConfigured(page);
  await page.route('**/api/recommend', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/problem+json',
      json: { status: 502, detail: 'AI provider unavailable', requestId: 'req-e2e' },
    }),
  );
  await openApp(page);
  await aiButton(page).click();
  await expect(page.getByRole('alert')).toHaveText('AI provider unavailable · Mã hỗ trợ: req-e2e');
  await expect(page.getByRole('status')).toHaveText(
    'Yêu cầu AI chưa thành công. Mô phỏng trước đó vẫn dùng được.',
  );
  await expect(aiButton(page)).toBeEnabled();
  await openStep(page, /Kết quả/);
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
});
