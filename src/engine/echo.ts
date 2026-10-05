import { Simulator } from './simulator.ts';
import type { NodeId, ReplayDocument } from './types.ts';

export interface VoteEcho {
  document: ReplayDocument;
  candidate: NodeId;
  peer: NodeId;
  packet: number;
}

/** A real election with intercepted replies; every state is reached through public actions. */
export function buildVoteEcho(): VoteEcho {
  const sim = new Simulator(7);
  sim.act({ type: 'network', latency: 10, loss: 0 });
  sim.act({ type: 'step' });
  const candidate = sim.snapshot().nodes.find((n) => n.role === 'candidate')!.id;
  const replies: number[] = [];
  for (let i = 0; i < 80 && replies.length < 4; i++) {
    sim.act({ type: 'step' });
    const response = sim
      .snapshot()
      .packets.find(
        (p) =>
          p.status === 'in-flight' &&
          p.to === candidate &&
          p.payload.kind === 'voted' &&
          p.payload.granted &&
          !replies.includes(p.id),
      );
    if (response) {
      sim.act({ type: 'hold', packet: response.id });
      replies.push(response.id);
    }
  }
  if (replies.length !== 4) throw new Error('选票回声实验未能拦截全部回复。');
  const packet = replies[0];
  const peer = sim.snapshot().transport.held.find((p) => p.id === packet)!.from;
  sim.act({ type: 'release', packet, delay: 1 });
  sim.act({ type: 'duplicate', packet, delay: 2 });
  sim.act({ type: 'duplicate', packet, delay: 3 });
  sim.act({ type: 'advance', ms: 3 });
  const node = sim.snapshot().nodes.find((n) => n.id === candidate)!;
  if (node.role !== 'candidate' || node.votes.length !== 2)
    throw new Error('选票回声实验未满足两张独立选票的前置条件。');
  return { document: sim.export(), candidate, peer, packet };
}
