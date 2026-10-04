import { NODE_IDS, type Action, type Snapshot } from '../engine/types.ts';

export function NetworkMatrix({
  snapshot,
  onAction,
}: {
  snapshot: Snapshot;
  onAction: (action: Action) => unknown;
}) {
  return (
    <section className="panel network-panel">
      <div className="panel-heading">
        <h3>
          切断一个方向 <small>ASYMMETRIC NETWORK</small>
        </h3>
        <span data-testid="cut-count">{snapshot.links.length} CUTS</span>
      </div>
      <p className="network-intro">
        N1 能听见 N2，N2 却听不见 N1。
        <br />
        点击一格，改变一条有方向的链路。
      </p>
      <div className="network-matrix" role="group" aria-label="单向链路矩阵，行发送，列接收">
        <span className="matrix-axis">
          FROM
          <br />↓ TO →
        </span>
        {NODE_IDS.map((to) => (
          <b key={to} className="matrix-label">
            {to}
          </b>
        ))}
        {NODE_IDS.map((from) => (
          <div className="matrix-row" key={from}>
            <b className="matrix-label">{from}</b>
            {NODE_IDS.map((to) => {
              const self = from === to;
              const partitioned = !snapshot.groups.some((g) => g.includes(from) && g.includes(to));
              const cut = snapshot.links.some((l) => l.from === from && l.to === to);
              return (
                <button
                  key={to}
                  disabled={self || partitioned}
                  aria-label={`切换链路 ${from} 到 ${to}`}
                  aria-pressed={cut}
                  className={`matrix-link ${self ? 'self' : partitioned ? 'partitioned' : cut ? 'cut' : 'open'}`}
                  title={
                    self
                      ? '本节点'
                      : partitioned
                        ? '分区已阻断，先恢复全部链路'
                        : `${from} → ${to}：${cut ? '已切断，点击恢复' : '已连通，点击切断'}`
                  }
                  onClick={() => onAction({ type: 'link', from, to, enabled: cut })}
                >
                  {self ? '·' : partitioned ? '∕' : cut ? '×' : '↗'}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="matrix-legend">
        <span>
          <i />
          连通
        </span>
        <span>
          <i />
          单向切断
        </span>
        <span>
          <i />
          分区阻断
        </span>
      </div>
      <p className="network-footnote">
        行 = 发送方 · 列 = 接收方
        <br />
        链路在发送和投递时均检查；在途消息也会受影响。
      </p>
    </section>
  );
}
