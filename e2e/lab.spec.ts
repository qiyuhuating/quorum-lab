import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('committed')).toHaveText('02');
});

test('worker starts, time advances and a real proposal reaches the state machine', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByTestId('safety')).toContainText('0 violations');
  await page.getByLabel('写入键名').fill('test');
  await page.getByLabel('写入值', { exact: true }).fill('committed-from-browser');
  await page.getByRole('button', { name: '提交提案' }).click();
  await expect(page.getByRole('status')).toContainText('等待多数派确认');
  await page.getByLabel('运行实验', { exact: true }).click();
  await expect(page.getByTestId('committed')).toHaveText('03');
  await page.getByLabel('暂停实验', { exact: true }).click();
  await expect(page.getByTestId('state-machine')).toContainText('committed-from-browser');
  expect(errors).toEqual([]);
});

test('minority retains pending entries while majority commits and heals', async ({ page }) => {
  await page.getByText('更多故障实验', { exact: true }).click();
  await page.getByRole('button', { name: /少数派隔离.*两个领导者/ }).click();
  await expect(page.getByRole('status')).toContainText('2/5');
  await expect(page.getByTestId('committed')).toHaveText('02');
  await page.getByLabel('写入键名').fill('signal');
  await page.getByLabel('写入值', { exact: true }).fill('majority-safe');
  await page.getByRole('button', { name: '提交提案' }).click();
  await page.getByLabel('运行实验', { exact: true }).click();
  await expect(page.getByTestId('committed')).toHaveText('03');
  await page.getByRole('button', { name: '恢复全部链路' }).click();
  await expect(page.getByTestId('state-machine')).toContainText('majority-safe');
  await expect(page.getByTestId('state-machine')).not.toContainText('red-route');
  await page.getByLabel('暂停实验', { exact: true }).click();
  await expect(page.getByTestId('safety')).toContainText('0 violations');
});

test('leader crash elects a successor and recovery preserves committed data', async ({ page }) => {
  await page.getByText('更多故障实验', { exact: true }).click();
  await page.getByRole('button', { name: /领导者故障.*权力交接/ }).click();
  await expect(page.getByRole('status')).toContainText('已离线');
  await expect(page.getByRole('button', { name: /恢复节点 N/ })).toBeVisible();
  await expect(page.getByTestId('state-machine')).toHaveText('{}');
  await page.getByRole('button', { name: /恢复节点 N/ }).click();
  await page.getByLabel('运行实验', { exact: true }).click();
  await expect(page.getByTestId('state-machine')).toContainText('orbit');
  await page.getByLabel('暂停实验', { exact: true }).click();
  await expect(page.getByTestId('safety')).toContainText('0 violations');
});

test('six narrated checkpoints show actual minority, majority and healed evidence', async ({
  page,
}) => {
  await page.getByRole('button', { name: '章节 3 少数派的困局' }).click();
  await expect(page.getByTestId('chapter-proof')).toContainText('2/5');
  await expect(page.getByTestId('committed')).toHaveText('02');
  await page.getByRole('button', { name: '章节 4 多数派继续' }).click();
  await expect(page.getByTestId('chapter-proof')).toContainText('3/5');
  await expect(page.getByTestId('committed')).toHaveText('03');
  await page.getByRole('button', { name: '章节 5 重新连通' }).click();
  await expect(page.getByTestId('clock')).toHaveText('4.80s');
  await expect(page.getByTestId('chapter-proof')).toContainText('2/5');
  await page.getByRole('button', { name: '章节 6 日志收敛' }).click();
  await expect(page.getByTestId('chapter-proof')).toHaveText(/0\/5.*5\/5.*5\/5/);
  await expect(page.getByTestId('safety')).toContainText('0 violations');
  await expect(page.locator('.entry.pending')).toHaveCount(0);
});

