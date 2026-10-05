import { performance } from 'node:perf_hooks';
import { Simulator } from '../src/engine/simulator.ts';
import { replay } from '../src/engine/replay.ts';
import { NODE_IDS, type NodeId } from '../src/engine/types.ts';

const samples: number[] = [];
let transitions = 0,
  sent = 0,
  replayMs = 0;
const packetActions = { holds: 0, releases: 0, duplicates: 0, discards: 0 };
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
    if (i % 10 === 6 || i % 10 === 7)
      sim.act({
        type: 'link',
        from: NODE_IDS[(seed + i) % 5],
        to: NODE_IDS[(seed + i + 1) % 5],
        enabled: false,
      });
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
    const transport = sim.snapshot().transport;
    if (i % 6 === 0 && transport.pending.length) {
      sim.act({ type: 'hold', packet: transport.pending[0].id });
      packetActions.holds++;
    } else if (i % 6 === 1 && transport.held.length) {
      sim.act({ type: 'duplicate', packet: transport.held[0].id, delay: 1 + (i % 7) * 20 });
      packetActions.duplicates++;
    } else if (i % 6 === 2 && transport.held.length) {
      sim.act({ type: 'release', packet: transport.held[0].id, delay: 250 + ((i * 17) % 1000) });
      packetActions.releases++;
    } else if (i % 6 === 3 && transport.pending.length) {
      sim.act({ type: 'drop', packet: transport.pending[0].id });
      packetActions.discards++;
    }
    sim.act({ type: 'advance', ms: 700 });
  }
  sim.act({ type: 'heal' });
  sim.act({ type: 'network', latency: 25, loss: 0 });
  for (const packet of sim.snapshot().transport.held) {
    sim.act({ type: 'release', packet: packet.id, delay: 100 });
    packetActions.releases++;
  }
  sim
    .snapshot()
    .nodes.filter((n) => n.crashed)
    .forEach((n) => sim.act({ type: 'recover', node: n.id }));
  sim.act({ type: 'advance', ms: 6000 });
  const snapshot = sim.snapshot();
  const reference = snapshot.nodes[0];
  const expectedLog = JSON.stringify(reference.log);
  const expectedState = JSON.stringify(reference.stateMachine);
  if (
    snapshot.violations.length ||
    snapshot.transport.held.length ||
    snapshot.nodes.some(
      (n) =>
        n.crashed ||
        n.commitIndex !== reference.commitIndex ||
        n.lastApplied !== n.commitIndex ||
        JSON.stringify(n.log) !== expectedLog ||
        JSON.stringify(n.stateMachine) !== expectedState,
    )
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
      faultModel:
        'partitions + directed cuts + crash/recovery + jitter/loss + hold/release/duplicate/drop',
      packetActions,
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
