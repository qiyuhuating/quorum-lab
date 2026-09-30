export const NODE_IDS = ['N1', 'N2', 'N3', 'N4', 'N5'] as const;
export const MAX_TIME = 120_000;
export const MAX_ACTIONS = 6000;
export const MAX_LOG = 256;
export type NodeId = (typeof NODE_IDS)[number];
export type Role = 'follower' | 'candidate' | 'leader';
export interface Entry {
  term: number;
  id: string;
  key: string | null;
  value: string | null;
}
export interface NodeView {
  id: NodeId;
  term: number;
  role: Role;
  crashed: boolean;
  votedFor: NodeId | null;
  log: Entry[];
  commitIndex: number;
  lastApplied: number;
  stateMachine: Record<string, string>;
  electionAt: number;
  votes: NodeId[];
  nextIndex: Partial<Record<NodeId, number>>;
  matchIndex: Partial<Record<NodeId, number>>;
}
export type Action =
  | { type: 'advance'; ms: number }
  | { type: 'write'; node: NodeId; key: string; value: string }
  | { type: 'crash' | 'recover'; node: NodeId }
  | { type: 'partition'; groups: NodeId[][] }
  | { type: 'heal' }
  | { type: 'network'; latency: number; loss: number };
export interface ReplayDocument {
  version: 1;
  seed: number;
  actions: Action[];
}
export interface Trace {
  at: number;
  kind: string;
  text: string;
  node?: NodeId;
}
export interface Packet {
  id: number;
  from: NodeId;
  to: NodeId;
  kind: string;
  sentAt: number;
  deliverAt: number;
  dropped: boolean;
}
export interface Metrics {
  sent: number;
  delivered: number;
  dropped: number;
  elections: number;
  committed: number;
  accepted: number;
  latencyP50: number;
  latencyP95: number;
}
export interface Snapshot {
  now: number;
  seed: number;
  nodes: NodeView[];
  groups: NodeId[][];
  network: { latency: number; loss: number };
  metrics: Metrics;
  packets: Packet[];
  trace: Trace[];
  violations: string[];
  checked: number;
  actionCount: number;
}
export interface ActionResult {
  ok: boolean;
  message: string;
}
