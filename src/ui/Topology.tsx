import type { NodeId, Snapshot } from '../engine/types.ts';

const POS: Record<NodeId, [number, number]> = {
  N1: [340, 90],
  N2: [543, 222],
  N3: [468, 451],
  N4: [212, 451],
  N5: [137, 222],
};
const names: Record<string, string> = {
  leader: 'LEADER',
  candidate: 'CANDIDATE',
  follower: 'FOLLOWER',
};
export function Topology({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: Snapshot;
  selected: NodeId;
  onSelect: (n: NodeId) => void;
}) {
  const { nodes, groups, packets, now } = snapshot;
  return (
    <svg className="topology" viewBox="0 0 680 540" aria-label="五节点 Raft 网络拓扑" role="group">
      <defs>
        <radialGradient id="field">
          <stop offset="0" stopColor="#ccff6b" stopOpacity=".08" />
          <stop offset="1" stopColor="#ccff6b" stopOpacity="0" />
        </radialGradient>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".7" fill="#32414d" opacity=".5" />
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width="680" height="540" fill="url(#dots)" />
      <circle cx="340" cy="280" r="245" fill="url(#field)" />
      {[108, 173, 229].map((r) => (
        <circle
          key={r}
          cx="340"
          cy="280"
          r={r}
          fill="none"
          stroke="#263440"
          strokeDasharray={r === 173 ? '3 10' : undefined}
          opacity=".48"
        />
      ))}
      <path d="M340 23V537M80 280H600" stroke="#263440" strokeDasharray="3 11" opacity=".35" />
      {nodes.flatMap((n, i) =>
        nodes.slice(i + 1).map((p) => {
          const connected = groups.some((g) => g.includes(n.id) && g.includes(p.id));
          const [x1, y1] = POS[n.id],
            [x2, y2] = POS[p.id];
          const hot =
            connected && !n.crashed && !p.crashed && (n.role === 'leader' || p.role === 'leader');
          return (
            <line
              key={n.id + p.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={!connected ? '#ed797e' : hot ? '#a5d767' : '#40525f'}
              strokeWidth={hot ? 1.2 : 0.8}
              opacity={!connected ? 0.28 : hot ? 0.4 : 0.24}
              strokeDasharray={!connected ? '5 8' : undefined}
            />
          );
        }),
      )}
      {packets.slice(-42).map((p) => {
        const [x1, y1] = POS[p.from],
          [x2, y2] = POS[p.to];
        const progress = Math.max(0, Math.min(1, (now - p.sentAt) / (p.deliverAt - p.sentAt)));
        const t = p.dropped ? 0.5 : progress;
        const opacity = p.dropped ? 0.45 : Math.max(0.1, 1 - Math.max(0, now - p.deliverAt) / 250);
        return (
          <circle
            key={p.id}
            cx={x1 + (x2 - x1) * t}
            cy={y1 + (y2 - y1) * t}
            r={p.kind === 'append' ? 3 : 2.2}
            fill={p.dropped ? '#ff787b' : p.kind.startsWith('vote') ? '#b496ff' : '#ccff6b'}
            opacity={opacity}
          />
        );
      })}
      <text x="340" y="267" textAnchor="middle" className="map-center-label">
        MAJORITY REQUIRED
      </text>
      <text x="340" y="306" textAnchor="middle" className="map-center-value">
        3 <tspan className="map-center-slash">/ 5</tspan>
      </text>
      <text x="340" y="332" textAnchor="middle" className="map-center-label">
        {groups.length === 1 ? 'FULL MESH' : `${groups.length} NETWORK PARTITIONS`}
      </text>
      {nodes.map((n) => {
        const [x, y] = POS[n.id];
        const color = n.crashed
          ? '#65727f'
          : n.role === 'leader'
            ? '#ccff6b'
            : n.role === 'candidate'
              ? '#b496ff'
              : '#75bdd1';
        return (
          <g
            key={n.id}
            role="button"
            tabIndex={0}
            aria-label={`选择节点 ${n.id}`}
            aria-pressed={selected === n.id}
            onClick={() => onSelect(n.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(n.id);
              }
            }}
            className={`node ${n.crashed ? 'dead' : ''}`}
          >
            <title>
              {n.id} · {n.crashed ? 'OFFLINE' : names[n.role]} · term {n.term}
            </title>
            {n.role === 'leader' && !n.crashed && (
              <circle
                cx={x}
                cy={y}
                r="46"
                fill="none"
                stroke={color}
                opacity=".18"
                strokeDasharray="2 6"
                className="leader-orbit"
              />
            )}
            <circle
              cx={x}
              cy={y}
              r="37"
              fill="#0c141c"
              stroke={color}
              strokeWidth={selected === n.id ? 2 : 1}
              opacity={n.crashed ? 0.7 : 1}
            />
            {selected === n.id && (
              <circle
                cx={x}
                cy={y}
                r="42"
                fill="none"
                stroke={color}
                strokeWidth=".6"
                opacity=".5"
              />
            )}
            <text x={x} y={y + 6} fill={color} textAnchor="middle" className="node-id">
              {n.id}
            </text>
            <circle cx={x + 26} cy={y - 25} r="5" fill={color} stroke="#090d12" strokeWidth="2" />
            <text x={x} y={y + 62} textAnchor="middle" fill={color} className="node-role">
              {n.crashed ? 'OFFLINE' : names[n.role]}
            </text>
            <text x={x} y={y + 80} textAnchor="middle" className="node-term">
              TERM {n.term} · LOG {n.log.length - 1}
            </text>
          </g>
        );
      })}
      <text x="20" y="516" className="map-coordinate">
        CLUSTER / 00{snapshot.seed} • VIRTUAL NETWORK
      </text>
      <text x="660" y="516" textAnchor="end" className="map-coordinate">
        {(snapshot.now / 1000).toFixed(2)}s
      </text>
    </svg>
  );
}
