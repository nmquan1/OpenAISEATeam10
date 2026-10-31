import { expect, test, type Page } from '@playwright/test';
import { defaults, type RecommendationResult, type Voucher } from '../contracts/model.ts';
import { recommend } from '../backend/src/agent/recommend.ts';

async function openStockLimitedShop(page: Page) {
  const input = structuredClone(defaults);
  input.product.lines[0] = {
    ...input.product.lines[0]!,
    unit_price_dong: 100_000,
    unit_cost_dong: 50_000,
    stock_units: 100,
  };
  await page.addInitScript((draftInput) => {
    localStorage.setItem(
      'market-maker.draft.v2',
      JSON.stringify({
        format: 'market-maker-plan.v2',
        input: draftInput,
        context: { seller_notes: '' },
      }),
    );
  }, input);
  await page.route('**/api/health', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), aiConfigured: true, modelConfigured: true },
    });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: /Kết quả/ }).click();
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
}

async function mockRecommendation(page: Page, candidates: Voucher[]) {
  let result: RecommendationResult | undefined;
  await page.route('**/api/recommend', async (route) => {
    result = await recommend(route.request().postDataJSON(), {
      env: { OPENAI_API_KEY: 'fixture', OPENAI_MODEL: 'fixture' },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            status: 'completed',
            model: 'fixture',
            output: [{ content: [{ type: 'output_text', text: JSON.stringify({ candidates }) }] }],
          }),
        ),
    });
    await route.fulfill({ json: result });
  });
  return () => result!;
}

test('failed AI stays clearly separate from a baseline-only simulation after recalculation', async ({
  page,
}) => {
  await page.route('**/api/recommend', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/problem+json',
      json: { status: 502, detail: 'AI provider unavailable', requestId: 'req-source' },
    }),
  );
  await openStockLimitedShop(page);
  const explanation = page.getByTestId('baseline-explanation');
  await expect(explanation).toContainText('thấp hơn minimum spend');
  await expect(explanation).toContainText('không tự giả định khách mua thêm');
  await expect(explanation).toContainText('đã chạm tồn kho (100 đơn)');
  await expect(explanation).toContainText('chỉ còn 1 phương án');
  await expect(explanation).toContainText('Chưa có phương án giảm giá hiệu lực để so sánh');
  await page.getByRole('tab', { name: /Nhờ AI/ }).click();
  await page.getByRole('button', { name: 'Đề xuất bằng AI', exact: true }).click();
  const notice = page.getByTestId('ai-failure-notice');
  await expect(notice).toContainText('chưa có đề xuất AI mới');
  await expect(notice.getByRole('alert')).toHaveText(
    'AI provider unavailable · Mã hỗ trợ: req-source',
  );
  await expect(notice).toContainText('không phải là câu trả lời của AI');
  await page.getByRole('tab', { name: /Kết quả/ }).click();
  await expect(page.getByTestId('result-source-label')).toContainText('Mô phỏng engine');
  await page.getByRole('tab', { name: /Nhập số liệu/ }).click();
  const evaluated = page.waitForResponse('**/api/evaluate');
  await page.getByRole('button', { name: 'Phân tích chiến lược', exact: true }).click();
  await evaluated;
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  await expect(notice).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Ứng viên AI đã được engine kiểm tra' }),
  ).toHaveCount(0);
});

test('successful AI with ineligible vouchers explains one effective baseline without claiming it beat candidates', async ({
  page,
}) => {
  const getResult = await mockRecommendation(page, [
    {
      type: 'percent',
      rate_bps: 2000,
      cap_dong: 50_000,
      minimum_dong: 199_000,
      seller_funding_bps: 10_000,
    },
  ]);
  await openStockLimitedShop(page);
  await page.getByRole('tab', { name: /Nhờ AI/ }).click();
  await page.getByRole('button', { name: 'Đề xuất bằng AI', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ứng viên AI đã được engine kiểm tra' }),
  ).toBeVisible();
  expect(getResult().strategies).toHaveLength(1);
  await expect(page.getByTestId('result-source-label')).toContainText('AI tạo ứng viên');
  await expect(page.getByTestId('baseline-explanation')).toContainText(
    'Chưa có phương án giảm giá hiệu lực để so sánh',
  );
  await expect(page.getByTestId('baseline-explanation')).not.toContainText(
    'không đạt điểm cao hơn',
  );
  await expect(page.getByTestId('ai-failure-notice')).toHaveCount(0);
});

test('baseline ranking describes the actual objective and preserves prior AI provenance after another call fails', async ({
  page,
}) => {
  const getResult = await mockRecommendation(page, [
    { type: 'fixed', amount_dong: 10_000, minimum_dong: 0, seller_funding_bps: 10_000 },
    { type: 'fixed', amount_dong: 20_000, minimum_dong: 0, seller_funding_bps: 10_000 },
  ]);
  await openStockLimitedShop(page);
  const button = page.getByRole('button', { name: 'Đề xuất bằng AI', exact: true });
  await page.getByRole('tab', { name: /Nhờ AI/ }).click();
  await button.click();
  await expect(
    page.getByRole('heading', { name: 'Ứng viên AI đã được engine kiểm tra' }),
  ).toBeVisible();
  const result = getResult();
  expect(result.recommended.discount_dong).toBe(0);
  const discountCount = result.strategies.filter((strategy) => strategy.discount_dong > 0).length;
  expect(discountCount).toBe(2);
  await expect(page.getByTestId('baseline-explanation')).toContainText(
    `Trong ${result.strategies.length} phương án đã tính, ${discountCount} phương án có giảm giá không đạt điểm cao hơn baseline`,
  );
  await expect(page.getByTestId('baseline-explanation')).toContainText(
    '70% lợi nhuận cơ sở + 30% thấp nhất',
  );
  await expect(page.getByTestId('baseline-explanation')).toContainText('không chứng minh');
  await page.route('**/api/recommend', (route) =>
    route.fulfill({ status: 502, json: { status: 502, detail: 'Fixture failure' } }),
  );
  await page.getByRole('tab', { name: /Nhờ AI/ }).click();
  await button.click();
  await expect(page.getByTestId('ai-failure-notice')).toContainText('từ lần thành công trước');
  await page.getByRole('tab', { name: /Kết quả/ }).click();
  await expect(page.getByTestId('result-source-label')).toContainText('AI tạo ứng viên');
  await expect(page.getByRole('radio')).toHaveCount(result.strategies.length);
});
