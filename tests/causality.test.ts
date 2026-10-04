import { describe, expect, it } from 'vitest';
import { Simulator } from '../src/engine/simulator.ts';
import { buildPartitionStory } from '../src/engine/story.ts';
import { parseReplay, replay } from '../src/engine/replay.ts';
import { NODE_IDS, type Action } from '../src/engine/types.ts';

describe('causal protocol evidence', () => {
  it('records the actual vote, quorum and commit branches with before/after state', () => {
    const sim = new Simulator(7);
    const codes = new Set<string>();
    for (let i = 0; i < 80; i++) {
      sim.act({ type: 'step' });
      const effect = sim.snapshot().lastEffect!;
      expect(effect.event).toEqual(sim.snapshot().lastEvent);
      codes.add(effect.decision.code);
      if (effect.decision.code === 'election-started') {
        expect(effect.transition.after.term).toBe(effect.transition.before.term + 1);
        expect(effect.transition.after.role).toBe('candidate');
      }
      if (effect.decision.code === 'vote-granted') {
        expect(effect.transition.after.votedFor).toBe(effect.event.from);
        expect(effect.decision.verdict).toBe('accepted');
      }
      if (effect.decision.code === 'vote-quorum') {
        expect(effect.transition.before.role).toBe('candidate');
        expect(effect.transition.after.role).toBe('leader');
        expect(effect.decision.facts.votes).toBe(3);
      }
      if (effect.decision.code === 'commit-advanced') {
        expect(effect.transition.after.commitIndex).toBeGreaterThan(
          effect.transition.before.commitIndex,
        );
        expect(effect.transition.after.lastApplied).toBe(effect.transition.after.commitIndex);
      }
    }
    for (const code of ['election-started', 'vote-granted', 'vote-quorum', 'commit-advanced'])
      expect(codes.has(code)).toBe(true);
    expect(replay(sim.export()).snapshot()).toEqual(sim.snapshot());
  });

  it('records the actual removal of an uncommitted conflict without inventing a rejection', () => {
    const story = buildPartitionStory();
    const sim = replay(story.document, story.checkpoints[4]);
    let repaired = false;
    for (let i = 0; i < 250 && !repaired; i++) {
      sim.act({ type: 'step' });
      const effect = sim.snapshot().lastEffect!;
      if (effect.decision.code === 'log-repaired') {
        repaired = true;
        expect(effect.transition.before.tail.value).toBe('red-route');
        expect(effect.transition.after.tail.value).toBe('blue-route');
        expect(effect.decision.facts.truncatedFrom).toBeGreaterThan(
          effect.transition.before.commitIndex,
        );
        const packet = sim.snapshot().packets.find((p) => p.id === effect.event.packetId)!;
        expect(packet.decision).toEqual(effect.decision);
        expect(packet.transition).toEqual(effect.transition);
        const view = sim.snapshot();
        view.lastEffect!.transition.after.tail.value = 'mutation';
        expect(sim.snapshot().lastEffect!.transition.after.tail.value).toBe('blue-route');
      }
    }
    expect(repaired).toBe(true);
    sim.act({ type: 'advance', ms: 1800 });
    expect(sim.snapshot().nodes.every((n) => n.stateMachine.route === 'blue-route')).toBe(true);
    expect(sim.snapshot().violations).toEqual([]);
    expect(replay(parseReplay(JSON.stringify(sim.export()))).snapshot()).toEqual(sim.snapshot());
  });

  it('rejects a missing prefix on a recovered lagging node before retrying', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'advance', ms: 1800 });
    const old = sim.snapshot().nodes.find((n) => n.role === 'leader')!.id;
    const lagging = NODE_IDS.find((id) => id !== old)!;
    sim.act({ type: 'crash', node: lagging });
    for (let i = 0; i < 2; i++) {
      sim.act({ type: 'write', node: old, key: `probe${i}`, value: 'persisted' });
      sim.act({ type: 'advance', ms: 300 });
    }
    sim.act({ type: 'crash', node: old });
    sim.act({ type: 'advance', ms: 1800 });
    sim.act({ type: 'recover', node: lagging });
    let rejected = false;
    for (let i = 0; i < 200 && !rejected; i++) {
      sim.act({ type: 'step' });
      const effect = sim.snapshot().lastEffect!;
      if (effect.decision.code !== 'log-prefix-mismatch') continue;
      rejected = true;
      expect(effect.transition.node).toBe(lagging);
      expect(effect.decision.verdict).toBe('rejected');
      expect(effect.decision.facts.localPrevTerm).toBeNull();
      expect(effect.transition.after.logLength).toBe(effect.transition.before.logLength);
      expect(effect.transition.after.commitIndex).toBe(effect.transition.before.commitIndex);
    }
    expect(rejected).toBe(true);
    sim.act({ type: 'advance', ms: 1500 });
    expect(sim.snapshot().nodes.find((n) => n.id === lagging)!.stateMachine.probe1).toBe(
      'persisted',
    );
    expect(sim.snapshot().packets.some((p) => p.decision?.code === 'prefix-backtrack')).toBe(true);
    expect(replay(sim.export()).snapshot()).toEqual(sim.snapshot());
  });
});

