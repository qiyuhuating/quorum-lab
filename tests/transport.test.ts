import { describe, expect, it } from 'vitest';
import { Simulator } from '../src/engine/simulator.ts';
import { parseReplay, replay } from '../src/engine/replay.ts';
import { buildVoteEcho } from '../src/engine/echo.ts';
import type { Action, Packet } from '../src/engine/types.ts';

function pending(sim: Simulator, kind?: string): Packet {
  const packet = sim.snapshot().transport.pending.find((p) => !kind || p.kind === kind);
  expect(packet).toBeDefined();
  return packet!;
}

describe('adversarial message scheduling', () => {
  it('holds across the original deadline and releases exactly once with identical replay', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'step' });
    const packet = pending(sim, 'vote');
    sim.act({ type: 'hold', packet: packet.id });
    sim.act({ type: 'advance', ms: 200 });
    expect(sim.snapshot().transport.held[0].status).toBe('held');
    expect(sim.snapshot().packets.find((p) => p.id === packet.id)?.decision).toBeUndefined();
    sim.act({ type: 'release', packet: packet.id, delay: 1 });
    expect(sim.snapshot().transport.held).toEqual([]);
    sim.act({ type: 'advance', ms: 1 });
    const delivered = sim.snapshot().packets.find((p) => p.id === packet.id)!;
    expect(delivered.status).toBe('delivered');
    expect(delivered.deliverAt).toBe(sim.snapshot().now);
    expect(delivered.transition).toBeDefined();
    expect(sim.snapshot().transport.pending.some((p) => p.id === packet.id)).toBe(false);
    expect(replay(parseReplay(JSON.stringify(sim.export()))).snapshot()).toEqual(sim.snapshot());
  });

  it('invalidates the original queue event even when released to the same deadline', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'step' });
    const packet = pending(sim, 'vote');
    const before = sim.snapshot().metrics.delivered;
    sim.act({ type: 'hold', packet: packet.id });
    sim.act({ type: 'release', packet: packet.id, delay: packet.deliverAt - sim.snapshot().now });
    sim.act({ type: 'advance', ms: packet.deliverAt - sim.snapshot().now });
    const after = sim.snapshot();
    const delivered = after.packets.filter((p) => p.status === 'delivered').length;
    expect(after.metrics.delivered - before).toBe(delivered);
    expect(after.lastEvent?.packetId).toBe(packet.id);
    expect(after.violations).toEqual([]);
  });

  it('uses distinct voters rather than repeated replies to establish a quorum', () => {
    const echo = buildVoteEcho();
    const sim = replay(echo.document);
    const candidate = sim.snapshot().nodes.find((n) => n.id === echo.candidate)!;
    expect(candidate.role).toBe('candidate');
    expect(candidate.votes).toEqual([echo.candidate, echo.peer]);
    expect(sim.snapshot().transport.held).toHaveLength(3);
    expect(sim.snapshot().transport.duplicates).toBe(2);
    const copies = sim.snapshot().packets.filter((p) => p.duplicateOf === echo.packet);
    expect(copies).toHaveLength(2);
    expect(copies.every((p) => p.decision?.code === 'duplicate-vote')).toBe(true);
    expect(copies.every((p) => p.payload.kind === 'voted' && p.payload.granted)).toBe(true);
    const other = sim.snapshot().transport.held[0];
    sim.act({ type: 'release', packet: other.id, delay: 1 });
    sim.act({ type: 'advance', ms: 1 });
    expect(sim.snapshot().nodes.find((n) => n.id === echo.candidate)?.role).toBe('leader');
    expect(sim.snapshot().lastEffect?.decision.code).toBe('vote-quorum');
    expect(replay(sim.export()).snapshot()).toEqual(sim.snapshot());
  });

  it('discards a held packet without invoking the receiving protocol', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'step' });
    const packet = pending(sim);
    sim.act({ type: 'hold', packet: packet.id });
    const nodes = sim.snapshot().nodes;
    sim.act({ type: 'drop', packet: packet.id });
    expect(sim.snapshot().nodes).toEqual(nodes);
    expect(sim.snapshot().transport.discarded).toBe(1);
    expect(sim.snapshot().packets.find((p) => p.id === packet.id)?.dropReason).toBe('manual');
    expect(sim.snapshot().packets.find((p) => p.id === packet.id)?.decision?.code).toBe(
      'transport-dropped',
    );
    expect(() => sim.act({ type: 'release', packet: packet.id, delay: 1 })).toThrow();
    expect(replay(sim.export()).snapshot()).toEqual(sim.snapshot());
  });

  it('rechecks directed cuts and offline receivers when held packets are released', () => {
    for (const fault of ['link', 'crash'] as const) {
      const sim = new Simulator(7);
      sim.act({ type: 'step' });
      const packet = pending(sim);
      sim.act({ type: 'hold', packet: packet.id });
      sim.act(
        fault === 'link'
          ? { type: 'link', from: packet.from, to: packet.to, enabled: false }
          : { type: 'crash', node: packet.to },
      );
      sim.act({ type: 'release', packet: packet.id, delay: 1 });
      sim.act({ type: 'advance', ms: 1 });
      expect(sim.snapshot().lastEffect?.decision.verdict).toBe('dropped');
      expect(sim.snapshot().packets.find((p) => p.id === packet.id)?.dropReason).toBe(
        fault === 'link' ? 'link-at-delivery' : 'receiver-offline',
      );
      expect(sim.snapshot().violations).toEqual([]);
    }
  });

  it('retains held payloads after packet history eviction', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'advance', ms: 1800 });
    sim.act({ type: 'step' });
    const packet = pending(sim);
    sim.act({ type: 'hold', packet: packet.id });
    sim.act({ type: 'advance', ms: 6000 });
    expect(sim.snapshot().packets.some((p) => p.id === packet.id)).toBe(false);
    expect(sim.snapshot().transport.held[0].payload).toEqual(packet.payload);
    sim.act({ type: 'duplicate', packet: packet.id, delay: 1 });
    sim.act({ type: 'release', packet: packet.id, delay: 2 });
    sim.act({ type: 'advance', ms: 2 });
    expect(sim.snapshot().transport.held).toEqual([]);
    expect(sim.snapshot().packets.find((p) => p.id === packet.id)?.status).toBe('delivered');
    expect(sim.snapshot().metrics.delivered).toBeGreaterThan(0);
    expect(replay(sim.export()).snapshot()).toEqual(sim.snapshot());
  });

  it('rejects invalid or unavailable packet actions before changing state or history', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'step' });
    const packet = pending(sim);
    const invalid = [
      { type: 'hold', packet: -1 },
      { type: 'drop', packet: 1.5 },
      { type: 'hold', packet: 999999 },
      { type: 'release', packet: packet.id, delay: 1 },
      { type: 'duplicate', packet: packet.id, delay: 0 },
      { type: 'duplicate', packet: packet.id, delay: 5001 },
    ];
    for (const action of invalid) {
      const before = sim.snapshot();
      const document = sim.export();
      expect(() => sim.act(action as Action)).toThrow();
      expect(sim.snapshot()).toEqual(before);
      expect(sim.export()).toEqual(document);
    }
    sim.act({ type: 'hold', packet: packet.id });
    const held = sim.snapshot();
    expect(() => sim.act({ type: 'hold', packet: packet.id })).toThrow();
    expect(sim.snapshot()).toEqual(held);
  });

  it('ignores a held acknowledgement after newer acknowledgements have advanced replication', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'advance', ms: 1800 });
    sim.act({ type: 'write', node: 'N1', key: 'order', value: 'first' });
    let old: Packet | undefined;
    for (let i = 0; i < 100 && !old; i++) {
      sim.act({ type: 'step' });
      old = sim
        .snapshot()
        .transport.pending.find(
          (p) =>
            p.from === 'N2' && p.to === 'N1' && p.payload.kind === 'appended' && p.payload.success,
        );
    }
    expect(old).toBeDefined();
    sim.act({ type: 'hold', packet: old!.id });
    sim.act({ type: 'write', node: 'N1', key: 'order', value: 'second' });
    sim.act({ type: 'advance', ms: 600 });
    const before = sim.snapshot().nodes.find((n) => n.id === 'N1')!;
    sim.act({ type: 'release', packet: old!.id, delay: 1 });
    sim.act({ type: 'advance', ms: 1 });
    expect(sim.snapshot().lastEffect?.decision.code).toBe('stale-rpc');
    expect(sim.snapshot().lastEffect?.transition.before).toEqual(
      sim.snapshot().lastEffect?.transition.after,
    );
    expect(sim.snapshot().nodes.find((n) => n.id === 'N1')?.matchIndex).toEqual(before.matchIndex);
    expect(sim.snapshot().nodes.every((n) => n.stateMachine.order === 'second')).toBe(true);
    expect(replay(sim.export()).snapshot()).toEqual(sim.snapshot());
  });

  it('bounds held storage and rejects overflow atomically', () => {
    const sim = new Simulator(7);
    for (let i = 0; i < 100 && sim.snapshot().transport.held.length < 32; i++) {
      if (!sim.snapshot().transport.pending.length) sim.act({ type: 'step' });
      const packet = pending(sim);
      sim.act({ type: 'hold', packet: packet.id });
    }
    expect(sim.snapshot().transport.held).toHaveLength(32);
    if (!sim.snapshot().transport.pending.length) sim.act({ type: 'step' });
    const packet = pending(sim);
    const before = sim.snapshot();
    expect(() => sim.act({ type: 'hold', packet: packet.id })).toThrow('32');
    expect(sim.snapshot()).toEqual(before);
    expect(replay(sim.export()).snapshot()).toEqual(before);
  });
});
