import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const url = process.env.DEMO_URL ?? 'https://qiyuhuating.github.io/quorum-lab/';
const expectedRevision = process.env.GITHUB_SHA;
const output = resolve(process.env.VALIDATION_OUTPUT ?? 'acceptance/live');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let response;
  // Pages propagation and portable-server startup are bounded readiness conditions.
  await expect
    .poll(
      async () => {
        try {
          response = await page.goto(`${url}?acceptance=${version}-${Date.now()}`, {
            timeout: 15000,
          });
          const badge = await page.locator('.version').textContent({ timeout: 5000 });
          const revision = await page.locator('meta[name="quorum-revision"]').getAttribute('content');
          return (
            badge === `v${version.split('.').slice(0, 2).join('.')}` &&
            (!expectedRevision || revision === expectedRevision)
          );
        } catch {
          return false;
        }
      },
      { timeout: 90000, intervals: [2000, 5000] },
    )
    .toBe(true);
  expect(response.status()).toBe(200);
  const external = [];
  const errors = [],
    failed = [],
    badResponses = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().startsWith('http') && new URL(r.url()).origin !== new URL(url).origin)
      external.push(r.url());
  });
  page.on('requestfailed', (r) => failed.push({ url: r.url(), reason: r.failure()?.errorText }));
  page.on('response', (r) => {
    if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() });
  });
  // Reload the ready revision with monitoring enabled, including its Worker/assets.
  await page.reload();
  if (expectedRevision)
    await expect(page.locator('meta[name="quorum-revision"]')).toHaveAttribute(
      'content',
      expectedRevision,
    );
  await expect(page.getByTestId('committed')).toHaveText('02');
  await page.getByRole('button', { name: '章节 3 少数派的困局' }).click();
  await expect(page.getByTestId('chapter-proof')).toHaveText(/2\/5.*0\/5.*2\/5/);
  await expect(page.locator('.entry.pending:not(.noop)')).toHaveCount(2);
  await page.getByRole('button', { name: '章节 4 多数派继续' }).click();
  await expect(page.getByTestId('committed')).toHaveText('03');
  await expect(page.getByTestId('chapter-proof')).toHaveText(/2\/5.*3\/5.*2\/5/);
  await page.getByRole('button', { name: '章节 5 重新连通' }).click();
  const causal = page.getByTestId('causal-panel');
  for (let i = 0; i < 70 && (await causal.getAttribute('data-code')) !== 'log-repaired'; i++) {
    const previous = await causal.getAttribute('data-event-id');
    await page.getByLabel('推进下一个协议事件').click();
    await expect(causal).not.toHaveAttribute('data-event-id', previous);
  }
  await expect(causal).toHaveAttribute('data-code', 'log-repaired');
  await expect(page.getByTestId('event-transition')).toContainText('red-route');
  await expect(page.getByTestId('event-transition')).toContainText('blue-route');
  await page.locator('.causal-workbench').screenshot({ path: resolve(output, 'causality.png') });
  await page.getByRole('button', { name: '冲突修复', exact: true }).click();
  await page
    .getByLabel(/检查消息 .* append N/)
    .first()
    .click();
  await expect(causal).toHaveAttribute('data-code', 'log-repaired');
  await expect(page.getByTestId('rpc-payload')).toContainText('blue-route');
  const forward = page.getByLabel('切换链路 N1 到 N2', { exact: true });
  const reverse = page.getByLabel('切换链路 N2 到 N1', { exact: true });
  await forward.focus();
  await page.keyboard.press('Enter');
  await expect(forward).toHaveAttribute('aria-pressed', 'true');
  await expect(reverse).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('单向切断 N1 到 N2')).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出实验' }).click();
  const path = await (await downloading).path();
  const document = JSON.parse(await readFile(path, 'utf8'));
  expect(document.actions.at(-1)).toEqual({ type: 'link', from: 'N1', to: 'N2', enabled: false });
  await page.getByRole('button', { name: '重置' }).click();
  await expect(forward).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('导入实验文件').setInputFiles(path);
  await expect(forward).toHaveAttribute('aria-pressed', 'true');
  await expect(reverse).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '恢复全部链路' }).click();
  await expect(page.getByTestId('cut-count')).toHaveText('0 CUTS');
  await page.getByRole('button', { name: '章节 6 日志收敛' }).click();
  await expect(page.getByTestId('chapter-proof')).toHaveText(/0\/5.*5\/5.*5\/5/);
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
  const widths = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const measured = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(measured).toBeLessThanOrEqual(width);
    widths.push({ viewport: width, document: measured });
  }
  const appliedValue = `deployment-verified-v${version}`;
  await page.getByLabel('写入键名').fill('live');
  await page.getByLabel('写入值', { exact: true }).fill(appliedValue);
  await page.getByRole('button', { name: '提交提案' }).click();
  await page.getByLabel('运行实验', { exact: true }).click();
  await expect(page.getByTestId('committed')).toHaveText('04');
  await expect(page.getByTestId('state-machine')).toContainText(appliedValue);
  await page.getByLabel('暂停实验', { exact: true }).click();
  const safety = await page.getByTestId('safety').textContent();
  expect(safety).toContain('0 violations');
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(badResponses).toEqual([]);
  expect(external).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(output, 'live.png') });
  const report = {
    version,
    revision: expectedRevision ?? null,
    revisionMarkerVerified: !!expectedRevision,
    checkedAt: new Date().toISOString(),
    url,
    httpStatus: response.status(),
    initialWrites: 2,
    writesAfterStory: 3,
    writesAfterLiveProposal: 4,
    appliedValue,
    minorityCopies: 2,
    majorityApplied: 3,
    healedApplied: 5,
    tourCompleted: true,
    actualRepairTransition: true,
    actualRpcPayload: true,
    keyboardDirectedCut: true,
    cutExportImport: true,
    reverseLinkIndependent: true,
    responsiveWidths: widths,
    safety,
    pageErrors: errors,
    failedRequests: failed,
    badResponses,
    externalRequests: external,
  };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
