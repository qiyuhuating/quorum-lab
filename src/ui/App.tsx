import { useEffect, useRef, useState } from 'react';
import { MAX_TIME, type Action, type NodeId } from '../engine/types.ts';
import type { Request } from '../engine/bridge.ts';
import { Topology } from './Topology.tsx';
import { useSimulator } from './useSimulator.ts';

const termColor = (term: number) =>
  ['#516779', '#ccff6b', '#9b8cf3', '#75bdd1', '#f0b56c', '#e987ae'][term % 6];
const time = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const roleLabel = { leader: '领导者', follower: '跟随者', candidate: '候选者' };
function Mark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="m24 5 18 13-7 21H13L6 18Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M24 5v19M6 18l18 6 11 15M13 39l11-15 18-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="24" cy="24" r="4" fill="currentColor" />
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

export function App() {
  const { state, send, error, clearError } = useSimulator();
  const snapshot = state?.snapshot;
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<NodeId>('N1');
  const [key, setKey] = useState('signal');
  const [value, setValue] = useState('hello, cluster');
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState(false);
  const [scenario, setScenario] = useState('自由实验');
  const [seed, setSeed] = useState('7');
  const fileInput = useRef<HTMLInputElement>(null);
  const tickBusy = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const leader = snapshot?.nodes
    .filter((n) => n.role === 'leader' && !n.crashed)
    .sort((a, b) => b.term - a.term)[0];
  const inspected = snapshot?.nodes.find((n) => n.id === selected);
  const [target, setTarget] = useState<NodeId | 'auto'>('auto');

  useEffect(() => {
    if (error) setRunning(false);
  }, [error]);
  useEffect(() => {
    if (help) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [help]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (tickBusy.current) return;
      tickBusy.current = true;
      send({ type: 'act', action: { type: 'advance', ms: 100 * speed } })
        .catch(() => setRunning(false))
        .finally(() => {
          tickBusy.current = false;
        });
    }, 100);
    return () => clearInterval(timer);
  }, [running, speed, send]);

  async function execute(request: Request) {
    clearError();
    try {
      const response = await send(request);
      if (response.result?.message) setNotice(response.result.message);
      return response;
    } catch (e) {
      setRunning(false);
      setNotice(e instanceof Error ? e.message : '操作失败。');
    }
  }
  function act(action: Action) {
    return execute({ type: 'act', action });
  }
  async function exportExperiment() {
    setRunning(false);
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
    setRunning(false);
    if (file.size > 2_000_000) {
      setNotice('实验文件最多 2 MB。');
      return;
    }
    const response = await execute({ type: 'load', text: await file.text() });
    if (response) {
      setScenario('导入实验');
      setSeed(String(response.snapshot.seed));
      setNotice('实验已恢复至最终状态。拖动回放滑块查看历史。');
    }
  }
  async function preset(kind: string) {
    setRunning(false);
    setNotice('');
    setTarget('auto');
    const base = await execute({ type: 'init', seed: Number(seed) });
    if (!base) return;
    const primary = base.snapshot.nodes.find((n) => n.role === 'leader')!;
    setSelected(primary.id);
    setScenario(kind);
    if (kind === '少数派隔离') {
      const peers = base.snapshot.nodes.map((n) => n.id).filter((id) => id !== primary.id);
      await act({ type: 'partition', groups: [[primary.id, peers[0]], peers.slice(1)] });
      await act({ type: 'write', node: primary.id, key: 'signal', value: 'minority-pending' });
      await act({ type: 'advance', ms: 2000 });
      setNotice('旧领导者在 2/5 少数派中；新领导者在 3/5 多数派中。可向两者分别写入。');
    } else if (kind === '领导者故障') {
      await act({ type: 'crash', node: primary.id });
      await act({ type: 'advance', ms: 2000 });
      setNotice(`${primary.id} 已离线，新任期完成选举。恢复它以观察日志追赶。`);
    } else setNotice('已建立五节点集群，两个示例写入由真实协议完成提交。');
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="./" aria-label="Quorum Lab 首页">
          <span className="brand-mark">
            <Mark />
          </span>
          <span>
            quorum<span className="brand-light"> / lab</span>
            <small>DISTRIBUTED SYSTEMS PLAYGROUND</small>
          </span>
        </a>
        <nav aria-label="主导航">
          <span className="nav-active">
            实验台 <b>01</b>
          </span>
          <button onClick={() => setHelp(true)}>协议说明 ↗</button>
          <a href="https://github.com/qiyuhuating" target="_blank" rel="noreferrer">
            祈雨 / GitHub ↗
          </a>
        </nav>
        <div className="header-status">
          <i /> LOCAL SIMULATION <span>v0.1</span>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="tiny-square" /> FAULTS ARE INEVITABLE. CONSENSUS IS ENGINEERED.
            </div>
            <h1>
              让网络失联。
              <br />
              <em>让共识发生。</em>
              <span className="title-dot">↗</span>
            </h1>
            <p>
              亲手打断一个分布式系统，观察它如何保持一致。
              <br className="mobile-break" />
              五个节点，一份日志，无数种故障。
            </p>
          </div>
          <div className="intro-index">
            <span>INTERACTIVE EXPERIMENT</span>
            <strong>
              Raft<span> / 05 NODES</span>
            </strong>
            <div>
              确定性调度 <b>·</b> 故障注入 <b>·</b> 精确回放
            </div>
          </div>
        </section>
        <div className="experiment-bar">
          <div className="experiment-name">
            <i className={running ? 'live' : ''} />
            <strong>{running ? '实验运行中' : '实验已暂停'}</strong>
            <span>{scenario}</span>
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
            <button onClick={() => preset('自由实验')} disabled={!snapshot}>
              ↺ 重置
            </button>
            <button onClick={exportExperiment} disabled={!snapshot}>
              ↓ 导出实验
            </button>
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
        </div>
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
          <div className="loading">正在启动确定性模拟器…</div>
        ) : (
          <>
            <section className="metrics" aria-label="实时指标">
              <div>
                <span>
                  当前任期 <small>CURRENT TERM</small>
                </span>
                <strong data-testid="term">
                  {Math.max(...snapshot.nodes.map((n) => n.term))}
                  <em>epoch</em>
                </strong>
              </div>
              <div>
                <span>
                  已提交写入 <small>COMMITTED WRITES</small>
                </span>
                <strong>
                  <span data-testid="committed">
                    {String(snapshot.metrics.committed).padStart(2, '0')}
                  </span>
                  <em>/ {snapshot.metrics.accepted} accepted</em>
                </strong>
              </div>
              <div>
                <span>
                  提交延迟 <small>VIRTUAL P95</small>
                </span>
                <strong>
                  {snapshot.metrics.latencyP95}
                  <em>ms</em>
                </strong>
              </div>
              <div>
                <span>
                  消息投递 <small>DELIVERED / SENT</small>
                </span>
                <strong>
                  {snapshot.metrics.delivered}
                  <em>/ {snapshot.metrics.sent}</em>
                </strong>
                <span className="dropped">{snapshot.metrics.dropped} dropped</span>
              </div>
            </section>
            <div className="lab-grid">
              <div className="workspace">
                <section className="panel map-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-number">01</span>
                      <h2>
                        集群拓扑 <small>CLUSTER TOPOLOGY</small>
                      </h2>
                    </div>
                    <span className="panel-tag">
                      {snapshot.groups.length === 1 ? 'CONNECTED' : 'PARTITIONED'}
                    </span>
                  </div>
                  <div className="map-legend">
                    <span>
                      <i className="lime" />
                      领导者
                    </span>
                    <span>
                      <i className="blue" />
                      跟随者
                    </span>
                    <span>
                      <i className="purple" />
                      候选者
                    </span>
                    <span>
                      <i className="gray" />
                      离线
                    </span>
                    <span className="legend-hint">点击节点查看状态</span>
                  </div>
                  <Topology snapshot={snapshot} selected={selected} onSelect={setSelected} />
                  <div className="playback">
                    <div className="playback-buttons">
                      <button
                        className="play-button"
                        onClick={() => setRunning(!running)}
                        disabled={snapshot.now >= MAX_TIME}
                        aria-label={running ? '暂停实验' : '运行实验'}
                      >
                        {running ? 'Ⅱ' : '▶'}
                        <span>{running ? '暂停' : '运行'}</span>
                      </button>
                      <button
                        aria-label="单步推进100毫秒"
                        title="推进 100ms"
                        onClick={() => {
                          setRunning(false);
                          void act({ type: 'advance', ms: 100 });
                        }}
                        disabled={snapshot.now >= MAX_TIME}
                      >
                        ↦ 单步
                      </button>
                      <select
                        aria-label="运行速度"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                      >
                        <option value="1">1× 速度</option>
                        <option value="2">2× 速度</option>
                        <option value="5">5× 速度</option>
                      </select>
                    </div>
                    <div className="virtual-clock">
                      <span>VIRTUAL TIME</span>
                      <strong data-testid="clock">{time(snapshot.now)}</strong>
                    </div>
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
                        setRunning(false);
                        void execute({ type: 'seek', cursor: Number(e.target.value) });
                      }}
                    />
                    <small>回到任意操作；新的操作将从此处分支。</small>
                  </div>
                </section>
                <section className="panel logs-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-number">02</span>
                      <h2>
                        复制日志 <small>REPLICATED LOG</small>
                      </h2>
                    </div>
                    <div className="log-legend">
                      <span className="committed-dot" /> 已提交 <span className="pending-dot" />{' '}
                      待提交
                    </div>
                  </div>
                  <div className="log-scroll">
                    <table className="log-table">
                      <thead>
                        <tr>
                          <th>NODE / TERM</th>
                          <th>
                            ENTRIES <span>颜色表示任期 · 虚线表示待提交</span>
                          </th>
                          <th>COMMIT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.nodes.map((n) => (
                          <tr key={n.id} className={n.id === selected ? 'selected-row' : ''}>
                            <td>
                              <button
                                onClick={() => setSelected(n.id)}
                                className={`log-node ${n.crashed ? 'offline' : n.role}`}
                              >
                                <i />
                                {n.id}
                                <small>T{n.term}</small>
                              </button>
                            </td>
                            <td>
                              <div className="entry-list">
                                {n.log.length <= 1 && (
                                  <span className="empty-log">∅ empty log</span>
                                )}
                                {n.log.slice(1).map((entry, i) => (
                                  <button
                                    key={`${i}-${entry.id}`}
                                    className={`entry ${i + 1 <= n.commitIndex ? 'committed' : 'pending'} ${entry.key === null ? 'noop' : ''}`}
                                    style={
                                      {
                                        '--entry-color': termColor(entry.term),
                                      } as React.CSSProperties
                                    }
                                    title={`#${i + 1} · term ${entry.term} · ${entry.key === null ? 'no-op' : `${entry.key}=${entry.value}`} · ${i + 1 <= n.commitIndex ? 'committed' : 'pending'}`}
                                    aria-label={`${n.id} 日志索引 ${i + 1}，任期 ${entry.term}，${i + 1 <= n.commitIndex ? '已提交' : '待提交'}`}
                                    onClick={() =>
                                      setNotice(
                                        `索引 ${i + 1} / 任期 ${entry.term} / ${entry.key === null ? '领导者 no-op' : `${entry.key} = ${entry.value}`} / ${i + 1 <= n.commitIndex ? '已提交' : '待提交'}`,
                                      )
                                    }
                                  >
                                    {i + 1}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="commit-index">{n.commitIndex}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="panel-footnote">
                    NO-OP 条目用于安全提交旧任期日志。<span>LOG INDEX STARTS AT 1</span>
                  </div>
                </section>
                <section className="panel trace-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-number">03</span>
                      <h2>
                        事件流 <small>PROTOCOL TRACE</small>
                      </h2>
                    </div>
                    <span className="panel-tag">LATEST 24</span>
                  </div>
                  <div className="trace-list" tabIndex={0} aria-label="协议事件流">
                    {snapshot.trace
                      .slice(-24)
                      .reverse()
                      .map((event, i) => (
                        <div
                          className={`trace-row trace-${event.kind}`}
                          key={`${snapshot.trace.length}-${i}`}
                        >
                          <time>{time(event.at)}</time>
                          <span className="event-kind">{event.kind.toUpperCase()}</span>
                          <span>{event.text}</span>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
              <aside className="control-column">
                <section className="panel scenario-panel">
                  <div className="panel-heading">
                    <h2>
                      从一个故障开始 <small>EXPERIMENTS</small>
                    </h2>
                    <span>↗</span>
                  </div>
                  <button className="scenario-card" onClick={() => preset('少数派隔离')}>
                    <span className="scenario-icon">2│3</span>
                    <span>
                      <strong>少数派隔离</strong>
                      <small>两个领导者，只有一方能提交。</small>
                    </span>
                    <span>↗</span>
                  </button>
                  <button className="scenario-card" onClick={() => preset('领导者故障')}>
                    <span className="scenario-icon crash-icon">⌁</span>
                    <span>
                      <strong>领导者故障</strong>
                      <small>权力交接，日志如何继续？</small>
                    </span>
                    <span>↗</span>
                  </button>
                </section>
                <section className="panel fault-panel">
                  <div className="panel-heading">
                    <h2>
                      故障注入 <small>FAULT INJECTION</small>
                    </h2>
                    <span className="warning-icon">⌁</span>
                  </div>
                  <div className="fault-controls">
                    <div className="node-selector" role="group" aria-label="选择故障目标">
                      {snapshot.nodes.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => setSelected(n.id)}
                          className={n.id === selected ? 'chosen' : ''}
                        >
                          {n.id}
                          {n.crashed && <i />}
                        </button>
                      ))}
                    </div>
                    <div className="fault-actions">
                      <button
                        className={inspected?.crashed ? 'recover-button' : 'crash-button'}
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
                        ⫾ 分区 2│3
                      </button>
                    </div>
                    <button
                      className="heal-button"
                      onClick={() => act({ type: 'heal' })}
                      disabled={snapshot.groups.length === 1}
                    >
                      ⤨ 恢复全部链路
                    </button>
                    <label className="slider-label" htmlFor="latency">
                      消息延迟{' '}
                      <strong>
                        {snapshot.network.latency} <span>ms ± 50%</span>
                      </strong>
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
                      随机丢包{' '}
                      <strong>
                        {Math.round(snapshot.network.loss * 100)} <span>%</span>
                      </strong>
                    </label>
                    <input
                      id="loss"
                      type="range"
                      min="0"
                      max="75"
                      step="5"
                      value={Math.round(snapshot.network.loss * 100)}
                      onChange={(e) =>
                        act({
                          type: 'network',
                          loss: Number(e.target.value) / 100,
                          latency: snapshot.network.latency,
                        })
                      }
                    />
                  </div>
                </section>
                <section className="panel write-panel">
                  <div className="panel-heading">
                    <h2>
                      向集群写入 <small>CLIENT PROPOSAL</small>
                    </h2>
                    <span>＋</span>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const node = target === 'auto' ? leader?.id : target;
                      if (node) void act({ type: 'write', node, key, value });
                      else setNotice('当前没有活跃领导者。运行实验以等待选举。');
                    }}
                  >
                    <label>
                      目标节点
                      <select
                        aria-label="写入目标"
                        value={target}
                        onChange={(e) => setTarget(e.target.value as NodeId | 'auto')}
                      >
                        <option value="auto">
                          最高任期领导者{leader ? ` · ${leader.id}` : ' · 等待选举'}
                        </option>
                        {snapshot.nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.id} · {n.crashed ? '离线' : roleLabel[n.role]} · T{n.term}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="key-value">
                      <label>
                        KEY
                        <input
                          value={key}
                          onChange={(e) => setKey(e.target.value)}
                          aria-label="写入键名"
                          maxLength={24}
                          required
                          pattern="[a-zA-Z][a-zA-Z0-9_-]{0,23}"
                        />
                      </label>
                      <label>
                        VALUE
                        <input
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          aria-label="写入值"
                          maxLength={80}
                        />
                      </label>
                    </div>
                    <button className="submit-write" type="submit">
                      提交提案 <span>↗</span>
                    </button>
                    <p>
                      进入日志后，需多数派确认才会提交。
                      <br />
                      提交延迟按虚拟时间计算。
                    </p>
                  </form>
                </section>
                <section className="panel inspector-panel">
                  <div className="panel-heading">
                    <h2>
                      节点透视 <small>NODE INSPECTOR</small>
                    </h2>
                    <span className="inspector-id">{selected}</span>
                  </div>
                  {inspected && (
                    <>
                      <dl>
                        <div>
                          <dt>角色 / ROLE</dt>
                          <dd>{inspected.crashed ? '离线' : roleLabel[inspected.role]}</dd>
                        </div>
                        <div>
                          <dt>任期 / TERM</dt>
                          <dd>{inspected.term}</dd>
                        </div>
                        <div>
                          <dt>投票给 / VOTED FOR</dt>
                          <dd>{inspected.votedFor ?? '—'}</dd>
                        </div>
                        <div>
                          <dt>已应用 / APPLIED</dt>
                          <dd>{inspected.lastApplied}</dd>
                        </div>
                      </dl>
                      <div className="state-label">STATE MACHINE / 已提交状态</div>
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
                </section>
                <section
                  className={`panel safety-panel ${snapshot.violations.length ? 'unsafe' : ''}`}
                >
                  <div className="safety-top">
                    <span className="safety-symbol">{snapshot.violations.length ? '!' : '✓'}</span>
                    <div>
                      <strong>
                        {snapshot.violations.length ? '检测到安全违规' : '安全不变量通过'}
                      </strong>
                      <small>RUNTIME INVARIANTS</small>
                    </div>
                  </div>
                  <ul>
                    <li>
                      Election safety <span>{snapshot.violations.length ? '—' : '✓'}</span>
                    </li>
                    <li>
                      Leader completeness <span>{snapshot.violations.length ? '—' : '✓'}</span>
                    </li>
                    <li>
                      Log matching <span>{snapshot.violations.length ? '—' : '✓'}</span>
                    </li>
                    <li>
                      State machine safety <span>{snapshot.violations.length ? '—' : '✓'}</span>
                    </li>
                    <li>
                      Committed prefix protection{' '}
                      <span>{snapshot.violations.length ? '—' : '✓'}</span>
                    </li>
                  </ul>
                  <div className="safety-count" data-testid="safety">
                    {snapshot.checked.toLocaleString()} 次检查{' '}
                    <span>{snapshot.violations.length} violations</span>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
        <footer>
          <span>
            <Mark /> QUORUM LAB <b>·</b> ENGINEERING THROUGH EXPERIMENTS
          </span>
          <p>浏览器内 Raft 模拟 · 固定五节点 · 非生产存储系统</p>
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
        <button className="dialog-close" onClick={() => setHelp(false)} aria-label="关闭协议说明">
          ×
        </button>
        <span className="eyebrow">THE RULES OF CONSENSUS</span>
        <h2>多数派，是一致性的支点。</h2>
        <p>
          领导者把写入复制给其他节点。至少三个节点确认后，它才能提交当前任期的条目，并通知跟随者应用日志。
        </p>
        <h3>分区时为什么会有两个领导者？</h3>
        <p>
          少数派中的旧领导者还没获知新任期，可能仍自认为是领导者。它能接受提案，但无法收集多数派确认。不同任期的领导者可以同时存在；同一任期最多只能选出一个。
        </p>
        <h3>恢复时如何修复日志？</h3>
        <p>
          跟随者核对前一条日志的索引和任期，拒绝不匹配的复制请求。领导者回退复制位置，找到共同前缀，覆盖尚未提交的冲突后缀。
        </p>
        <h3>怎样复现实验？</h3>
        <p>
          导出文件保存随机种子与操作序列。所有计时、消息延迟、丢包都使用虚拟时钟与固定随机数生成器。导入后得到相同状态；拖动回放滑块可回到任意操作。
        </p>
        <p className="help-boundary">
          范围：模拟 crash/recovery、稳定存储、固定成员与基本 Raft 协议。磁盘
          IO、快照压缩、成员变更和线性一致读属于后续路线。
        </p>
        <a href="https://raft.github.io/raft.pdf" target="_blank" rel="noreferrer">
          Ongaro & Ousterhout · Raft paper ↗
        </a>
      </dialog>
    </>
  );
}
