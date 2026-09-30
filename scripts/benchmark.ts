import { performance } from 'node:perf_hooks';
import { Simulator } from '../src/engine/simulator.ts';
import { replay } from '../src/engine/replay.ts';
import type { NodeId } from '../src/engine/types.ts';

const samples: number[] = [];
let transitions = 0,
  sent = 0,
  replayMs = 0;
for (let seed = 1; seed <= 100; seed++) {
  const start = performance.now();
  const sim = new Simulator(seed);
  sim.act({ type: 'advance', ms: 1800 });
  for (let i = 0; i < 60; i++) {
    if (i % 10 === 0)
      sim.act({
        type: 'partition',
        groups: [
          ['N1', 'N2'],
          ['N3', 'N4', 'N5'],
        ],
      });
    if (i % 10 === 5) sim.act({ type: 'heal' });
    if (i % 11 === 0) sim.act({ type: 'crash', node: `N${(i % 5) + 1}` as NodeId });
    if (i % 11 === 3)
      sim
        .snapshot()
        .nodes.filter((n) => n.crashed)
        .forEach((n) => sim.act({ type: 'recover', node: n.id }));
    sim.act({ type: 'network', latency: 25 + (i % 4) * 35, loss: (i % 3) * 0.1 });
    const leader = sim
      .snapshot()
      .nodes.filter((n) => n.role === 'leader' && !n.crashed)
      .sort((a, b) => b.term - a.term)[0];
    if (leader) sim.act({ type: 'write', node: leader.id, key: 'counter', value: String(i) });
    sim.act({ type: 'advance', ms: 700 });
  }
  sim.act({ type: 'heal' });
  sim.act({ type: 'network', latency: 25, loss: 0 });
  sim
    .snapshot()
    .nodes.filter((n) => n.crashed)
    .forEach((n) => sim.act({ type: 'recover', node: n.id }));
  sim.act({ type: 'advance', ms: 6000 });
  const snapshot = sim.snapshot();
  if (
    snapshot.violations.length ||
    snapshot.nodes.some((n) => JSON.stringify(n.log) !== JSON.stringify(snapshot.nodes[0].log))
  )
    throw new Error(`Seed ${seed} failed safety/convergence`);
  samples.push(performance.now() - start);
  transitions += snapshot.checked;
  sent += snapshot.metrics.sent;
  const replayStart = performance.now();
  const restored = replay(sim.export()).snapshot();
  replayMs += performance.now() - replayStart;
  if (JSON.stringify(restored) !== JSON.stringify(snapshot))
    throw new Error(`Seed ${seed} replay diverged`);
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      seeds: 100,
      virtualMsPerSeed: 49800,
      safetyViolations: 0,
      exactReplays: 100,
      transitions,
      messagesSent: sent,
      simulationMedianMs: +samples[49].toFixed(2),
      simulationP95Ms: +samples[94].toFixed(2),
      replayMeanMs: +(replayMs / 100).toFixed(2),
      node: process.version,
      platform: process.platform,
      note: 'Wall-time numbers are local measurements, not a distributed-system throughput benchmark.',
    },
    null,
    2,
  ),
);
