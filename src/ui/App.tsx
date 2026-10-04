import { useEffect, useRef, useState } from 'react';
import {
  MAX_TIME,
  type Action,
  type NodeId,
  type NodeView,
  type Snapshot,
} from '../engine/types.ts';
import type { Request } from '../engine/bridge.ts';
import { Topology } from './Topology.tsx';
import { useSimulator } from './useSimulator.ts';
import { CausalPanel } from './CausalPanel.tsx';
import { NetworkMatrix } from './NetworkMatrix.tsx';

const time = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const roles = { leader: '领导者', follower: '跟随者', candidate: '候选者' };
const chapters = [
  {
    title: '一份共同的事实。',
    short: '共同的事实',
    label: 'A SHARED TRUTH',
    text: '选举已经完成。两个写入经过多数派确认，五个独立节点拥有相同的已提交状态。',
    question: '如果网络突然分裂，谁有权决定下一条事实？',
  },
  {
    title: '把世界切成两半。',
    short: '切开网络',
    label: 'THE FRACTURE',
    text: '旧领导者被留在两个节点的小岛上。另一侧的三个节点失去了心跳；选举尚未发生。',
    question: '网络断开，不会立即改变节点对自己的认知。',
  },
  {
    title: '两个领导者。一个困局。',
    short: '少数派的困局',
    label: 'THE FALSE PROMISE',
    text: '旧领导者接受了 red-route，只有两个副本。多数派选出了更高任期的领导者。旧提案始终无法提交。',
    question: '接受写入，并不意味着写入已经成为事实。',
  },
  {
    title: '多数派，继续前进。',
    short: '多数派继续',
    label: 'PROGRESS UNDER PRESSURE',
    text: '新领导者提出 blue-route。三个节点完成复制与提交，而另一侧仍然保留着未提交的 red-route。',
    question: '一致性没有要求每个节点此刻都拥有相同日志。',
  },
  {
    title: '重连之后，修复之前。',
    short: '重新连通',
    label: 'THE MOMENT BETWEEN',
    text: '链路恢复，虚拟时钟还没有前进。两个版本的日志同时存在。下一条协议消息，将开始消除分歧。',
    question: '在这里切换到自由实验，逐事件检查退位与日志修复。',
  },
  {
    title: '共同的事实，再次成立。',
    short: '日志收敛',
    label: 'ONE HISTORY REMAINS',
    text: '更高任期令旧领导者退位。未提交的冲突后缀被覆盖，blue-route 传播到全部五个状态机。',
    question: 'red-route 从未提交。已提交的历史完整保留。',
  },
];
const dropLabels = {
  'packet-loss': '随机丢包',
  'partition-on-send': '发送时跨分区',
  'receiver-offline': '接收节点离线',
  'partition-at-delivery': '投递时跨分区',
  'link-on-send': '发送时单向断链',
  'link-at-delivery': '在途消息遇到单向断链',
};
function Mark() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <path
        d="M18 3 33 12 29 29 11 33 3 17Z M18 3 18 18 33 12M18 18 29 29M18 18 11 33M18 18 3 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="18" cy="18" r="3" fill="currentColor" />
    </svg>
  );
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function facts(snapshot: Snapshot) {
  const red = snapshot.nodes.filter((n) => n.log.some((e) => e.value === 'red-route')).length;
  const blue = snapshot.nodes.filter((n) => n.stateMachine.route === 'blue-route').length;
  const same = snapshot.nodes.filter(
    (n) => JSON.stringify(n.log) === JSON.stringify(snapshot.nodes[0].log),
  ).length;
  return { red, blue, same };
}
function LatestProposal({ node }: { node: NodeView }) {
  const index = node.log.findLastIndex((entry) => entry.key !== null);
  if (index < 1) return null;
  const entry = node.log[index];
  return (
    <span className={`log-outcome ${index <= node.commitIndex ? 'applied' : 'waiting'}`}>
      <span>
        {entry.key} = <b>{entry.value}</b>
      </span>
      <small>{index <= node.commitIndex ? 'APPLIED' : 'PENDING'}</small>
    </span>
  );
}
export function App() {
  const { state, send, error, clearError } = useSimulator();
  const snapshot = state?.snapshot;
  const [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<NodeId>('N1');
  const [key, setKey] = useState('signal'),
    [value, setValue] = useState('hello, cluster');
  const [target, setTarget] = useState<NodeId | 'auto'>('auto');
  const [notice, setNotice] = useState(''),
    [seed, setSeed] = useState('7');
  const [chapter, setChapter] = useState<number | null>(0),
    [tour, setTour] = useState(false),
    [busy, setBusy] = useState(false);
  const [packetId, setPacketId] = useState<number | null>(null);
  const [packetFilter, setPacketFilter] = useState('all');
  const [entryDetail, setEntryDetail] = useState('点击日志格，查看条目的任期、值与提交状态。');
  const [baseline, setBaseline] = useState<Snapshot | null>(null);
  const [help, setHelp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    tickBusy = useRef(false);
  const leader = snapshot?.nodes
    .filter((n) => n.role === 'leader' && !n.crashed)
    .sort((a, b) => b.term - a.term)[0];
  const inspected = snapshot?.nodes.find((n) => n.id === selected);
  const filteredPackets =
    snapshot?.packets.filter(
      (p) =>
        packetFilter === 'all' ||
        (packetFilter === 'exception' && p.decision && p.decision.verdict !== 'accepted') ||
        (packetFilter === 'repair' && p.decision?.code === 'log-repaired'),
    ) ?? [];
  const packet = filteredPackets.find((p) => p.id === packetId) ?? filteredPackets.at(-1);
  const evidence = snapshot ? facts(snapshot) : null;
  const pending =
    snapshot?.nodes.reduce(
      (count, n) => count + n.log.slice(n.commitIndex + 1).filter((e) => e.key !== null).length,
      0,
    ) ?? 0;
  const changed =
    baseline && snapshot
      ? snapshot.nodes
          .filter((n, i) => JSON.stringify(n) !== JSON.stringify(baseline.nodes[i]))
          .map((n) => n.id)
      : [];
  useEffect(() => {
    if (error) {
      setRunning(false);
      setTour(false);
    }
  }, [error]);
  useEffect(() => {
    if (help) dialog.current?.showModal();
    else dialog.current?.close();
  }, [help]);
  useEffect(() => {
    if (!running) return;
    if ((snapshot?.now ?? 0) >= MAX_TIME) {
      setRunning(false);
      return;
    }
    const timer = setInterval(() => {
      if (tickBusy.current) return;
      tickBusy.current = true;
      send({
        type: 'act',
        action: { type: 'advance', ms: Math.min(100 * speed, MAX_TIME - (snapshot?.now ?? 0)) },
      })
        .catch(() => setRunning(false))
        .finally(() => {
          tickBusy.current = false;
        });
    }, 100);
    return () => clearInterval(timer);
  }, [running, speed, send, snapshot?.now]);
  useEffect(() => {
    if (!tour || chapter === null) return;
    if (chapter === 5) {
      setTour(false);
      return;
    }
    const timer = setTimeout(() => {
      void openChapter(chapter + 1);
    }, 3200);
    return () => clearTimeout(timer);
  }, [tour, chapter]);
  async function execute(request: Request) {
    clearError();
    try {
      const response = await send(request);
      if (response.result?.message) setNotice(response.result.message);
      return response;
    } catch (e) {
      setRunning(false);
      setTour(false);
      setNotice(e instanceof Error ? e.message : '操作失败。');
    }
  }
  function free() {
    setChapter(null);
    setTour(false);
    setPacketId(null);
  }
  function act(action: Action) {
    free();
    return execute({ type: 'act', action });
  }
  async function openChapter(index: number) {
    setRunning(false);
    setBusy(true);
    setNotice('');
    setPacketId(null);
    const response = await execute({ type: 'story', chapter: index });
    if (response) {
      setChapter(index);
      setSeed('7');
      setSelected(index >= 3 ? response.story!.newLeader : response.story!.oldLeader);
    }
    setBusy(false);
  }
  async function reset() {
    free();
    setRunning(false);
    setBaseline(null);
    await execute({ type: 'init', seed: Number(seed) });
  }
  async function preset(kind: string) {
    free();
    setRunning(false);
    if (kind === '少数派隔离') {
      await openChapter(2);
      setNotice('旧领导者在 2/5 少数派中，新领导者在 3/5 多数派中。');
      return;
    }
    const response = await execute({ type: 'init', seed: Number(seed) });
    if (!response) return;
    const primary = response.snapshot.nodes.find((n) => n.role === 'leader');
    if (!primary) return;
    setSelected(primary.id);
    await act({ type: 'crash', node: primary.id });
    await act({ type: 'advance', ms: 2000 });
    setNotice(`${primary.id} 已离线，新任期完成选举。`);
  }
  async function exportExperiment() {
    setRunning(false);
    setTour(false);
    const response = await execute({ type: 'export' });
    if (response?.document) {
      download(
        JSON.stringify(response.document, null, 2),
        `quorum-seed-${response.document.seed}.json`,
      );
      setNotice('实验已导出。包含随机种子和全部操作，可精确重放。');
    }
  }
  async function importExperiment(file?: File) {
    if (!file) return;
    free();
    setRunning(false);
    if (file.size > 2_000_000) {
      setNotice('实验文件最多 2 MB。');
      return;
    }
    const response = await execute({ type: 'load', text: await file.text() });
    if (response) {
      setSeed(String(response.snapshot.seed));
      setNotice('实验已恢复。拖动回放滑块查看历史。');
    }
  }
  return (
    <>
      <header className="site-header">
        <a className="brand" href="./" aria-label="Quorum Lab 首页">
          <Mark />
          <span>
            quorum<span className="brand-light"> / lab</span>
            <small>THE CONSENSUS OBSERVATORY</small>
          </span>
        </a>
        <nav aria-label="主导航">
          <a className="nav-active" href="#observatory">
            观测台 <sup>01</sup>
          </a>
          <a href="#workbench">
            协议工作台 <sup>02</sup>
          </a>
          <button onClick={() => setHelp(true)}>协议说明 ↗</button>
        </nav>
        <a
          className="source-link"
          href="https://github.com/qiyuhuating/quorum-lab"
          target="_blank"
          rel="noreferrer"
        >
          SOURCE CODE ↗
        </a>
        <span className="version">v0.3</span>
      </header>
      <main>
        <section className="intro">
          <div>
            <span className="eyebrow">AN EXECUTABLE EXHIBIT / DISTRIBUTED SYSTEMS</span>
            <h1>
              共识，<em>承压。</em>
              <span className="intro-english">
                CONSENSUS
                <br />
                UNDER PRESSURE.
              </span>
            </h1>
          </div>
          <div className="intro-note">
            <span className="mini-index">FIVE NODES. ONE HISTORY.</span>
            <p>
              亲手切开网络。
              <br />
              看一份共同的事实，如何穿过分歧。
            </p>
            <span className="local-mark">
              <i /> 真协议 · 虚拟网络 · 浏览器内运行
            </span>
          </div>
        </section>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button aria-label="关闭提示" onClick={() => setNotice('')}>
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!snapshot ? (
          <div className="loading">正在启动五个独立节点…</div>
        ) : (
          <>
            <section id="observatory" className="observatory" aria-label="共识观测台">
              <div className="field">
                <div className="field-heading">
                  <span>
                    <i className={running ? 'status-light active' : 'status-light'} />{' '}
                    {chapter === null ? 'LIVE EXPERIMENT' : 'THE PARTITION EXPERIMENT'}
                  </span>
                  <span
                    className={`field-status ${snapshot.groups.length > 1 || snapshot.links.length ? 'fractured' : ''}`}
                  >
                    {snapshot.groups.length > 1
                      ? 'NETWORK PARTITIONED'
                      : snapshot.links.length
                        ? `${snapshot.links.length} DIRECTED LINKS CUT`
                        : 'NETWORK CONNECTED'}
                  </span>
                </div>
                <Topology snapshot={snapshot} selected={selected} onSelect={setSelected} />
                <div className="field-readout">
                  <div>
                    <span>CURRENT TERM</span>
                    <strong data-testid="term">
                      {Math.max(...snapshot.nodes.map((n) => n.term))}
                    </strong>
                  </div>
                  <div>
                    <span>COMMITTED WRITES</span>
                    <strong data-testid="committed">
                      {String(snapshot.metrics.committed).padStart(2, '0')}
                    </strong>
                  </div>
                  <div>
                    <span>PENDING REPLICAS</span>
                    <strong className={pending ? 'orange' : ''}>
                      {pending.toString().padStart(2, '0')}
                    </strong>
                  </div>
                  <div>
                    <span>VIRTUAL TIME</span>
                    <strong data-testid="clock">{time(snapshot.now)}</strong>
                  </div>
                </div>
                <div className="playback">
                  <div className="playback-buttons">
                    <button
                      className="play-button"
                      aria-label={running ? '暂停实验' : '运行实验'}
                      disabled={snapshot.now >= MAX_TIME || busy}
                      onClick={() => {
                        free();
                        setRunning(!running);
                      }}
                    >
                      {running ? 'Ⅱ 暂停' : '▶ 运行'}
                    </button>
                    <button
                      aria-label="推进下一个协议事件"
                      disabled={!snapshot.queue.length || snapshot.now >= MAX_TIME || busy}
                      onClick={() => {
                        setRunning(false);
                        void act({ type: 'step' });
                      }}
                    >
                      ↦ 下一事件
                    </button>
                    <button
                      aria-label="单步推进100毫秒"
                      title="推进 100ms"
                      disabled={snapshot.now >= MAX_TIME || busy}
                      onClick={() => {
                        setRunning(false);
                        void act({ type: 'advance', ms: 100 });
                      }}
                    >
                      +100ms
                    </button>
                    <select
                      aria-label="运行速度"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    >
                      <option value="1">1×</option>
                      <option value="2">2×</option>
                      <option value="5">5×</option>
                    </select>
                  </div>
                  <span className="next-event">
                    NEXT{' '}
                    {snapshot.queue[0]
                      ? `${time(snapshot.queue[0].at)} / ${snapshot.queue[0].kind ?? snapshot.queue[0].type}`
                      : '—'}
                  </span>
                </div>
                <div className="log-matrix">
                  <div className="matrix-heading">
                    <h2>
                      五份日志，<span>此刻的分歧。</span>
                    </h2>
                    <span>
                      <i className="commit-dot" /> 已提交 <i className="pending-dot" /> 待提交
                    </span>
                  </div>
                  <div className="log-scroll">
                    <table className="log-table">
                      <thead>
                        <tr>
                          <th>NODE / TERM</th>
                          <th>LOG INDEX →</th>
                          <th>COMMIT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.nodes.map((n) => (
                          <tr key={n.id} className={selected === n.id ? 'selected-row' : ''}>
                            <td>
                              <button
                                className={`log-node ${n.role}`}
                                onClick={() => setSelected(n.id)}
                              >
                                {n.id}
                                <small>T{n.term}</small>
                              </button>
                            </td>
                            <td>
                              <div className="entry-list">
                                {n.log.length <= 1 ? (
                                  <span className="empty-log">∅</span>
                                ) : (
                                  n.log.slice(1).map((entry, i) => (
                                    <button
                                      key={`${i}-${entry.id}`}
                                      className={`entry ${i + 1 <= n.commitIndex ? 'committed' : 'pending'} ${entry.key === null ? 'noop' : ''}`}
                                      title={`#${i + 1} · T${entry.term} · ${entry.key === null ? 'no-op' : `${entry.key}=${entry.value}`}`}
                                      aria-label={`${n.id} 日志索引 ${i + 1}，任期 ${entry.term}，${i + 1 <= n.commitIndex ? '已提交' : '待提交'}`}
                                      onClick={() =>
                                        setEntryDetail(
                                          `${n.id} / #${i + 1} / TERM ${entry.term} / ${entry.key === null ? 'no-op' : `${entry.key} = ${entry.value}`} / ${i + 1 <= n.commitIndex ? '已提交' : '待提交'}`,
                                        )
                                      }
                                    >
                                      {i + 1}
                                      <sup>{entry.key === null ? '·' : `T${entry.term}`}</sup>
                                    </button>
                                  ))
                                )}
                                <LatestProposal node={n} />
                              </div>
                            </td>
                            <td className="commit-index">{n.commitIndex}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="entry-detail" data-testid="entry-detail">
                    {entryDetail}
                  </div>
                </div>
              </div>
              <aside className="story-panel">
                <div className="story-heading">
                  <span className="eyebrow">GUIDED EXPERIMENT</span>
                  <button
                    onClick={async () => {
                      if (tour) setTour(false);
                      else {
                        await openChapter(0);
                        setTour(true);
                      }
                    }}
                    disabled={busy}
                  >
                    {tour ? 'Ⅱ 停止导览' : '▶ 自动导览'}
                  </button>
                </div>
                <div className="chapter-count">
                  {chapter === null ? '↗' : String(chapter + 1).padStart(2, '0')}
                  <span>/ 06</span>
                </div>
                <span className="chapter-label">
                  {chapter === null ? 'YOUR OWN EXPERIMENT' : chapters[chapter].label}
                </span>
                <h2>{chapter === null ? '现在，由你打破它。' : chapters[chapter].title}</h2>
                <p className="chapter-text">
                  {chapter === null
                    ? '停止节点、修改链路、向旧领导者写入。每次操作都会从当前状态建立新的历史分支。'
                    : chapters[chapter].text}
                </p>
                <div className="chapter-proof" data-testid="chapter-proof">
                  <span>LIVE EVIDENCE / 实时证据</span>
                  <div>
                    <b>{evidence!.red}/5</b>
                    <span>含 red-route 的日志</span>
                  </div>
                  <div>
                    <b>{evidence!.blue}/5</b>
                    <span>已应用 blue-route</span>
                  </div>
                  <div>
                    <b>{evidence!.same}/5</b>
                    <span>与 N1 日志完全相同</span>
                  </div>
                </div>
                <p className="chapter-insight">
                  {chapter === null
                    ? '下面的协议工作台可以检查每条 RPC 与下一事件。'
                    : chapters[chapter].question}
                </p>
                <ol className="chapter-list">
                  {chapters.map((c, i) => (
                    <li key={c.label}>
                      <button
                        aria-label={`章节 ${i + 1} ${c.short}`}
                        aria-current={chapter === i ? 'step' : undefined}
                        disabled={busy}
                        onClick={() => {
                          setTour(false);
                          void openChapter(i);
                        }}
                      >
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        {c.short}
                        <b>{chapter === i ? '●' : '↗'}</b>
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="story-footer">
                  <button
                    onClick={() => {
                      free();
                      setRunning(false);
                    }}
                    disabled={chapter === null}
                  >
                    从这里自由实验 ↗
                  </button>
                  <span>SEED 7 / DETERMINISTIC</span>
                </div>
              </aside>
            </section>
            <section className="history-strip" aria-label="实验回放与分支">
              <div className="history-caption">
                <span className="eyebrow">TIME IS A DEBUGGING TOOL</span>
                <strong>回到过去，改变下一步。</strong>
              </div>
              <div className="history">
                <label htmlFor="history">
                  操作回放{' '}
                  <span>
                    {snapshot.actionCount} / {state.historyLength}
                  </span>
                </label>
                <input
                  id="history"
                  aria-label="操作回放"
                  type="range"
                  min="0"
                  max={Math.max(1, state.historyLength)}
                  value={snapshot.actionCount}
                  onChange={(e) => {
                    free();
                    setRunning(false);
                    void execute({ type: 'seek', cursor: Number(e.target.value) });
                  }}
                />
                <small>新操作会从当前游标建立分支。</small>
              </div>
              <div className="experiment-tools">
                <label>
                  SEED{' '}
                  <input
                    aria-label="随机种子"
                    type="number"
                    min="0"
                    max="4294967295"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </label>
                <button onClick={reset}>↺ 重置</button>
                <button onClick={exportExperiment}>↓ 导出实验</button>
                <button onClick={() => fileInput.current?.click()}>↑ 导入</button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  aria-label="导入实验文件"
                  onChange={(e) => {
                    void importExperiment(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            </section>
            <section id="workbench" className="workbench">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">02 / LOOK BENEATH THE SURFACE</span>
                  <h2>协议，不再是黑箱。</h2>
                </div>
                <p>
                  消息、节点状态与安全检查。
                  <br />
                  每一项证据都来自正在运行的模拟器。
                </p>
              </div>
              <div className="causal-workbench">
                <CausalPanel
                  effect={snapshot.lastEffect}
                  packet={packetId === null ? undefined : packet}
                />
                <NetworkMatrix snapshot={snapshot} onAction={act} />
              </div>
              <div className="workbench-grid">
                <section className="rpc-panel panel">
                  <div className="panel-heading">
                    <h3>
                      线上消息 <small>RPC FORENSICS</small>
                    </h3>
                    <span>LAST 128</span>
                  </div>
                  <div className="transport-stats">
                    <span>
                      DELIVERED <b>{snapshot.metrics.delivered}</b>
                    </span>
                    <span>
                      DROPPED <b>{snapshot.metrics.dropped}</b>
                    </span>
                    <span>
                      COMMIT P95 <b>{snapshot.metrics.latencyP95}ms</b>
                    </span>
                  </div>
                  <div className="packet-filters" role="group" aria-label="消息筛选">
                    {[
                      ['all', '全部消息'],
                      ['exception', '拒绝与忽略'],
                      ['repair', '冲突修复'],
                    ].map(([filter, label]) => (
                      <button
                        key={filter}
                        aria-pressed={packetFilter === filter}
                        onClick={() => {
                          setPacketFilter(filter);
                          setPacketId(null);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="rpc-body">
                    <div className="packet-list" aria-label="协议消息列表">
                      {filteredPackets
                        .slice(-16)
                        .reverse()
                        .map((p) => (
                          <button
                            key={p.id}
                            className={`${packet?.id === p.id ? 'selected' : ''} ${p.status}`}
                            onClick={() => {
                              setPacketId(p.id);
                              setRunning(false);
                              setTour(false);
                            }}
                            aria-label={`检查消息 ${p.id} ${p.kind} ${p.from} 到 ${p.to}`}
                          >
                            <span>#{p.id}</span>
                            <b>
                              {p.from} → {p.to}
                            </b>
                            <small>
                              {p.kind}
                              {p.decision?.verdict === 'rejected'
                                ? ' / 拒绝'
                                : p.decision?.code === 'log-repaired'
                                  ? ' / 修复'
                                  : ''}
                            </small>
                            <i />
                          </button>
                        ))}
                      {!filteredPackets.length && (
                        <p className="packet-empty">
                          最近 128 条消息中
                          <br />
                          暂无匹配记录。
                        </p>
                      )}
                    </div>
                    <div className="packet-detail">
                      {packet && (
                        <>
                          <div className="packet-title">
                            <strong>
                              {packet.payload.kind === 'append'
                                ? 'AppendEntries'
                                : packet.payload.kind === 'vote'
                                  ? 'RequestVote'
                                  : packet.payload.kind === 'voted'
                                    ? 'VoteResponse'
                                    : 'AppendResponse'}
                            </strong>
                            <span className={packet.status}>{packet.status}</span>
                          </div>
                          <div className="packet-route">
                            {packet.from} → {packet.to}
                            <span>TERM {packet.payload.term}</span>
                          </div>
                          <p>
                            {time(packet.sentAt)} → {time(packet.deliverAt)}
                            {packet.dropReason && ` / ${dropLabels[packet.dropReason]}`}
                          </p>
                          {packet.decision && (
                            <p className="packet-decision">{packet.decision.title}</p>
                          )}
                          <pre data-testid="rpc-payload">
                            {JSON.stringify(packet.payload, null, 2)}
                          </pre>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="queue">
                    <h4>
                      NEXT EVENTS <span>按时间与序号稳定排序</span>
                    </h4>
                    {snapshot.queue.slice(0, 4).map((event, i) => (
                      <div key={event.seq} className={i === 0 ? 'next' : ''}>
                        <time>{time(event.at)}</time>
                        <span>{event.kind ?? event.type}</span>
                        <b>{event.node ?? `${event.from} → ${event.to}`}</b>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel inspector-panel">
                  <div className="panel-heading">
                    <h3>
                      节点透视 <small>NODE INSPECTOR</small>
                    </h3>
                    <strong>{selected}</strong>
                  </div>
                  <div className="node-selector" role="group" aria-label="选择故障目标">
                    {snapshot.nodes.map((n) => (
                      <button
                        key={n.id}
                        className={n.id === selected ? 'chosen' : ''}
                        onClick={() => setSelected(n.id)}
                      >
                        {n.id}
                        {n.crashed ? ' ×' : ''}
                      </button>
                    ))}
                  </div>
                  {inspected && (
                    <>
                      <dl>
                        <div>
                          <dt>角色 / ROLE</dt>
                          <dd>{inspected.crashed ? '离线' : roles[inspected.role]}</dd>
                        </div>
                        <div>
                          <dt>任期 / TERM</dt>
                          <dd>{inspected.term}</dd>
                        </div>
                        <div>
                          <dt>投票 / VOTE</dt>
                          <dd>{inspected.votedFor ?? '—'}</dd>
                        </div>
                        <div>
                          <dt>COMMIT / APPLIED</dt>
                          <dd>
                            {inspected.commitIndex} / {inspected.lastApplied}
                          </dd>
                        </div>
                      </dl>
                      <h4>STATE MACHINE / 已提交状态</h4>
                      <pre data-testid="state-machine">
                        {JSON.stringify(inspected.stateMachine, null, 2)}
                      </pre>
                      {inspected.role === 'leader' && (
                        <div className="replication-progress">
                          {Object.entries(inspected.matchIndex).map(([id, index]) => (
                            <div key={id}>
                              <span>{id}</span>
                              <meter
                                aria-label={`${id} 匹配索引`}
                                min="0"
                                max={Math.max(1, inspected.log.length - 1)}
                                value={index}
                              />
                              <b>{index}</b>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="baseline">
                    <button
                      onClick={() => setBaseline(baseline ? null : structuredClone(snapshot))}
                    >
                      {baseline ? '× 清除对照' : '◎ 固定当前状态作对照'}
                    </button>
                    {baseline && (
                      <p data-testid="comparison">
                        对照 {time(baseline.now)} → {time(snapshot.now)}
                        <br />
                        节点内部状态改变：{changed.length ? changed.join('、') : '无'}
                        <br />
                        提交写入变化：{snapshot.metrics.committed - baseline.metrics.committed}
                      </p>
                    )}
                  </div>
                </section>
                <section className="panel controls-panel">
                  <div className="panel-heading">
                    <h3>
                      改变条件 <small>FAULT INJECTION</small>
                    </h3>
                    <span>↗</span>
                  </div>
                  <div className="fault-actions">
                    <button
                      className="crash-button"
                      onClick={() =>
                        act({ type: inspected?.crashed ? 'recover' : 'crash', node: selected })
                      }
                    >
                      {inspected?.crashed ? '↺ 恢复节点' : '⊗ 停止节点'} {selected}
                    </button>
                    <button
                      onClick={() => {
                        const peers = snapshot.nodes
                          .map((n) => n.id)
                          .filter((id) => id !== selected);
                        void act({
                          type: 'partition',
                          groups: [[selected, peers[0]], peers.slice(1)],
                        });
                      }}
                    >
                      分区 2│3
                    </button>
                  </div>
                  <button
                    className="heal-button"
                    disabled={snapshot.groups.length === 1 && snapshot.links.length === 0}
                    onClick={() => act({ type: 'heal' })}
                  >
                    ⤨ 恢复全部链路
                  </button>
                  <label className="slider-label" htmlFor="latency">
                    消息延迟 <strong>{snapshot.network.latency} ms ±50%</strong>
                  </label>
                  <input
                    id="latency"
                    type="range"
                    min="10"
                    max="200"
                    step="5"
                    value={snapshot.network.latency}
                    onChange={(e) =>
                      act({
                        type: 'network',
                        latency: Number(e.target.value),
                        loss: snapshot.network.loss,
                      })
                    }
                  />
                  <label className="slider-label" htmlFor="loss">
                    随机丢包 <strong>{Math.round(snapshot.network.loss * 100)}%</strong>
                  </label>
                  <input
                    id="loss"
                    type="range"
                    min="0"
                    max="75"
                    step="5"
                    value={snapshot.network.loss * 100}
                    onChange={(e) =>
                      act({
                        type: 'network',
                        loss: Number(e.target.value) / 100,
                        latency: snapshot.network.latency,
                      })
                    }
                  />
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const node = target === 'auto' ? leader?.id : target;
                      if (node) void act({ type: 'write', node, key, value });
                      else setNotice('当前没有活跃领导者。运行实验以等待选举。');
                    }}
                  >
                    <h4>CLIENT PROPOSAL / 真实写入</h4>
                    <label>
                      目标节点
                      <select
                        aria-label="写入目标"
                        value={target}
                        onChange={(e) => setTarget(e.target.value as NodeId | 'auto')}
                      >
                        <option value="auto">最高任期领导者 {leader?.id ?? '等待选举'}</option>
                        {snapshot.nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.id} · {n.crashed ? '离线' : roles[n.role]} · T{n.term}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="key-value">
                      <label>
                        KEY
                        <input
                          aria-label="写入键名"
                          value={key}
                          onChange={(e) => setKey(e.target.value)}
                          required
                          maxLength={24}
                          pattern="[a-zA-Z][a-zA-Z0-9_-]{0,23}"
                        />
                      </label>
                      <label>
                        VALUE
                        <input
                          aria-label="写入值"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          maxLength={80}
                        />
                      </label>
                    </div>
                    <button className="submit-write" type="submit">
                      提交提案 <span>↗</span>
                    </button>
                    <p>接受后仍需三个副本确认，才可提交。</p>
                  </form>
                  <details className="presets">
                    <summary>更多故障实验</summary>
                    <button onClick={() => preset('少数派隔离')}>少数派隔离 · 两个领导者</button>
                    <button onClick={() => preset('领导者故障')}>领导者故障 · 权力交接</button>
                  </details>
                </section>
              </div>
              <div className={`safety-bar ${snapshot.violations.length ? 'unsafe' : ''}`}>
                <span className="safety-symbol">{snapshot.violations.length ? '!' : '✓'}</span>
                <strong>运行时安全不变量</strong>
                <span>选举唯一性 · 领导者完整性 · 日志匹配 · 状态机安全 · 提交前缀保护</span>
                <b data-testid="safety">
                  {snapshot.checked.toLocaleString()} 次检查 / {snapshot.violations.length}{' '}
                  violations
                </b>
              </div>
              <details className="trace-panel">
                <summary>
                  协议事件流 <span>{snapshot.trace.length} RECENT EVENTS ↓</span>
                </summary>
                <div className="trace-list" tabIndex={0} aria-label="协议事件流">
                  {snapshot.trace
                    .slice(-40)
                    .reverse()
                    .map((event, i) => (
                      <div className={`trace-row trace-${event.kind}`} key={`${snapshot.now}-${i}`}>
                        <time>{time(event.at)}</time>
                        <b>{event.kind.toUpperCase()}</b>
                        <span>{event.text}</span>
                      </div>
                    ))}
                </div>
              </details>
            </section>
          </>
        )}
        <footer>
          <span>
            <Mark /> QUORUM LAB <b>© 2026</b>
          </span>
          <p>
            五个独立节点。一个可复现的世界。
            <br />
            <small>固定成员 Raft 模型 · 模拟稳定存储 · 非生产存储系统</small>
          </p>
          <a href="https://raft.github.io/raft.pdf" target="_blank" rel="noreferrer">
            READ THE PAPER ↗
          </a>
        </footer>
      </main>
      <dialog
        ref={dialog}
        className="help-dialog"
        onCancel={() => setHelp(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setHelp(false);
        }}
      >
        <button className="dialog-close" aria-label="关闭协议说明" onClick={() => setHelp(false)}>
          ×
        </button>
        <span className="eyebrow">THE RULES OF CONSENSUS</span>
        <h2>多数派，是一致性的支点。</h2>
        <p>
          领导者把写入复制给其他节点。至少三个节点确认后，它才能提交当前任期的条目，并通知跟随者应用日志。
        </p>
        <h3>分区时为什么会有两个领导者？</h3>
        <p>
          少数派中的旧领导者还没获知新任期，可能仍自认为是领导者。它能接受提案，却无法收集多数派确认。不同任期的领导者可以同时存在；同一任期最多只能选出一个。
        </p>
        <h3>恢复时如何修复日志？</h3>
        <p>
          跟随者核对前一条日志的索引和任期。领导者回退复制位置，找到共同前缀，覆盖尚未提交的冲突后缀。已提交的前缀不能被截断。
        </p>
        <h3>怎样逐事件调试？</h3>
        <p>
          下一事件执行一个仍有效的消息或定时器事件，跳过失效的定时器。下方工作台显示实际 RPC
          载荷与投递状态。固定对照后回退历史，再操作，即可观察分支状态变化。
        </p>
        <h3>怎样复现实验？</h3>
        <p>
          导出文件保存随机种子与操作序列。所有计时、消息延迟与丢包使用虚拟时钟与固定随机数生成器。导入后得到相同状态。导览是种子
          7 的一个完整实验，游标回退时导出保留原始未来；新的操作会建立分支。
        </p>
        <p className="help-boundary">
          模拟五节点基本 Raft 与对称分区。磁盘
          IO、成员变更、快照压缩和线性一致读尚未实现。绿色检查为运行时检测证据，非形式化证明。
        </p>
        <a href="https://raft.github.io/raft.pdf" target="_blank" rel="noreferrer">
          Ongaro & Ousterhout · Raft paper ↗
        </a>
      </dialog>
    </>
  );
}
