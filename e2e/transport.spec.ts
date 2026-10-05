import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Simulator } from '../src/engine/simulator.ts';
import type { Packet } from '../src/engine/types.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('committed')).toHaveText('02');
});

test('the vote echo exposes duplicate replies and only a distinct voter completes the quorum', async ({
  page,
}) => {
  await page.getByRole('button', { name: '载入选票回声' }).click();
  await expect(page.getByTestId('unique-votes')).toHaveText('2 / 3');
  await expect(page.getByTestId('held-count')).toHaveText('3');
  await expect(page.getByTestId('duplicate-count')).toHaveText('2');
  await expect(page.getByTestId('packet-lineage')).toContainText('当前保留 3 份');
  await expect(page.getByTestId('packet-lineage').getByText('重复选票 / 忽略')).toHaveCount(2);
  await expect(page.getByTestId('causal-panel')).toHaveAttribute('data-code', 'duplicate-vote');
  await expect(page.getByTestId('causal-panel')).toContainText('IGNORED');
  await page
    .getByLabel(/调度消息 .* held/)
    .first()
    .click();
  await page.getByLabel('投递延迟毫秒').fill('1');
  await page.getByRole('button', { name: /^释放消息/ }).click();
  await expect(page.getByTestId('held-count')).toHaveText('2');
  await page.getByLabel('推进下一个协议事件').click();
  await expect(page.getByTestId('unique-votes')).toHaveText('3 / 3');
  await expect(page.getByTestId('vote-proof')).toContainText('独立选票已达到多数派');
  await expect(page.getByTestId('causal-panel')).toHaveAttribute('data-code', 'vote-quorum');
  await expect(page.getByTestId('safety')).toContainText('0 violations');
});

test('held messages survive their deadline and manual discard exposes the real reason', async ({
  page,
}) => {
  const sim = new Simulator(7);
  sim.act({ type: 'step' });
  const packet = sim.snapshot().transport.pending[0];
  await page.getByLabel('导入实验文件').setInputFiles({
    name: 'in-flight.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sim.export())),
  });
  await page
    .getByLabel(`调度消息 ${packet.id} ${packet.kind} ${packet.from} 到 ${packet.to} in-flight`)
    .click();
  await page.getByRole('button', { name: `暂停消息 ${packet.id}`, exact: true }).click();
  await expect(page.getByTestId('held-count')).toHaveText('1');
  await page.getByLabel('单步推进100毫秒').click();
  await expect(page.getByTestId('held-count')).toHaveText('1');
  await page
    .getByLabel(`调度消息 ${packet.id} ${packet.kind} ${packet.from} 到 ${packet.to} held`)
    .click();
  await expect(page.getByTestId('causal-panel')).toContainText('HELD');
  await page.getByRole('button', { name: `丢弃消息 ${packet.id}`, exact: true }).click();
  await expect(page.getByTestId('held-count')).toHaveText('0');
  await expect(page.getByTestId('discard-count')).toHaveText('1');
  await expect(page.getByTestId('causal-panel')).toHaveAttribute('data-code', 'transport-dropped');
  await expect(page.getByTestId('causal-panel')).toContainText('主动丢弃');
  await expect(
    page.getByRole('button', { name: `丢弃消息 ${packet.id}`, exact: true }),
  ).toBeDisabled();
});

test('an exported echo retains held packets, exact actions and protocol evidence on import', async ({
  page,
}) => {
  await page.getByRole('button', { name: '载入选票回声' }).click();
  await expect(page.getByTestId('unique-votes')).toHaveText('2 / 3');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出实验' }).click();
  const path = (await (await downloading).path())!;
  const document = JSON.parse(await readFile(path, 'utf8'));
  expect(document.actions.filter((a: { type: string }) => a.type === 'hold')).toHaveLength(4);
  expect(document.actions.filter((a: { type: string }) => a.type === 'duplicate')).toHaveLength(2);
  await page.getByRole('button', { name: '重置' }).click();
  await expect(page.getByTestId('held-count')).toHaveText('0');
  await page.getByLabel('导入实验文件').setInputFiles(path);
  await expect(page.getByTestId('held-count')).toHaveText('3');
  await expect(page.getByTestId('unique-votes')).toHaveText('2 / 3');
  await expect(page.getByTestId('duplicate-count')).toHaveText('2');
  await expect(page.getByTestId('causal-panel')).toHaveAttribute('data-code', 'duplicate-vote');
  await page.getByLabel('导入实验文件').setInputFiles({
    name: 'unavailable-packet.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...document,
        actions: [...document.actions, { type: 'hold', packet: 999999 }],
      }),
    ),
  });
  await expect(page.getByRole('alert')).toContainText('只能暂停仍在途的消息');
  await expect(page.getByTestId('held-count')).toHaveText('3');
  await expect(page.getByTestId('unique-votes')).toHaveText('2 / 3');
  const again = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出实验' }).click();
  const restoredPath = (await (await again).path())!;
  expect(JSON.parse(await readFile(restoredPath, 'utf8'))).toEqual(document);
});

