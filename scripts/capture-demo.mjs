import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL = process.env.DEMO_URL ?? 'http://127.0.0.1:4174/quorum-lab/';
const output = resolve('docs/media');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1180 },
  deviceScaleFactor: 1,
  recordVideo: { dir: output, size: { width: 1440, height: 1180 } },
});
const page = await context.newPage();
await page.goto(baseURL);
await page.getByTestId('committed').filter({ hasText: '02' }).waitFor();
await page.screenshot({ path: resolve(output, 'desktop.png') });
await page.screenshot({ path: resolve(output, 'desktop-full.png'), fullPage: true });
await page.waitForTimeout(1800);
await page.getByRole('button', { name: /少数派隔离.*两个领导者/ }).click();
await page.getByRole('status').filter({ hasText: '2/5' }).waitFor();
await page.screenshot({ path: resolve(output, 'partition.png') });
await page.waitForTimeout(2000);
await page.getByLabel('写入键名').fill('signal');
await page.getByLabel('写入值', { exact: true }).fill('majority-safe');
await page.getByRole('button', { name: '提交提案' }).click();
await page.getByLabel('运行速度').selectOption('2');
await page.getByLabel('运行实验', { exact: true }).click();
await page.getByTestId('committed').filter({ hasText: '03' }).waitFor();
await page.waitForTimeout(1700);
await page.getByRole('button', { name: '恢复全部链路' }).click();
await page.waitForTimeout(2200);
await page.getByLabel('暂停实验', { exact: true }).click();
await page.getByTestId('state-machine').filter({ hasText: 'majority-safe' }).waitFor();
await page.screenshot({ path: resolve(output, 'healed.png') });
const video = page.video();
await page.waitForTimeout(1200);
await context.close();
await video.saveAs(resolve(output, 'demo.webm'));
await video.delete();
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
});
const mp = await mobile.newPage();
await mp.goto(baseURL);
await mp.getByTestId('committed').filter({ hasText: '02' }).waitFor();
await mp.screenshot({ path: resolve(output, 'mobile.png'), fullPage: true });
await mobile.close();
await browser.close();
await writeFile(
  resolve(output, 'capture-info.json'),
  JSON.stringify(
    {
      viewport: '1440x1180',
      mobile: '390x844',
      video: 'demo.webm',
      source: 'actual production application',
      stagedVisualEdits: false,
    },
    null,
    2,
  ),
);
console.log('Captured desktop, mobile, partition, recovery and demo video.');
