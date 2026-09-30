import { describe, expect, it } from 'vitest';
import { Simulator } from '../src/engine/simulator.ts';
import { parseReplay, replay } from '../src/engine/replay.ts';
import type { NodeId } from '../src/engine/types.ts';

function settled(seed = 7) {
  const sim = new Simulator(seed);
  sim.act({ type: 'advance', ms: 1800 });
  return sim;
}
function leader(sim: Simulator) {
  const leaders = sim.snapshot().nodes.filter((n) => n.role === 'leader' && !n.crashed);
  expect(leaders).toHaveLength(1);
  return leaders[0].id;
}
function advance(sim: Simulator, ms = 1600) {
  sim.act({ type: 'advance', ms });
}

describe('Raft behavior', () => {
  it('elects one leader and applies a write on all five state machines', () => {
    const sim = settled();
    sim.act({ type: 'write', node: leader(sim), key: 'mission', value: 'orbit' });
    advance(sim);
    for (const n of sim.snapshot().nodes) expect(n.stateMachine).toEqual({ mission: 'orbit' });
    expect(sim.snapshot().violations).toEqual([]);
    expect(sim.snapshot().metrics.committed).toBe(1);
  });

  it('rejects follower writes with no log mutation', () => {
    const sim = settled();
    const follower = sim.snapshot().nodes.find((n) => n.role === 'follower')!;
    expect(sim.act({ type: 'write', node: follower.id, key: 'k', value: 'v' }).ok).toBe(false);
    expect(sim.snapshot().nodes.find((n) => n.id === follower.id)!.log).toEqual(follower.log);
  });

  it('a leader isolated in a minority cannot commit; majority progresses and heals divergent tails', () => {
    const sim = settled();
    const old = leader(sim);
    const others = sim
      .snapshot()
      .nodes.map((n) => n.id)
      .filter((id) => id !== old);
    const minority = [old, others[0]];
    const majority = others.slice(1);
    sim.act({ type: 'partition', groups: [minority, majority] });
    sim.act({ type: 'write', node: old, key: 'route', value: 'unsafe' });
    advance(sim, 2400);
    expect(sim.snapshot().metrics.committed).toBe(0);
    const fresh = sim
      .snapshot()
      .nodes.find((n) => majority.includes(n.id) && n.role === 'leader')!.id;
    sim.act({ type: 'write', node: fresh, key: 'route', value: 'safe' });
    advance(sim);
    expect(sim.snapshot().metrics.committed).toBe(1);
    sim.act({ type: 'heal' });
    advance(sim, 3500);
    for (const n of sim.snapshot().nodes) {
      expect(n.stateMachine).toEqual({ route: 'safe' });
      expect(n.log.some((e) => e.value === 'unsafe')).toBe(false);
    }
    expect(sim.snapshot().violations).toEqual([]);
  });

  it('re-elects after a crash, preserves stable state and catches up on recovery', () => {
    const sim = settled();
    const old = leader(sim);
    sim.act({ type: 'write', node: old, key: 'one', value: 'persisted' });
    advance(sim);
    const disk = sim.snapshot().nodes.find((n) => n.id === old)!;
    sim.act({ type: 'crash', node: old });
    const dead = sim.snapshot().nodes.find((n) => n.id === old)!;
    expect(dead.log).toEqual(disk.log);
    expect(dead.term).toEqual(disk.term);
    expect(dead.votedFor).toEqual(disk.votedFor);
    expect(dead.commitIndex).toBe(0);
    advance(sim);
    const fresh = leader(sim);
    expect(fresh).not.toBe(old);
    sim.act({ type: 'write', node: fresh, key: 'two', value: 'after-crash' });
    advance(sim);
    sim.act({ type: 'recover', node: old });
    advance(sim, 3000);
    for (const n of sim.snapshot().nodes)
      expect(n.stateMachine).toEqual({ one: 'persisted', two: 'after-crash' });
    expect(sim.snapshot().violations).toEqual([]);
  });

  it('three crashed nodes remove write availability; restart restores it', () => {
    const sim = settled();
    const primary = leader(sim);
    const peers = sim
      .snapshot()
      .nodes.map((n) => n.id)
      .filter((id) => id !== primary)
      .slice(0, 3);
    peers.forEach((node) => sim.act({ type: 'crash', node }));
    sim.act({ type: 'write', node: primary, key: 'k', value: 'pending' });
    advance(sim, 2400);
    expect(sim.snapshot().metrics.committed).toBe(0);
    peers.forEach((node) => sim.act({ type: 'recover', node }));
    advance(sim, 3000);
    expect(sim.snapshot().nodes.every((n) => n.stateMachine.k === 'pending')).toBe(true);
  });

  it('all-node power loss retains committed history through a new-term no-op', () => {
    const sim = settled();
    sim.act({ type: 'write', node: leader(sim), key: 'durable', value: 'yes' });
    advance(sim);
    sim.snapshot().nodes.forEach((n) => sim.act({ type: 'crash', node: n.id }));
    sim.snapshot().nodes.forEach((n) => sim.act({ type: 'recover', node: n.id }));
    advance(sim, 3500);
    expect(sim.snapshot().nodes.every((n) => n.stateMachine.durable === 'yes')).toBe(true);
    expect(sim.snapshot().violations).toEqual([]);
  });
});

