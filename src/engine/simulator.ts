import { validateAction, validateSeed } from './actions.ts';
import { Heap } from './heap.ts';
import {
  MAX_ACTIONS,
  MAX_LOG,
  MAX_TIME,
  NODE_IDS,
  type Action,
  type ActionResult,
  type Entry,
  type Metrics,
  type NodeId,
  type NodeView,
  type Packet,
  type ReplayDocument,
  type Snapshot,
  type Trace,
  type Rpc,
  type ScheduledEvent,
} from './types.ts';

interface Node extends NodeView {
  electionEpoch: number;
  heartbeatEpoch: number;
  ackSeq: Partial<Record<NodeId, number>>;
}
type Event = { at: number; seq: number } & (
  | { type: 'election' | 'heartbeat'; node: NodeId; epoch: number }
  | { type: 'message'; message: Rpc; packet: Packet }
);
const ROOT: Entry = { term: 0, id: 'root', key: null, value: null };
const HEARTBEAT = 100;
const QUORUM = 3;
const equal = (a: Entry, b: Entry) =>
  a.term === b.term && a.id === b.id && a.key === b.key && a.value === b.value;

/** Pure virtual-time protocol. No DOM, network IO, Date or Math.random. */
export class Simulator {
  readonly seed: number;
  private randomState: number;
  private now = 0;
  private sequence = 0;
  private rpcSequence = 0;
  private commandSequence = 0;
  private queue = new Heap<Event>();
  private nodes: Node[];
  private groups: NodeId[][] = [[...NODE_IDS]];
  private network = { latency: 25, loss: 0 };
  private actions: Action[] = [];
  private trace: Trace[] = [];
  private packets: Packet[] = [];
  private violations: string[] = [];
  private checked = 0;
  private lastEvent?: ScheduledEvent;
  // These maps are safety/latency observers, never inputs to protocol decisions.
  private elected = new Map<number, NodeId>();
  private committed = new Map<number, Entry>();
  private submissions = new Map<string, number>();
  private completed = new Set<string>();
  private latencies: number[] = [];
  private metrics: Metrics = {
    sent: 0,
    delivered: 0,
    dropped: 0,
    elections: 0,
    committed: 0,
    accepted: 0,
    latencyP50: 0,
    latencyP95: 0,
  };

  constructor(seed = 7) {
    this.seed = validateSeed(seed);
    this.randomState = seed;
    this.nodes = NODE_IDS.map((id) => ({
      id,
      term: 0,
      role: 'follower',
      crashed: false,
      votedFor: null,
      log: [{ ...ROOT }],
      commitIndex: 0,
      lastApplied: 0,
      stateMachine: {},
      electionAt: 0,
      votes: [],
      nextIndex: {},
      matchIndex: {},
      ackSeq: {},
      electionEpoch: 0,
      heartbeatEpoch: 0,
    }));
    for (const n of this.nodes) this.resetElection(n);
    this.note('boot', '五个节点启动。等待随机选举超时。');
  }

