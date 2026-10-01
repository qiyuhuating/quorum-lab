import { test, expect } from '@playwright/test';

test('automatic tour can restart from the final chapter, completes and stops', async ({ page }) => {
  test.setTimeout(25000);
  await page.goto('/');
  await expect(page.getByTestId('committed')).toHaveText('02');
  await page.getByRole('button', { name: '章节 6 日志收敛' }).click();
  await expect(page.getByTestId('committed')).toHaveText('03');
  await page.getByRole('button', { name: '自动导览' }).click();
  await expect(page.getByRole('button', { name: '停止导览' })).toBeVisible();
  await expect(page.getByRole('button', { name: '章节 1 共同的事实' })).toHaveAttribute(
    'aria-current',
    'step',
  );
  await expect(page.getByRole('button', { name: '章节 6 日志收敛' })).toHaveAttribute(
    'aria-current',
    'step',
    { timeout: 21000 },
  );
  await expect(page.getByRole('button', { name: '自动导览' })).toBeVisible();
  await expect(page.getByTestId('chapter-proof')).toHaveText(/0\/5.*5\/5.*5\/5/);
});
