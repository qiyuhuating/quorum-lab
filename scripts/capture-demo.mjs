import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const baseURL = process.env.DEMO_URL ?? 'http://127.0.0.1:4174/quorum-lab/';
const output = resolve('docs/media');
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
async function stepUntilRepair(page) {
  const panel = page.getByTestId('causal-panel');
  for (let i = 0; i < 70 && (await panel.getAttribute('data-code')) !== 'log-repaired'; i++) {
    const previous = await panel.getAttribute('data-event-id');
    await page.getByLabel('推进下一个协议事件').click();
    await expect(panel).not.toHaveAttribute('data-event-id', previous);
  }
  await expect(panel).toHaveAttribute('data-code', 'log-repaired');
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: output, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(baseURL);
await page.getByTestId('committed').filter({ hasText: '02' }).waitFor();
await page.screenshot({ path: resolve(output, 'desktop.png') });
await page.screenshot({ path: resolve(output, 'desktop-full.png'), fullPage: true });
await page.waitForTimeout(1600);
const names = ['共同的事实', '切开网络', '少数派的困局', '多数派继续', '重新连通', '日志收敛'];
for (let i = 1; i < 6; i++) {
  await page.getByRole('button', { name: `章节 ${i + 1} ${names[i]}` }).click();
  await expect(page.getByRole('button', { name: `章节 ${i + 1} ${names[i]}` })).toHaveAttribute(
    'aria-current',
    'step',
  );
  await page.waitForTimeout(1300);
  if (i === 2) await page.screenshot({ path: resolve(output, 'partition.png') });
  if (i === 3) await page.screenshot({ path: resolve(output, 'majority.png') });
  if (i === 5) await page.screenshot({ path: resolve(output, 'healed.png') });
}
await page.getByRole('button', { name: '章节 5 重新连通' }).click();
await page.getByRole('button', { name: '固定当前状态作对照' }).click();
await stepUntilRepair(page);
await page.locator('#workbench').scrollIntoViewIfNeeded();
await page.locator('.causal-workbench').screenshot({ path: resolve(output, 'causality.png') });
await page.getByRole('button', { name: '冲突修复', exact: true }).click();
await page
  .getByLabel(/检查消息 .* append N/)
  .first()
  .click();
await page.waitForTimeout(1700);
await page.locator('#workbench').screenshot({ path: resolve(output, 'forensics.png') });
await page.getByRole('button', { name: '章节 6 日志收敛' }).click();
await page.getByLabel('切换链路 N1 到 N2', { exact: true }).click();
await page.getByLabel('切换链路 N3 到 N5', { exact: true }).click();
await page.getByLabel('单步推进100毫秒').click();
await expect(page.getByTestId('clock')).toHaveText('6.50s');
await page.locator('#observatory').scrollIntoViewIfNeeded();
await page.locator('#observatory').screenshot({ path: resolve(output, 'asymmetric.png') });
await page.waitForTimeout(1800);
const video = page.video();
await context.close();
await video.saveAs(resolve(output, 'demo.webm'));
await video.delete();
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await mobile.newPage();
await mp.goto(baseURL);
await mp.getByTestId('committed').filter({ hasText: '02' }).waitFor();
await mp.screenshot({ path: resolve(output, 'mobile.png'), fullPage: true });
await mp.getByRole('button', { name: '章节 3 少数派的困局' }).click();
await mp.waitForTimeout(900);
await mp.locator('#observatory').screenshot({ path: resolve(output, 'mobile-partition.png') });
await mp.getByRole('button', { name: '章节 5 重新连通' }).click();
await stepUntilRepair(mp);
await mp.locator('.causal-workbench').screenshot({ path: resolve(output, 'mobile-causality.png') });
await mobile.close();
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
await writeFile(
  resolve(output, 'capture-info.json'),
  JSON.stringify(
    {
      version,
      viewport: '1440x900',
      mobile: '390x844',
      video: 'demo.webm',
      source: 'actual production application',
      stagedVisualEdits: false,
      views: [
        'six chapters',
        'actual log-repaired transition',
        'directed network cuts',
        'RPC inspection',
        'mobile causality',
      ],
      pageErrors: errors,
    },
    null,
    2,
  ) + '\n',
);
console.log('Captured actual six-chapter protocol experiment, debugging, desktop and mobile.');
