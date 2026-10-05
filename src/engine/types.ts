export const NODE_IDS = ['N1', 'N2', 'N3', 'N4', 'N5'] as const;
export const MAX_TIME = 120_000;
export const MAX_ACTIONS = 6000;
export const MAX_LOG = 256;
export const MAX_HELD = 32;
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
  | { type: 'step' }
  | { type: 'hold' | 'drop'; packet: number }
  | { type: 'release' | 'duplicate'; packet: number; delay: number }
  | { type: 'write'; node: NodeId; key: string; value: string }
  | { type: 'crash' | 'recover'; node: NodeId }
  | { type: 'partition'; groups: NodeId[][] }
  | { type: 'link'; from: NodeId; to: NodeId; enabled: boolean }
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
  status: 'in-flight' | 'held' | 'delivered' | 'dropped';
  duplicateOf?: number;
  dropReason?:
    | 'packet-loss'
    | 'partition-on-send'
    | 'receiver-offline'
    | 'partition-at-delivery'
    | 'link-on-send'
    | 'link-at-delivery'
    | 'manual';
  payload: Rpc;
  decision?: Decision;
  transition?: NodeTransition;
}
export interface Decision {
  verdict: 'accepted' | 'rejected' | 'ignored' | 'dropped';
  code:
    | 'election-started'
    | 'heartbeat-sent'
    | 'vote-granted'
    | 'stale-term'
    | 'already-voted'
    | 'log-behind'
    | 'not-candidate'
    | 'vote-denied'
    | 'duplicate-vote'
    | 'vote-counted'
    | 'vote-quorum'
    | 'log-prefix-mismatch'
    | 'log-repaired'
    | 'entries-accepted'
    | 'heartbeat-accepted'
    | 'not-leader'
    | 'stale-rpc'
    | 'commit-advanced'
    | 'replica-acknowledged'
    | 'prefix-backtrack'
    | 'stale-rejection'
    | 'transport-dropped';
  title: string;
  detail: string;
  facts: Record<string, string | number | boolean | null>;
}
export interface NodeSummary {
  role: Role;
  term: number;
  votedFor: NodeId | null;
  commitIndex: number;
  lastApplied: number;
  logLength: number;
  tail: Entry;
}
export interface NodeTransition {
  node: NodeId;
  before: NodeSummary;
  after: NodeSummary;
}
export interface EventEffect {
  event: ScheduledEvent;
  decision: Decision;
  transition: NodeTransition;
}
export type Rpc = { from: NodeId; to: NodeId; term: number } & (
  | { kind: 'vote'; lastIndex: number; lastTerm: number }
  | { kind: 'voted'; granted: boolean }
  | {
      kind: 'append';
      prevIndex: number;
      prevTerm: number;
      entries: Entry[];
      leaderCommit: number;
      rpc: number;
    }
  | { kind: 'appended'; success: boolean; match: number; requestPrev: number; rpc: number }
);
export interface ScheduledEvent {
  at: number;
  seq: number;
  type: 'election' | 'heartbeat' | 'message';
  node?: NodeId;
  from?: NodeId;
  to?: NodeId;
  kind?: string;
  packetId?: number;
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
  links: { from: NodeId; to: NodeId }[];
  network: { latency: number; loss: number };
  metrics: Metrics;
  packets: Packet[];
  transport: { held: Packet[]; pending: Packet[]; duplicates: number; discarded: number };
  trace: Trace[];
  violations: string[];
  checked: number;
  actionCount: number;
  queue: ScheduledEvent[];
  lastEvent?: ScheduledEvent;
  lastEffect?: EventEffect;
}
export interface ActionResult {
  ok: boolean;
  message: string;
}