describe('directed network faults', () => {
  it('cuts only one direction, including messages already in flight, and heals all cuts', () => {
    const sim = new Simulator(7);
    sim.act({ type: 'advance', ms: 1800 });
    const leader = sim.snapshot().nodes.find((n) => n.role === 'leader')!.id;
    const peer = NODE_IDS.find((id) => id !== leader)!;
    sim.act({ type: 'write', node: leader, key: 'probe', value: 'in-flight' });
    const packet = sim.snapshot().packets.findLast((p) => p.from === leader && p.to === peer)!;
    sim.act({ type: 'link', from: leader, to: peer, enabled: false });
    sim.act({ type: 'advance', ms: 40 });
    const dropped = sim.snapshot().packets.find((p) => p.id === packet.id)!;
    expect(dropped.dropReason).toBe('link-at-delivery');
    expect(dropped.decision?.verdict).toBe('dropped');
    expect(dropped.transition!.before).toEqual(dropped.transition!.after);
    sim.act({ type: 'advance', ms: 800 });
    expect(
      sim
        .snapshot()
        .packets.some((p) => p.from === leader && p.to === peer && p.dropReason === 'link-on-send'),
    ).toBe(true);
    expect(
      sim
        .snapshot()
        .packets.some((p) => p.from === peer && p.to === leader && p.status === 'delivered'),
    ).toBe(true);
    expect(sim.snapshot().links).toEqual([{ from: leader, to: peer }]);
    expect(replay(sim.export()).snapshot()).toEqual(sim.snapshot());
    sim.act({ type: 'heal' });
    expect(sim.snapshot().links).toEqual([]);
    sim.act({ type: 'advance', ms: 2500 });
    expect(sim.snapshot().nodes.every((n) => n.stateMachine.probe === 'in-flight')).toBe(true);
    expect(sim.snapshot().violations).toEqual([]);
  });

  it('validates link actions before mutating the history and canonicalizes cut ordering', () => {
    const sim = new Simulator(7);
    for (const action of [
      { type: 'link', from: 'N1', to: 'N1', enabled: false },
      { type: 'link', from: 'N9', to: 'N2', enabled: false },
      { type: 'link', from: 'N1', to: 'N2', enabled: 'false' },
    ]) {
      const before = sim.snapshot();
      expect(() => sim.act(action as Action)).toThrow();
      expect(sim.snapshot()).toEqual(before);
    }
    sim.act({ type: 'link', from: 'N5', to: 'N4', enabled: false });
    sim.act({ type: 'link', from: 'N1', to: 'N2', enabled: false });
    expect(sim.snapshot().links).toEqual([
      { from: 'N1', to: 'N2' },
      { from: 'N5', to: 'N4' },
    ]);
    sim.act({ type: 'link', from: 'N1', to: 'N2', enabled: true });
    expect(sim.snapshot().links).toEqual([{ from: 'N5', to: 'N4' }]);
  });

  it('preserves safety, exact replay and eventual convergence across asymmetric faults in 20 seeds', () => {
    for (let seed = 0; seed < 20; seed++) {
      const sim = new Simulator(seed);
      sim.act({ type: 'advance', ms: 1800 });
      for (let round = 0; round < 4; round++) {
        const from = NODE_IDS[(seed + round) % 5],
          to = NODE_IDS[(seed + round + 1) % 5];
        sim.act({ type: 'link', from, to, enabled: false });
        sim.act({ type: 'network', latency: 60, loss: 0.15 });
        sim.act({ type: 'advance', ms: 600 });
        const leader = sim
          .snapshot()
          .nodes.filter((n) => n.role === 'leader')
          .sort((a, b) => b.term - a.term)[0];
        if (leader)
          sim.act({ type: 'write', node: leader.id, key: `round${round}`, value: `${seed}` });
        sim.act({ type: 'advance', ms: 500 });
      }
      sim.act({ type: 'heal' });
      sim.act({ type: 'network', latency: 25, loss: 0 });
      sim.act({ type: 'advance', ms: 4000 });
      const final = sim.snapshot();
      expect(final.violations).toEqual([]);
      for (const n of final.nodes) {
        expect(n.log).toEqual(final.nodes[0].log);
        expect(n.stateMachine).toEqual(final.nodes[0].stateMachine);
      }
      expect(replay(sim.export()).snapshot()).toEqual(final);
    }
  });
});
