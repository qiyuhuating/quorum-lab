import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Simulator } from '../src/engine/simulator.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('committed')).toHaveText('02');
});

test('actual conflict repair exposes a red-to-blue transition and an inspectable RPC', async ({
  page,
}) => {
  await page.getByRole('button', { name: '章节 5 重新连通' }).click();
  const causal = page.getByTestId('causal-panel');
  for (let i = 0; i < 70 && (await causal.getAttribute('data-code')) !== 'log-repaired'; i++) {
    const previous = await causal.getAttribute('data-event-id');
    await page.getByLabel('推进下一个协议事件').click();
    await expect(causal).not.toHaveAttribute('data-event-id', previous!);
  }
  await expect(causal).toHaveAttribute('data-code', 'log-repaired');
  await expect(page.getByTestId('event-transition')).toContainText('red-route');
  await expect(page.getByTestId('event-transition')).toContainText('blue-route');
  await causal.locator('summary').click();
  await expect(causal).toContainText('truncatedFrom');
  await page.getByRole('button', { name: '冲突修复', exact: true }).click();
  await page
    .getByLabel(/检查消息 .* append N/)
    .first()
    .click();
  await expect(causal).toHaveAttribute('data-code', 'log-repaired');
  await expect(page.getByTestId('rpc-payload')).toContainText('blue-route');
  await expect(page.getByTestId('safety')).toContainText('0 violations');
});

test('one-way cuts preserve the reverse link and survive export/import, then heal', async ({
  page,
}) => {
  const forward = page.getByLabel('切换链路 N1 到 N2', { exact: true });
  const reverse = page.getByLabel('切换链路 N2 到 N1', { exact: true });
  await forward.focus();
  await page.keyboard.press('Enter');
  await expect(forward).toHaveAttribute('aria-pressed', 'true');
  await expect(reverse).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('cut-count')).toHaveText('1 CUTS');
  await expect(page.getByLabel('单向切断 N1 到 N2')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出实验' }).click();
  const path = (await (await downloadPromise).path())!;
  const document = JSON.parse(await readFile(path, 'utf8'));
  expect(document.actions.at(-1)).toEqual({ type: 'link', from: 'N1', to: 'N2', enabled: false });
  await page.getByRole('button', { name: '重置' }).click();
  await expect(forward).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('导入实验文件').setInputFiles(path);
  await expect(forward).toHaveAttribute('aria-pressed', 'true');
  await expect(reverse).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '恢复全部链路' }).click();
  await expect(page.getByTestId('cut-count')).toHaveText('0 CUTS');
  await expect(forward).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '分区 2│3', exact: true }).click();
  await expect(page.getByLabel('切换链路 N1 到 N3', { exact: true })).toBeDisabled();
});

test('a recovered lagging node displays a real prefix rejection before catch-up', async ({
  page,
}) => {
  const sim = new Simulator(7);
  sim.act({ type: 'advance', ms: 1800 });
  sim.act({ type: 'crash', node: 'N2' });
  for (let i = 0; i < 2; i++) {
    sim.act({ type: 'write', node: 'N1', key: `probe${i}`, value: 'persisted' });
    sim.act({ type: 'advance', ms: 300 });
  }
  sim.act({ type: 'crash', node: 'N1' });
  sim.act({ type: 'advance', ms: 1800 });
  sim.act({ type: 'recover', node: 'N2' });
  await page.getByLabel('导入实验文件').setInputFiles({
    name: 'lagging-node.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sim.export())),
  });
  await expect(page.getByRole('status')).toContainText('实验已恢复');
  const causal = page.getByTestId('causal-panel');
  for (
    let i = 0;
    i < 100 && (await causal.getAttribute('data-code')) !== 'log-prefix-mismatch';
    i++
  ) {
    const previous = await causal.getAttribute('data-event-id');
    await page.getByLabel('推进下一个协议事件').click();
    await expect(causal).not.toHaveAttribute('data-event-id', previous!);
  }
  await expect(causal).toHaveAttribute('data-code', 'log-prefix-mismatch');
  await expect(causal).toContainText('REJECTED');
  await expect(causal).toContainText('本次不改变日志');
  await page.getByRole('button', { name: '拒绝与忽略', exact: true }).click();
  await page
    .getByLabel(/检查消息 .* append N/)
    .first()
    .click();
  await expect(page.getByTestId('rpc-payload')).toContainText('prevIndex');
  await expect(page.getByTestId('safety')).toContainText('0 violations');
});