test('the scheduling console supports keyboard release at narrow widths without overflow', async ({
  page,
}) => {
  await page.getByRole('button', { name: '载入选票回声' }).click();
  await expect(page.getByTestId('held-count')).toHaveText('3');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByLabel(/调度消息 .* held/)
    .first()
    .focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('投递延迟毫秒').fill('250');
  const release = page.getByRole('button', { name: /^释放消息/ });
  await release.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('held-count')).toHaveText('2');
  await expect(page.getByTestId('scheduled-packet')).toContainText('+250ms');
  await page.getByLabel('导入实验文件').setInputFiles('docs/experiments/stale-ack.json');
  await expect(page.getByTestId('causal-panel')).toHaveAttribute('data-code', 'stale-rpc');
  await expect(page.getByTestId('event-transition').locator('.changed')).toHaveCount(0);
});

test('selecting originals and copies keeps each of two message families in context', async ({
  page,
}) => {
  const sim = new Simulator(7);
  sim.act({ type: 'step' });
  const originals = sim.snapshot().transport.pending.slice(0, 2);
  const families = originals.map((original) => {
    sim.act({ type: 'hold', packet: original.id });
    sim.act({ type: 'duplicate', packet: original.id, delay: 1 });
    const copy = sim.snapshot().packets.at(-1)!;
    sim.act({ type: 'hold', packet: copy.id });
    return { original, copy };
  });
  await page.getByLabel('导入实验文件').setInputFiles({
    name: 'two-message-families.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sim.export())),
  });
  await expect(page.getByTestId('held-count')).toHaveText('4');
  for (const { original, copy } of families) {
    for (const packet of [original, copy]) {
      await page
        .getByLabel(`调度消息 ${packet.id} ${packet.kind} ${packet.from} 到 ${packet.to} held`)
        .click();
      const lineage = page.getByTestId('packet-lineage');
      await expect(lineage).toContainText(`源 #${original.id} / 当前保留 2 份`);
      await expect(lineage.locator('.lineage-node b')).toHaveText([original.from, original.to]);
      await expect(lineage.locator('.lineage-packets > div')).toHaveCount(2);
      await expect(page.getByTestId('scheduled-packet')).toContainText(
        `SELECTED PACKET #${packet.id}`,
      );
    }
  }
});

test('vote proof follows the selected reply recipient across simultaneous leader terms', async ({
  page,
}) => {
  const sim = new Simulator(7);
  sim.act({ type: 'network', latency: 10, loss: 0 });
  let oldReply: Packet | undefined;
  for (let i = 0; i < 30 && !oldReply; i++) {
    sim.act({ type: 'step' });
    oldReply = sim
      .snapshot()
      .transport.pending.find((p) => p.payload.kind === 'voted' && p.payload.granted);
  }
  expect(oldReply).toBeDefined();
  sim.act({ type: 'hold', packet: oldReply!.id });
  sim.act({ type: 'advance', ms: 1200 });
  const oldLeader = sim.snapshot().nodes.find((n) => n.role === 'leader')!;
  const peers = sim
    .snapshot()
    .nodes.map((n) => n.id)
    .filter((id) => id !== oldLeader.id);
  const majority = peers.slice(1);
  sim.act({ type: 'partition', groups: [[oldLeader.id, peers[0]], majority] });
  let newReply: Packet | undefined;
  for (let i = 0; i < 150 && !newReply; i++) {
    sim.act({ type: 'step' });
    newReply = sim
      .snapshot()
      .transport.pending.find(
        (p) =>
          p.payload.kind === 'voted' &&
          p.payload.granted &&
          majority.includes(p.to) &&
          p.payload.term > oldLeader.term,
      );
  }
  expect(newReply).toBeDefined();
  sim.act({ type: 'hold', packet: newReply!.id });
  sim.act({ type: 'duplicate', packet: newReply!.id, delay: 1 });
  sim.act({ type: 'advance', ms: 100 });
  expect(sim.snapshot().nodes.filter((n) => n.role === 'leader')).toHaveLength(2);
  await page.getByLabel('导入实验文件').setInputFiles({
    name: 'two-leader-vote-replies.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sim.export())),
  });
  const proof = page.getByTestId('vote-proof');
  for (const reply of [newReply!, oldReply!]) {
    await page
      .getByLabel(`调度消息 ${reply.id} ${reply.kind} ${reply.from} 到 ${reply.to} held`)
      .click();
    const receiver = sim.snapshot().nodes.find((n) => n.id === reply.to)!;
    await expect(proof).toContainText(
      `${receiver.id} / CURRENT TERM ${receiver.term} / ${receiver.role}`,
    );
    await expect(page.getByTestId('unique-votes')).toHaveText(`${receiver.votes.length} / 3`);
    await expect(proof.locator('.voter-strip .counted')).toHaveText(
      sim
        .snapshot()
        .nodes.filter((n) => receiver.votes.includes(n.id))
        .map((n) => `${n.id}✓`),
    );
  }
  await page.getByLabel('推进下一个协议事件').click();
  const highestLeader = sim
    .snapshot()
    .nodes.filter((n) => n.role === 'leader')
    .sort((a, b) => b.term - a.term)[0];
  await expect(proof).toContainText(`${highestLeader.id} / CURRENT TERM ${highestLeader.term}`);
  await expect(page.getByTestId('safety')).toContainText('0 violations');
});
