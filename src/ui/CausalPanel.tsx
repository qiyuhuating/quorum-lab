import type { EventEffect, NodeSummary, Packet } from '../engine/types.ts';

const roles = { leader: '领导者', candidate: '候选者', follower: '跟随者' };
const verdicts = {
  accepted: 'ACCEPTED',
  rejected: 'REJECTED',
  ignored: 'IGNORED',
  dropped: 'DROPPED',
};

function StateCard({ state, before }: { state: NodeSummary; before?: NodeSummary }) {
  const rows = [
    ['日志长度', 'logLength'],
    ['提交索引', 'commitIndex'],
    ['已应用', 'lastApplied'],
    ['投票给', 'votedFor'],
  ] as const;
  return (
    <div className="effect-state">
      <div className={before && before.role !== state.role ? 'changed' : ''}>
        <strong>{roles[state.role]}</strong>
        <span className={before && before.term !== state.term ? 'changed' : ''}>
          TERM {state.term}
        </span>
      </div>
      <dl>
        {rows.map(([label, key]) => (
          <div key={key} className={before && before[key] !== state[key] ? 'changed' : ''}>
            <dt>{label}</dt>
            <dd>{state[key] ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <p className={before && before.tail.id !== state.tail.id ? 'changed' : ''}>
        <small>LOG TAIL / T{state.tail.term}</small>
        {state.tail.key ? (
          <>
            {state.tail.key} = <b>{state.tail.value}</b>
          </>
        ) : (
          <b>{state.tail.id === 'root' ? '∅ 空日志' : 'no-op'}</b>
        )}
      </p>
    </div>
  );
}

export function CausalPanel({ effect, packet }: { effect?: EventEffect; packet?: Packet }) {
  const decision = packet ? packet.decision : effect?.decision;
  const transition = packet ? packet.transition : effect?.transition;
  const event = effect?.event;
  const at = packet ? packet.deliverAt : event?.at;
  const route = packet
    ? `${packet.from} → ${packet.to}`
    : event?.type === 'message'
      ? `${event.from} → ${event.to}`
      : event?.node;
  return (
    <section
      className={`panel causal-panel ${decision?.verdict ?? ''}`}
      data-testid="causal-panel"
      data-code={decision?.code ?? 'in-flight'}
      data-event-id={packet?.id ?? effect?.event.seq}
    >
      <div className="panel-heading">
        <h3>
          因果切片 <small>WHY THIS EVENT MATTERS</small>
        </h3>
        <span>{packet ? `PACKET #${packet.id}` : 'LAST EXECUTED EVENT'}</span>
      </div>
      <div className="effect-heading">
        <div className="effect-route">
          <b>{route ?? '—'}</b>
          <span>{at === undefined ? '等待事件' : `${(at / 1000).toFixed(3)}s`}</span>
        </div>
        <span className={`verdict ${decision?.verdict ?? ''}`}>
          {decision ? verdicts[decision.verdict] : 'IN FLIGHT'}
        </span>
      </div>
      <div className="effect-explanation">
        <h4>{decision?.title ?? '消息尚未进入接收端'}</h4>
        <p>
          {decision?.detail ??
            '发送不等于接受。逐事件推进，观察这条消息在接收节点真正执行的协议分支。'}
        </p>
      </div>
      {transition ? (
        <div className="effect-transition" data-testid="event-transition">
          <div>
            <span className="effect-caption">
              01 / {transition.node} {packet || event?.type === 'message' ? '接收前' : '执行前'}
            </span>
            <StateCard state={transition.before} />
          </div>
          <div className="effect-arrow" aria-hidden="true">
            →
          </div>
          <div>
            <span className="effect-caption">02 / {transition.node} 处理后</span>
            <StateCard state={transition.after} before={transition.before} />
          </div>
        </div>
      ) : (
        <p className="effect-empty">尚无接收端状态变化记录。</p>
      )}
      {decision && (
        <details className="effect-facts">
          <summary>
            判定依据 <span>{decision.code}</span>
          </summary>
          <dl>
            {Object.entries(decision.facts).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value === null ? '∅' : String(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
