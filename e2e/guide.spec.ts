import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('Guide opens on the first visit, can be reopened, and starts the user at step 1', async ({
  page,
}) => {
  await page.goto('/');
  const guide = page.getByRole('dialog', { name: 'Hướng dẫn sử dụng' });
  await expect(guide).toBeVisible();
  await guide
    .getByRole('navigation', { name: 'Mục lục hướng dẫn' })
    .getByRole('link', { name: 'Thuật ngữ' })
    .click();
  await expect(guide.getByRole('heading', { name: 'Thuật ngữ' })).toBeInViewport();

  await guide.getByRole('button', { name: 'Bắt đầu với bước 1' }).click();
  await expect(guide).toBeHidden();
  await expect(page.getByRole('tab', { name: /Nhập số liệu/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // Seen once: a reload does not interrupt again, but the header button reopens it.
  await page.reload();
  await expect(page.getByRole('tab', { name: /Nhập số liệu/ })).toBeVisible();
  await expect(guide).toBeHidden();
  await page.getByRole('button', { name: 'Hướng dẫn', exact: true }).click();
  await expect(guide).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
});

test('Guide fits a phone screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const guide = page.getByRole('dialog', { name: 'Hướng dẫn sử dụng' });
  await expect(guide).toBeVisible();
  expect(await guide.evaluate((element) => element.getBoundingClientRect().width)).toBe(390);
  expect(
    await page
      .locator('.guide-body')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await expect(guide.getByRole('button', { name: 'Bắt đầu với bước 1' })).toBeInViewport();
});