describe('deterministic experiments', () => {
  it('frame-sized advancement and one large advancement produce the same protocol outcome', () => {
    const large = settled(19);
    const frames = new Simulator(19);
    for (let i = 0; i < 18; i++) advance(frames, 100);
    const a = large.snapshot();
    const b = frames.snapshot();
    expect(b.nodes).toEqual(a.nodes);
    expect(b.metrics).toEqual(a.metrics);
    expect(b.trace).toEqual(a.trace);
    expect(b.packets).toEqual(a.packets);
    expect(b.now).toBe(a.now);
  });

  it('a newly cut link drops already queued packets instead of delivering a write', () => {
    const sim = settled();
    sim.act({ type: 'network', latency: 200, loss: 0 });
    const primary = leader(sim);
    sim.act({ type: 'write', node: primary, key: 'wire', value: 'in-flight' });
    const before = sim.snapshot().metrics.dropped;
    sim.act({ type: 'partition', groups: [['N1'], ['N2'], ['N3'], ['N4'], ['N5']] });
    advance(sim, 400);
    expect(sim.snapshot().metrics.dropped).toBeGreaterThan(before);
    expect(sim.snapshot().metrics.committed).toBe(0);
    for (const n of sim.snapshot().nodes.filter((n) => n.id !== primary)) {
      expect(n.log.some((e) => e.key === 'wire')).toBe(false);
    }
  });

  it('rejects cumulative time, action-count and UTF-8 byte-size limits', () => {
    const doc = settled().export();
    expect(() =>
      parseReplay(
        JSON.stringify({ ...doc, actions: Array(25).fill({ type: 'advance', ms: 5000 }) }),
      ),
    ).toThrow();
    expect(() =>
      parseReplay(JSON.stringify({ ...doc, actions: Array(6001).fill({ type: 'heal' }) })),
    ).toThrow();
    expect(() => parseReplay('你'.repeat(700_000))).toThrow('2 MB');
  });

  it('invalid live operations leave the experiment history and state intact', () => {
    const sim = settled();
    const before = sim.snapshot();
    const history = sim.export();
    expect(() => sim.act({ type: 'advance', ms: 120_000 })).toThrow();
    expect(() =>
      sim.act({ type: 'write', node: leader(sim), key: 'constructor', value: 'x' }),
    ).toThrow();
    expect(sim.snapshot()).toEqual(before);
    expect(sim.export()).toEqual(history);
  });

  it('export/import reproduces the complete snapshot including PRNG-dependent messages', () => {
    const sim = settled(41);
    sim.act({ type: 'network', latency: 90, loss: 0.3 });
    sim.act({ type: 'write', node: leader(sim), key: 'x', value: '42' });
    advance(sim, 1800);
    sim.act({ type: 'crash', node: 'N2' });
    advance(sim, 400);
    sim.act({ type: 'recover', node: 'N2' });
    advance(sim);
    expect(replay(parseReplay(JSON.stringify(sim.export()))).snapshot()).toEqual(sim.snapshot());
  });

  it('rewinds to a prefix and creates an independent branch', () => {
    const sim = settled();
    const cursor = sim.export().actions.length;
    sim.act({ type: 'write', node: leader(sim), key: 'x', value: 'future' });
    advance(sim);
    const branch = replay(sim.export(), cursor);
    expect(branch.snapshot().metrics.committed).toBe(0);
    branch.act({ type: 'write', node: leader(branch), key: 'x', value: 'branch' });
    advance(branch);
    expect(branch.snapshot().nodes[0].stateMachine.x).toBe('branch');
    expect(sim.snapshot().nodes[0].stateMachine.x).toBe('future');
  });

  it('rejects malformed and unbounded replays before simulation', () => {
    const doc = settled().export();
    const bad = [
      { ...doc, version: 99 },
      { ...doc, seed: 1.5 },
      { ...doc, actions: [{ type: 'advance', ms: 1e12 }] },
      { ...doc, actions: [{ type: 'crash', node: 'ROOT' }] },
      { ...doc, actions: [{ type: 'partition', groups: [['N1'], ['N1']] }] },
      { ...doc, actions: [{ type: 'write', node: 'N1', key: '__proto__', value: 'x' }] },
      { ...doc, actions: [{ type: 'network', loss: NaN, latency: 10 }] },
    ];
    for (const value of bad) expect(() => parseReplay(JSON.stringify(value))).toThrow();
    expect(() => parseReplay('x'.repeat(2_000_001))).toThrow();
  });

  it('maintains safety across 40 seeded fault schedules then converges after healing', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const sim = settled(seed);
      for (let i = 0; i < 32; i++) {
        const node = `N${((seed * 13 + i * 7) % 5) + 1}` as NodeId;
        if (i % 7 === 0)
          sim.act({
            type: 'partition',
            groups: [
              ['N1', 'N2'],
              ['N3', 'N4', 'N5'],
            ],
          });
        if (i % 7 === 3) sim.act({ type: 'heal' });
        if (i % 5 === 0) sim.act({ type: 'crash', node });
        if (i % 5 === 2)
          sim
            .snapshot()
            .nodes.filter((n) => n.crashed)
            .forEach((n) => sim.act({ type: 'recover', node: n.id }));
        sim.act({ type: 'network', loss: (i % 4) * 0.08, latency: 25 + (i % 5) * 25 });
        for (const n of sim.snapshot().nodes.filter((n) => n.role === 'leader' && !n.crashed)) {
          sim.act({ type: 'write', node: n.id, key: `k${i % 4}`, value: `${seed}/${i}` });
        }
        advance(sim, 450);
        expect(sim.snapshot().violations, `seed ${seed} step ${i}`).toEqual([]);
      }
      sim.act({ type: 'heal' });
      sim.act({ type: 'network', loss: 0, latency: 25 });
      sim
        .snapshot()
        .nodes.filter((n) => n.crashed)
        .forEach((n) => sim.act({ type: 'recover', node: n.id }));
      advance(sim, 5000);
      const nodes = sim.snapshot().nodes;
      for (const n of nodes) {
        expect(n.stateMachine, `seed ${seed}`).toEqual(nodes[0].stateMachine);
        expect(n.log, `seed ${seed}`).toEqual(nodes[0].log);
      }
      expect(sim.snapshot().violations).toEqual([]);
    }
  }, 30_000);
});
