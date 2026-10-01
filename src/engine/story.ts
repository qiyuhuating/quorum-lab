import { Simulator } from './simulator.ts';
import type { NodeId, ReplayDocument } from './types.ts';

export interface PartitionStory {
  document: ReplayDocument;
  checkpoints: number[];
  oldLeader: NodeId;
  newLeader: NodeId;
}

/** Checkpoints are action prefixes of one real protocol run, never staged node state. */
export function buildPartitionStory(): PartitionStory {
  const sim = new Simulator(7);
  const checkpoints: number[] = [];
  const mark = () => checkpoints.push(sim.export().actions.length);
  sim.act({ type: 'advance', ms: 1800 });
  const oldLeader = sim.snapshot().nodes.find((n) => n.role === 'leader')!.id;
  sim.act({ type: 'write', node: oldLeader, key: 'mission', value: 'orbit' });
  sim.act({ type: 'advance', ms: 200 });
  sim.act({ type: 'write', node: oldLeader, key: 'mode', value: 'nominal' });
  sim.act({ type: 'advance', ms: 200 });
  mark();
  const peers = sim
    .snapshot()
    .nodes.map((n) => n.id)
    .filter((id) => id !== oldLeader);
  const majority = peers.slice(1);
  sim.act({ type: 'partition', groups: [[oldLeader, peers[0]], majority] });
  mark();
  sim.act({ type: 'write', node: oldLeader, key: 'route', value: 'red-route' });
  sim.act({ type: 'advance', ms: 2200 });
  mark();
  const newLeader = sim
    .snapshot()
    .nodes.find((n) => majority.includes(n.id) && n.role === 'leader')!.id;
  sim.act({ type: 'write', node: newLeader, key: 'route', value: 'blue-route' });
  sim.act({ type: 'advance', ms: 400 });
  mark();
  sim.act({ type: 'heal' });
  mark();
  sim.act({ type: 'advance', ms: 1600 });
  mark();
  return { document: sim.export(), checkpoints, oldLeader, newLeader };
}