test('event stepping, real RPC payloads and baseline comparison survive a replay branch', async ({
  page,
}) => {
  await page.getByRole('button', { name: '章节 5 重新连通' }).click();
  await page.getByRole('button', { name: '固定当前状态作对照' }).click();
  await page.getByLabel('推进下一个协议事件').click();
  await expect(page.getByTestId('clock')).not.toHaveText('4.80s');
  await expect(page.getByTestId('comparison')).toContainText('对照 4.80s');
  await expect(page.getByRole('heading', { name: '现在，由你打破它。' })).toBeVisible();
  const message = page.getByLabel(/检查消息 .* append N/).first();
  await message.click();
  await expect(page.getByTestId('rpc-payload')).toContainText('"prevIndex"');
  await expect(page.getByTestId('rpc-payload')).toContainText('"leaderCommit"');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出实验' }).click();
  const exported = await downloadPromise;
  const before = await page.getByTestId('clock').textContent();
  await page.getByRole('button', { name: '重置' }).click();
  await page.getByLabel('导入实验文件').setInputFiles((await exported.path())!);
  await expect(page.getByTestId('clock')).toHaveText(before!);
});

test('first desktop viewport includes the complete log matrix and all chapter controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const bounds = await page.locator('.log-matrix').boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
  const chapter = await page.getByRole('button', { name: '章节 6 日志收敛' }).boundingBox();
  expect(chapter!.y + chapter!.height).toBeLessThanOrEqual(900);
});

test('reduced motion keeps the narrative and keyboard interactions functional', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const animation = await page
    .locator('.leader-orbit')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
  const chapter = page.getByRole('button', { name: '章节 3 少数派的困局' });
  await chapter.focus();
  await page.keyboard.press('Enter');
  await expect(chapter).toHaveAttribute('aria-current', 'step');
});

test('export/import restores exact virtual state; invalid imports preserve the current experiment', async ({
  page,
}) => {
  await page.getByLabel('单步推进100毫秒').click();
  await expect(page.getByTestId('clock')).toHaveText('2.30s');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出实验' }).click();
  const exported = await downloadPromise;
  const file = await exported.path();
  const before = await page.getByTestId('safety').textContent();
  await page.getByRole('button', { name: '重置' }).click();
  await expect(page.getByTestId('clock')).toHaveText('2.20s');
  await page.getByLabel('导入实验文件').setInputFiles(file!);
  await expect(page.getByTestId('clock')).toHaveText('2.30s');
  await expect(page.getByTestId('safety')).toHaveText(before!);
  await page.getByLabel('导入实验文件').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('clock')).toHaveText('2.30s');
});

test('rewind discards future writes only after an explicit branch action', async ({ page }) => {
  const slider = page.getByLabel('操作回放');
  await slider.fill('0');
  await expect(page.getByTestId('committed')).toHaveText('00');
  await expect(page.getByTestId('clock')).toHaveText('0.00s');
  await slider.press('End');
  await expect(page.getByTestId('committed')).toHaveText('02');
  await slider.fill('0');
  await expect(page.getByTestId('clock')).toHaveText('0.00s');
  await page.getByLabel('单步推进100毫秒').click();
  await expect(page.getByTestId('clock')).toHaveText('0.10s');
  await expect(slider).toHaveAttribute('max', '1');
  await expect(page.getByTestId('committed')).toHaveText('00');
});

test('keyboard selects SVG nodes and dialog has a working escape path', async ({ page }) => {
  const node = page.getByRole('button', { name: '选择节点 N3', exact: true });
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(node).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '协议说明' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('mobile and tablet fit without horizontal document overflow', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `viewport ${width}`,
    ).toBeLessThanOrEqual(width);
    await expect(page.getByRole('button', { name: '提交提案' })).toBeVisible();
  }
});

test('loads from a repository subpath with no external asset requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (req) => requests.push(req.url()));
  // The portable production server handles this prefix exactly like GitHub Pages.
  await page.goto('/quorum-lab/');
  await expect(page.getByTestId('committed')).toHaveText('02');
  expect(requests.filter((url) => !url.startsWith('http://127.0.0.1:4173/'))).toEqual([]);
});
