import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { recommend } from '../backend/src/agent/recommend.ts';

test('Reference preview works without AI credentials and clears stale results when query changes', async ({
  page,
}) => {
  let aiCalls = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/recommend')) aiCalls++;
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đề xuất bằng AI', exact: false })).toBeDisabled();
  await page.getByText('Reference lịch sử nước ngoài · tùy chọn', { exact: true }).click();
  const preview = page.getByRole('button', { name: 'Xem reference · không gọi AI' });
  const query = page.getByLabel('Tìm reference cho AI');
  await expect(preview).toBeDisabled();
  await query.fill('source:cj cat litter cat food');
  await preview.click();
  await expect(page.getByText('CAT LITTER → CAT FOOD', { exact: true })).toBeVisible();
  await query.fill('unknown quantum xyz');
  await expect(page.getByTestId('reference-evidence')).toHaveCount(0);
  await preview.click();
  await expect(
    page.getByText('Không có reference phù hợp. AI sẽ không có evidence từ truy vấn này.'),
  ).toBeVisible();
  await query.fill('');
  await expect(page.getByTestId('reference-evidence')).toHaveCount(0);
  await expect(preview).toBeDisabled();
  expect(aiCalls).toBe(0);
});

test('AI export retains the exact reference snapshot sent to the provider', async ({ page }) => {
  let supplied: unknown;
  await page.route('**/api/health', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), aiConfigured: true, modelConfigured: true },
    });
  });
  await page.route('**/api/recommend', async (route) => {
    const result = await recommend(route.request().postDataJSON(), {
      env: { OPENAI_API_KEY: 'fixture', OPENAI_MODEL: 'fixture' },
      fetchImpl: async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        supplied = JSON.parse(request.input).reference_evidence;
        return new Response(
          JSON.stringify({
            status: 'completed',
            model: 'fixture',
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
      },
    });
    await route.fulfill({ json: result });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bức tranh lợi nhuận của bạn' })).toBeVisible();
  await page.getByText('Reference lịch sử nước ngoài · tùy chọn', { exact: true }).click();
  await page.getByLabel('Tìm reference cho AI').fill('source:cj cat litter cat food');
  await page.getByRole('button', { name: 'Đề xuất bằng AI', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ứng viên AI đã được engine kiểm tra' }),
  ).toBeVisible();
  await page.getByText('Reference đã gửi cho AI', { exact: true }).click();
  await expect(page.getByText('CAT LITTER → CAT FOOD', { exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất phương án đang chọn' }).click();
  const saved = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(saved.result.reference_evidence).toEqual(supplied);
  expect(saved.result.reference_evidence.status).toBe('matched');
  expect(saved.result.reference_evidence.items.length).toBeGreaterThan(0);
});
