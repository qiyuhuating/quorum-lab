import { describe, expect, it } from 'vitest';
import { Simulator } from '../src/engine/simulator.ts';
import { buildPartitionStory } from '../src/engine/story.ts';
import { parseReplay, replay } from '../src/engine/replay.ts';

describe('protocol observatory', () => {
  it('steps exactly one live event and replays the stepped history', () => {
    const sim = new Simulator(7);
    const next = sim.snapshot().queue[0];
    sim.act({ type: 'step' });
    expect(sim.snapshot().now).toBe(next.at);
    expect(sim.snapshot().lastEvent?.seq).toBe(next.seq);
    expect(sim.snapshot().metrics.elections).toBe(1);
    for (let i = 0; i < 60; i++) {
      const expected = sim.snapshot().queue[0];
      sim.act({ type: 'step' });
      expect(sim.snapshot().lastEvent?.seq).toBe(expected.seq);
      expect(sim.snapshot().now).toBe(expected.at);
    }
    expect(replay(parseReplay(JSON.stringify(sim.export()))).snapshot()).toEqual(sim.snapshot());
  });

  it('exposes immutable actual RPC payloads and delivery-time partition drops', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'advance', ms: 1800 });
    const primary = sim.snapshot().nodes.find((n) => n.role === 'leader')!;
    sim.act({ type: 'write', node: primary.id, key: 'probe', value: 'payload' });
    const packet = sim
      .snapshot()
      .packets.findLast(
        (p) => p.payload.kind === 'append' && p.payload.entries.some((e) => e.key === 'probe'),
      )!;
    expect(packet.status).toBe('in-flight');
    expect(packet.payload.term).toBe(primary.term);
    if (packet.payload.kind === 'append') packet.payload.entries[0].value = 'mutated-view';
    sim.act({ type: 'partition', groups: sim.snapshot().nodes.map((n) => [n.id]) });
    sim.act({ type: 'advance', ms: 100 });
    const dropped = sim.snapshot().packets.find((p) => p.id === packet.id)!;
    expect(dropped.status).toBe('dropped');
    expect(dropped.dropReason).toBe('partition-at-delivery');
    expect(
      sim
        .snapshot()
        .nodes.find((n) => n.id === primary.id)!
        .log.at(-1)!.value,
    ).toBe('payload');
  });

  it('six chapters prove minority refusal, majority progress and conflict repair', () => {
    const story = buildPartitionStory();
    expect(story.checkpoints).toHaveLength(6);
    const snapshots = story.checkpoints.map((cursor) => replay(story.document, cursor).snapshot());
    expect(snapshots[0].metrics.committed).toBe(2);
    const minority = snapshots[2];
    const holders = minority.nodes.filter((n) => n.log.some((e) => e.value === 'red-route'));
    expect(holders).toHaveLength(2);
    expect(holders.every((n) => n.stateMachine.route === undefined)).toBe(true);
    expect(minority.metrics.committed).toBe(2);
    expect(minority.nodes.filter((n) => n.role === 'leader')).toHaveLength(2);
    const majority = snapshots[3];
    expect(majority.nodes.filter((n) => n.stateMachine.route === 'blue-route')).toHaveLength(3);
    expect(majority.metrics.committed).toBe(3);
    expect(snapshots[4].groups).toHaveLength(1);
    expect(snapshots[4].nodes.some((n) => n.log.some((e) => e.value === 'red-route'))).toBe(true);
    const final = snapshots[5];
    for (const n of final.nodes) {
      expect(n.log).toEqual(final.nodes[0].log);
      expect(n.stateMachine.route).toBe('blue-route');
      expect(n.log.some((e) => e.value === 'red-route')).toBe(false);
    }
    expect(final.trace.some((t) => t.kind === 'repair')).toBe(true);
    expect(final.violations).toEqual([]);
  });

  it('step rejects time exhaustion without appending an action', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'advance', ms: 120000 });
    const before = sim.export();
    expect(() => sim.act({ type: 'step' })).toThrow(/120/);
    expect(sim.export()).toEqual(before);
  });
});
