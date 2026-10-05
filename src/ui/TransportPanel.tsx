import { useState } from 'react';
import { MAX_HELD, MAX_TIME, type Action, type Packet, type Snapshot } from '../engine/types.ts';
import './transport.css';

export function TransportPanel({
  snapshot,
  selected,
  busy,
  onSelect,
  onAction,
  onEcho,
}: {
  snapshot: Snapshot;
  selected?: Packet;
  busy: boolean;
  onSelect: (packet: Packet) => void;
  onAction: (action: Action) => void;
  onEcho: () => void;
}) {
  const [delay, setDelay] = useState('25');
  const { held, pending, duplicates, discarded } = snapshot.transport;
  const packet = selected ?? held[0] ?? pending[0] ?? snapshot.packets.at(-1);
  const controllable = packet?.status === 'in-flight' || packet?.status === 'held';
  const validDelay =
    Number.isInteger(Number(delay)) &&
    Number(delay) >= 1 &&
    Number(delay) <= 5000 &&
    snapshot.now + Number(delay) <= MAX_TIME;
  const voter =
    selected?.payload.kind === 'voted'
      ? snapshot.nodes.find((n) => n.id === selected.to)
      : snapshot.nodes
          .filter((n) => (n.role === 'candidate' || n.role === 'leader') && !n.crashed)
          .sort((a, b) => b.term - a.term)[0];
  const rows = [...held, ...pending.slice(0, 6)];
  const origin = selected
    ? (selected.duplicateOf ?? selected.id)
    : snapshot.packets.findLast((p) => p.duplicateOf)?.duplicateOf;
  const family =
    origin === undefined
      ? []
      : snapshot.packets.filter((p) => p.id === origin || p.duplicateOf === origin);
  function command(type: 'hold' | 'release' | 'drop' | 'duplicate') {
    if (!packet) return;
    onAction(
      type === 'release' || type === 'duplicate'
        ? { type, packet: packet.id, delay: Number(delay) }
        : { type, packet: packet.id },
    );
  }
  return (
    <section className="transport-console" aria-label="对抗消息调度台">
      <div className="transport-heading">
        <div>
          <span className="eyebrow">THE DELIVERY IS YOURS</span>
          <h3>消息的顺序，由你改写。</h3>
          <p>暂停一条真实 RPC。让超时先发生，让旧回复迟到，让一张选票产生回声。</p>
        </div>
        <button disabled={busy} onClick={onEcho}>
          载入选票回声 <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div className="transport-counter">
        <span>
          HELD <b data-testid="held-count">{held.length}</b>
          <small>/ {MAX_HELD}</small>
        </span>
        <span>
          COPIES <b data-testid="duplicate-count">{duplicates}</b>
        </span>
        <span>
          DISCARDED <b data-testid="discard-count">{discarded}</b>
        </span>
        <span className="transport-clock">
          VIRTUAL TIME <b>{(snapshot.now / 1000).toFixed(3)}s</b>
        </span>
      </div>
      <div className="transport-layout">
        <div className="delivery-board">
          <div className="delivery-caption">
            <span>INTERCEPT / NEXT SIX ARRIVALS</span>
            <span>FROM → TO</span>
          </div>
          {rows.map((p) => (
            <button
              key={p.id}
              className={`delivery-row ${p.status} ${packet?.id === p.id ? 'selected' : ''}`}
              aria-label={`调度消息 ${p.id} ${p.kind} ${p.from} 到 ${p.to} ${p.status}`}
              aria-pressed={packet?.id === p.id}
              onClick={() => onSelect(p)}
            >
              <span className="delivery-id">
                #{p.id}
                <small>{p.kind}</small>
              </span>
              <span className="delivery-wire">
                <b>{p.from}</b>
                <i />
                <b>{p.to}</b>
              </span>
              <span className="delivery-time">
                {p.status === 'held' ? 'HELD ∥' : `+${p.deliverAt - snapshot.now}ms`}
                <small>
                  {p.duplicateOf ? `COPY OF #${p.duplicateOf}` : `TERM ${p.payload.term}`}
                </small>
              </span>
            </button>
          ))}
          {!rows.length && (
            <p className="delivery-empty">暂无在途消息。逐事件推进，捕获下一次发送。</p>
          )}
          <p className="delivery-note">
            暂停只作用于这条消息，协议计时器继续运行。释放后仍会检查链路与接收节点。
          </p>
          {family.length > 1 && (
            <figure className="echo-lineage" data-testid="packet-lineage">
              <figcaption>
                <span>ONE PAYLOAD, MANY ARRIVALS</span>
                <span>
                  源 #{origin} / 当前保留 {family.length} 份
                </span>
              </figcaption>
              <div className="lineage-flow">
                <div className="lineage-node">
                  <b>{family[0].from}</b>
                  <small>同一发送者</small>
                </div>
                <div className="lineage-packets">
                  {family.slice(-4).map((p) => (
                    <div
                      key={p.id}
                      className={
                        p.decision?.code === 'duplicate-vote' || p.decision?.code === 'stale-rpc'
                          ? 'ignored'
                          : ''
                      }
                    >
                      <span>
                        #{p.id} <small>{p.duplicateOf ? 'COPY' : 'ORIGINAL'}</small>
                      </span>
                      <b>
                        {p.decision?.code === 'duplicate-vote'
                          ? '重复选票 / 忽略'
                          : p.decision?.code === 'stale-rpc'
                            ? '旧确认 / 忽略'
                            : (p.decision?.verdict ?? p.status)}
                      </b>
                    </div>
                  ))}
                </div>
                <div className="lineage-node">
                  <b>{family[0].to}</b>
                  <small>同一接收者</small>
                </div>
              </div>
              <p>
                不同的传输编号，相同的 RPC 载荷。协议如何处理每一份副本，取决于它到达时的真实状态。
              </p>
            </figure>
          )}
        </div>
        <div className="delivery-control">
          <div className="schedule-selection" data-testid="scheduled-packet">
            <span>SELECTED PACKET {packet ? `#${packet.id}` : '—'}</span>
            <h4>{packet ? `${packet.from} → ${packet.to}` : '等待消息'}</h4>
            <p>
              {packet?.kind ?? '—'} / {packet?.status ?? '—'}
              {packet?.duplicateOf ? ` / COPY OF #${packet.duplicateOf}` : ''}
            </p>
            {packet?.status === 'in-flight' && (
              <small>计划在 +{packet.deliverAt - snapshot.now}ms 投递</small>
            )}
          </div>
          <label className="schedule-delay">
            释放或复制后的延迟
            <span>
              <input
                type="number"
                min="1"
                max="5000"
                step="1"
                aria-label="投递延迟毫秒"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
              />
              <small>ms</small>
            </span>
          </label>
          <div className="schedule-actions">
            <button
              disabled={busy || packet?.status !== 'in-flight' || held.length >= MAX_HELD}
              aria-label={`暂停消息 ${packet?.id ?? ''}`}
              onClick={() => command('hold')}
            >
              ∥ 暂停投递
            </button>
            <button
              disabled={busy || packet?.status !== 'held' || !validDelay}
              aria-label={`释放消息 ${packet?.id ?? ''}`}
              onClick={() => command('release')}
            >
              → 释放消息
            </button>
            <button
              disabled={busy || !packet || packet.status === 'dropped' || !validDelay}
              aria-label={`复制消息 ${packet?.id ?? ''}`}
              onClick={() => command('duplicate')}
            >
              ⊕ 复制 RPC
            </button>
            <button
              disabled={busy || !controllable}
              aria-label={`丢弃消息 ${packet?.id ?? ''}`}
              onClick={() => command('drop')}
            >
              × 主动丢弃
            </button>
          </div>
          <div className="vote-proof" data-testid="vote-proof">
            <div>
              <span>UNIQUE VOTERS</span>
              <b data-testid="unique-votes">{voter?.votes.length ?? 0} / 3</b>
            </div>
            <div className="voter-strip" aria-label="实际独立选民">
              {snapshot.nodes.map((n) => (
                <span key={n.id} className={voter?.votes.includes(n.id) ? 'counted' : ''}>
                  {n.id}
                  <i>{voter?.votes.includes(n.id) ? '✓' : '·'}</i>
                </span>
              ))}
            </div>
            <p>
              {voter?.role === 'leader'
                ? '独立选票已达到多数派。'
                : '同一节点的重复回复，不会增加独立票数。'}
              <small>
                {voter ? `${voter.id} / CURRENT TERM ${voter.term} / ${voter.role}` : '等待选举'}
              </small>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