  private random() {
    this.randomState = (this.randomState + 0x6d2b79f5) >>> 0;
    let x = this.randomState;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }
  private get(id: NodeId) {
    return this.nodes[NODE_IDS.indexOf(id)];
  }
  private peers(n: Node) {
    return this.nodes.filter((p) => p.id !== n.id);
  }
  private note(kind: string, text: string, node?: NodeId) {
    this.trace.push({ at: this.now, kind, text, ...(node ? { node } : {}) });
    if (this.trace.length > 400) this.trace.shift();
  }
  private schedule(event: Omit<Extract<Event, { type: 'election' | 'heartbeat' }>, 'seq'>) {
    this.queue.push({ ...event, seq: ++this.sequence });
  }
  private resetElection(n: Node) {
    n.electionAt = this.now + 450 + Math.floor(this.random() * 350);
    this.schedule({ type: 'election', node: n.id, at: n.electionAt, epoch: ++n.electionEpoch });
  }
  private connected(from: NodeId, to: NodeId) {
    return this.groups.some((g) => g.includes(from) && g.includes(to));
  }
  private send(message: Rpc) {
    const delay = Math.max(
      1,
      this.network.latency + Math.round((this.random() - 0.5) * this.network.latency),
    );
    const loss = this.random() < this.network.loss;
    const packet: Packet = {
      id: ++this.sequence,
      from: message.from,
      to: message.to,
      kind: message.kind,
      sentAt: this.now,
      deliverAt: this.now + delay,
      dropped: loss || !this.connected(message.from, message.to) || this.get(message.to).crashed,
      status: 'in-flight',
      payload: structuredClone(message),
    };
    if (packet.dropped) {
      packet.status = 'dropped';
      packet.dropReason = loss
        ? 'packet-loss'
        : this.get(message.to).crashed
          ? 'receiver-offline'
          : 'partition-on-send';
    }
    this.metrics.sent++;
    this.packets.push(packet);
    if (this.packets.length > 128) this.packets.shift();
    if (packet.dropped) {
      this.metrics.dropped++;
      return;
    }
    this.queue.push({
      type: 'message',
      message: structuredClone(message),
      packet,
      at: packet.deliverAt,
      seq: ++this.sequence,
    });
  }
  private follower(n: Node, term: number) {
    if (term > n.term) {
      n.term = term;
      n.votedFor = null;
    }
    n.role = 'follower';
    n.votes = [];
    n.heartbeatEpoch++;
    n.nextIndex = {};
    n.matchIndex = {};
    n.ackSeq = {};
    this.resetElection(n);
  }
  private elect(n: Node) {
    n.term++;
    n.role = 'candidate';
    n.votedFor = n.id;
    n.votes = [n.id];
    this.metrics.elections++;
    this.resetElection(n);
    this.note('election', `${n.id} 发起任期 ${n.term} 的选举。`, n.id);
    const lastIndex = n.log.length - 1;
    for (const p of this.peers(n))
      this.send({
        kind: 'vote',
        from: n.id,
        to: p.id,
        term: n.term,
        lastIndex,
        lastTerm: n.log[lastIndex].term,
      });
  }
  private lead(n: Node) {
    const prior = this.elected.get(n.term);
    this.require(!prior || prior === n.id, `Election safety: term ${n.term} elected two leaders`);
    this.elected.set(n.term, n.id);
    for (const [index, entry] of this.committed)
      this.require(
        !!n.log[index] && equal(n.log[index], entry),
        `Leader completeness: ${n.id} lacks committed index ${index}`,
      );
    n.role = 'leader';
    n.electionEpoch++;
    for (const p of this.peers(n)) {
      n.nextIndex[p.id] = n.log.length;
      n.matchIndex[p.id] = 0;
      n.ackSeq[p.id] = 0;
    }
    // A current-term no-op lets a new leader safely commit inherited entries (§5.4.2).
    n.log.push({ term: n.term, id: `noop-${n.term}-${n.id}`, key: null, value: null });
    this.note('leader', `${n.id} 获得 ${n.votes.length}/5 票，成为任期 ${n.term} 的领导者。`, n.id);
    this.broadcast(n);
    this.schedule({
      type: 'heartbeat',
      node: n.id,
      at: this.now + HEARTBEAT,
      epoch: ++n.heartbeatEpoch,
    });
  }
  private append(n: Node, peer: NodeId) {
    const next = n.nextIndex[peer] ?? n.log.length;
    const prevIndex = next - 1;
    this.send({
      kind: 'append',
      from: n.id,
      to: peer,
      term: n.term,
      prevIndex,
      prevTerm: n.log[prevIndex].term,
      entries: n.log.slice(next),
      leaderCommit: n.commitIndex,
      rpc: ++this.rpcSequence,
    });
  }
  private broadcast(n: Node) {
    for (const p of this.peers(n)) this.append(n, p.id);
  }
  private apply(n: Node) {
    while (n.lastApplied < n.commitIndex) {
      const index = ++n.lastApplied;
      const entry = n.log[index];
      const known = this.committed.get(index);
      this.require(
        !known || equal(known, entry),
        `State machine safety: different entries at committed index ${index}`,
      );
      this.committed.set(index, { ...entry });
      if (entry.key !== null && entry.value !== null) {
        n.stateMachine[entry.key] = entry.value;
        if (!this.completed.has(entry.id)) {
          this.completed.add(entry.id);
          this.metrics.committed++;
          const submitted = this.submissions.get(entry.id);
          if (submitted !== undefined) this.latencies.push(this.now - submitted);
          this.note('commit', `索引 ${index} 已提交：${entry.key} = ${entry.value}`, n.id);
        }
      }
    }
  }
  private commit(n: Node) {
    for (let index = n.log.length - 1; index > n.commitIndex; index--) {
      const copies = 1 + this.peers(n).filter((p) => (n.matchIndex[p.id] ?? 0) >= index).length;
      // Counting replicas alone cannot commit an older-term entry (§5.4.2).
      if (copies >= QUORUM && n.log[index].term === n.term) {
        n.commitIndex = index;
        this.apply(n);
        this.broadcast(n);
        break;
      }
    }
  }
  private receive(m: Rpc) {
    const n = this.get(m.to);
    if (m.term > n.term) this.follower(n, m.term);
    if (m.kind === 'vote') {
      const lastIndex = n.log.length - 1;
      const lastTerm = n.log[lastIndex].term;
      const upToDate =
        m.lastTerm > lastTerm || (m.lastTerm === lastTerm && m.lastIndex >= lastIndex);
      const granted =
        m.term === n.term && (n.votedFor === null || n.votedFor === m.from) && upToDate;
      if (granted) {
        n.votedFor = m.from;
        this.resetElection(n);
        this.note('vote', `${n.id} → ${m.from}：授予任期 ${n.term} 的投票。`, n.id);
      }
      this.send({ kind: 'voted', from: n.id, to: m.from, term: n.term, granted });
    } else if (m.kind === 'voted') {
      if (m.term === n.term && n.role === 'candidate' && m.granted && !n.votes.includes(m.from)) {
        n.votes.push(m.from);
        if (n.votes.length >= QUORUM) this.lead(n);
      }
    } else if (m.kind === 'append') {
      if (m.term < n.term) {
        this.send({
          kind: 'appended',
          from: n.id,
          to: m.from,
          term: n.term,
          success: false,
          match: 0,
          requestPrev: m.prevIndex,
          rpc: m.rpc,
        });
        return;
      }
      if (n.role !== 'follower') this.follower(n, m.term);
      else this.resetElection(n);
      const match = n.log[m.prevIndex]?.term === m.prevTerm;
      if (match) {
        for (let i = 0; i < m.entries.length; i++) {
          const index = m.prevIndex + 1 + i;
          const entry = m.entries[i];
          if (n.log[index] && n.log[index].term !== entry.term) {
            this.require(index > n.commitIndex, `Committed prefix overwritten on ${n.id}`);
            this.note('repair', `${n.id} 从索引 ${index} 截断冲突日志。`, n.id);
            n.log.length = index;
          }
          if (!n.log[index]) n.log.push({ ...entry });
        }
        // Only the prefix covered by THIS RPC is known to match the leader.
        const covered = m.prevIndex + m.entries.length;
        n.commitIndex = Math.max(n.commitIndex, Math.min(m.leaderCommit, covered));
        this.apply(n);
      }
      this.send({
        kind: 'appended',
        from: n.id,
        to: m.from,
        term: n.term,
        success: match,
        match: match ? m.prevIndex + m.entries.length : 0,
        requestPrev: m.prevIndex,
        rpc: m.rpc,
      });
    } else if (m.kind === 'appended') {
      if (n.role !== 'leader' || m.term !== n.term || m.rpc <= (n.ackSeq[m.from] ?? 0)) return;
      n.ackSeq[m.from] = m.rpc;
      if (m.success) {
        n.matchIndex[m.from] = Math.max(n.matchIndex[m.from] ?? 0, m.match);
        n.nextIndex[m.from] = Math.max(n.nextIndex[m.from] ?? 1, m.match + 1);
        this.commit(n);
        if ((n.nextIndex[m.from] ?? 1) < n.log.length) this.append(n, m.from);
      } else if (m.requestPrev >= (n.matchIndex[m.from] ?? 0)) {
        n.nextIndex[m.from] = Math.max(
          (n.matchIndex[m.from] ?? 0) + 1,
          Math.min((n.nextIndex[m.from] ?? 1) - 1, m.requestPrev),
        );
        this.append(n, m.from);
      }
    }
  }
  private process(event: Event) {
    if (this.active(event)) this.lastEvent = this.describe(event);
    if (event.type === 'message') {
      if (
        !this.connected(event.message.from, event.message.to) ||
        this.get(event.message.to).crashed
      ) {
        event.packet.dropped = true;
        event.packet.status = 'dropped';
        event.packet.dropReason = this.get(event.message.to).crashed
          ? 'receiver-offline'
          : 'partition-at-delivery';
        this.metrics.dropped++;
        return;
      }
      this.metrics.delivered++;
      event.packet.status = 'delivered';
      this.receive(event.message);
    } else {
      const n = this.get(event.node);
      if (n.crashed) return;
      if (event.type === 'election' && n.role !== 'leader' && event.epoch === n.electionEpoch)
        this.elect(n);
      if (event.type === 'heartbeat' && n.role === 'leader' && event.epoch === n.heartbeatEpoch) {
        this.broadcast(n);
        this.schedule({
          type: 'heartbeat',
          node: n.id,
          at: this.now + HEARTBEAT,
          epoch: n.heartbeatEpoch,
        });
      }
    }
  }
  private active(event: Event): boolean {
    if (event.type === 'message') return true;
    const n = this.get(event.node);
    return (
      !n.crashed &&
      (event.type === 'election'
        ? n.role !== 'leader' && event.epoch === n.electionEpoch
        : n.role === 'leader' && event.epoch === n.heartbeatEpoch)
    );
  }
  private describe(event: Event): ScheduledEvent {
    return event.type === 'message'
      ? {
          at: event.at,
          seq: event.seq,
          type: event.type,
          from: event.message.from,
          to: event.message.to,
          kind: event.message.kind,
          packetId: event.packet.id,
        }
      : { at: event.at, seq: event.seq, type: event.type, node: event.node };
  }
  private require(condition: boolean, message: string): asserts condition {
    if (!condition) {
      this.violations.push(message);
      this.note('violation', message);
      throw new Error(message);
    }
  }
  private check() {
    this.checked++;
    for (const n of this.nodes) {
      this.require(
        n.lastApplied === n.commitIndex && n.commitIndex < n.log.length,
        `Applied/commit bounds on ${n.id}`,
      );
      // Every log, including a crashed node's stable storage, must retain any committed prefix it contains.
      for (const [index, entry] of this.committed) {
        if (n.log[index] && n.log[index].term === entry.term)
          this.require(equal(n.log[index], entry), `Committed log agreement on ${n.id}`);
      }
    }
    for (let a = 0; a < 5; a++)
      for (let b = a + 1; b < 5; b++) {
        const left = this.nodes[a].log,
          right = this.nodes[b].log;
        let prefixMatches = true;
        for (let index = 1; index < Math.min(left.length, right.length); index++) {
          prefixMatches &&= equal(left[index], right[index]);
          if (left[index].term === right[index].term)
            this.require(
              prefixMatches,
              `Log matching: ${this.nodes[a].id}/${this.nodes[b].id} at ${index}`,
            );
        }
      }
  }

  act(input: Action): ActionResult {
    const action = validateAction(input);
    if (this.actions.length >= MAX_ACTIONS)
      throw new Error('实验已达 6000 次操作上限，请重置或导出。');
    if (action.type === 'advance' && this.now + action.ms > MAX_TIME)
      throw new Error('实验已达 120 秒虚拟时间上限，请重置或导出。');
    const next =
      action.type === 'step' ? this.queue.ordered().find((e) => this.active(e)) : undefined;
    if (action.type === 'step' && (!next || next.at > MAX_TIME))
      throw new Error('120 秒范围内没有可执行事件，请重置或导出。');
    this.actions.push(structuredClone(action));
    let result: ActionResult = { ok: true, message: '' };
    switch (action.type) {
      case 'step': {
        let event: Event;
        do {
          event = this.queue.pop()!;
          this.now = event.at;
          this.process(event);
          this.check();
        } while (event.seq !== next!.seq);
        break;
      }
      case 'advance': {
        const target = this.now + action.ms;
        while (this.queue.peek() && this.queue.peek()!.at <= target) {
          const event = this.queue.pop()!;
          this.now = event.at;
          this.process(event);
          this.check();
        }
        this.now = target;
        break;
      }
      case 'write': {
        const n = this.get(action.node);
        if (n.crashed || n.role !== 'leader') {
          result = { ok: false, message: `${n.id} 当前不能接受写入。请选择活跃领导者。` };
          break;
        }
        if (n.log.length >= MAX_LOG) {
          result = { ok: false, message: '日志已达 256 条上限，请重置实验。' };
          break;
        }
        const id = `cmd-${++this.commandSequence}`;
        n.log.push({ term: n.term, id, key: action.key, value: action.value });
        this.submissions.set(id, this.now);
        this.metrics.accepted++;
        this.note('write', `${n.id} 接受 ${action.key} = ${action.value}，等待多数派确认。`, n.id);
        this.broadcast(n);
        result.message = `已进入 ${n.id} 日志，等待多数派确认。`;
        break;
      }
      case 'crash': {
        const n = this.get(action.node);
        if (n.crashed) break;
        n.crashed = true;
        n.role = 'follower';
        n.electionEpoch++;
        n.heartbeatEpoch++;
        n.commitIndex = 0;
        n.lastApplied = 0;
        n.stateMachine = {};
        n.votes = [];
        n.nextIndex = {};
        n.matchIndex = {};
        n.ackSeq = {};
        this.note('crash', `${n.id} 崩溃。任期、投票与日志保留在模拟稳定存储中。`, n.id);
        break;
      }
      case 'recover': {
        const n = this.get(action.node);
        if (!n.crashed) break;
        n.crashed = false;
        this.resetElection(n);
        this.note('recover', `${n.id} 从稳定存储恢复，等待重新同步。`, n.id);
        break;
      }
      case 'partition':
        this.groups = action.groups;
        this.note('partition', `网络分区：${this.groups.map((g) => g.join(' + ')).join(' | ')}`);
        break;
      case 'heal':
        this.groups = [[...NODE_IDS]];
        this.note('heal', '分区已解除，所有链路重新连通。');
        break;
      case 'network':
        this.network = { latency: action.latency, loss: action.loss };
        this.note(
          'network',
          `链路延迟 ${action.latency}ms，丢包率 ${Math.round(action.loss * 100)}%。`,
        );
        break;
    }
    this.check();
    return result;
  }

  export(): ReplayDocument {
    return { version: 1, seed: this.seed, actions: structuredClone(this.actions) };
  }
  snapshot(): Snapshot {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const percentile = (q: number) =>
      sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)] : 0;
    return structuredClone({
      now: this.now,
      seed: this.seed,
      nodes: this.nodes.map(({ electionEpoch: _e, heartbeatEpoch: _h, ackSeq: _a, ...n }) => n),
      groups: this.groups,
      network: this.network,
      metrics: { ...this.metrics, latencyP50: percentile(0.5), latencyP95: percentile(0.95) },
      packets: this.packets,
      trace: this.trace,
      violations: this.violations,
      checked: this.checked,
      actionCount: this.actions.length,
      queue: this.queue
        .ordered()
        .filter((e) => this.active(e))
        .slice(0, 12)
        .map((e) => this.describe(e)),
      ...(this.lastEvent ? { lastEvent: this.lastEvent } : {}),
    });
  }
}
