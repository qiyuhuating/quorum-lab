import type { NodeId, Snapshot } from '../engine/types.ts';

const ORBIT: [number, number][] = [
  [450, 69],
  [724, 182],
  [617, 319],
  [283, 319],
  [176, 182],
];
const ISLANDS: [number, number][][] = [
  [
    [177, 134],
    [240, 292],
  ],
  [
    [663, 84],
    [773, 245],
    [570, 294],
  ],
];
export function Topology({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: Snapshot;
  selected: NodeId;
  onSelect: (id: NodeId) => void;
}) {
  const split = snapshot.groups.length > 1;
  const positions = Object.fromEntries(
    snapshot.nodes.map((n, i) => {
      const group = snapshot.groups.findIndex((g) => g.includes(n.id));
      const index = snapshot.groups[group].indexOf(n.id);
      return [
        n.id,
        split && snapshot.groups.length === 2 && snapshot.groups[0].length === 2
          ? ISLANDS[group][index]
          : ORBIT[i],
      ];
    }),
  ) as Record<NodeId, [number, number]>;
  const live = snapshot.nodes.filter((n) => !n.crashed).length;
  const inspected = snapshot.nodes.find((n) => n.id === selected)!;
  const index = inspected.log.length - 1;
  const entry = inspected.log[index];
  const copies = index ? snapshot.nodes.filter((n) => n.log[index]?.id === entry.id).length : 0;
  const committed = index > 0 && index <= inspected.commitIndex;
  return (
    <svg className="topology" viewBox="0 0 900 400" role="group" aria-label="五节点 Raft 网络拓扑">
      <defs>
        <radialGradient id="space">
          <stop stopColor="#204746" stopOpacity=".8" />
          <stop offset="1" stopColor="#071d20" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pod" x2="0" y2="1">
          <stop stopColor="#24494c" />
          <stop offset="1" stopColor="#0d282e" />
        </linearGradient>
        <linearGradient id="cut" x2="0" y2="1">
          <stop stopColor="#ff956c" stopOpacity="0" />
          <stop offset=".5" stopColor="#ff956c" />
          <stop offset="1" stopColor="#ff956c" stopOpacity="0" />
        </linearGradient>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" stroke="#56817e" strokeOpacity=".11" fill="none" />
        </pattern>
        <filter id="bloom">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <marker id="cut-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0 0 7 3.5 0 7" fill="none" stroke="#ff956c" />
        </marker>
      </defs>
      <rect width="900" height="400" fill="url(#grid)" />
      <ellipse cx="450" cy="225" rx="430" ry="220" fill="url(#space)" />
      {[1, 0.77, 0.54].map((s) => (
        <ellipse
          key={s}
          cx="450"
          cy="212"
          rx={345 * s}
          ry={154 * s}
          fill="none"
          stroke="#547b75"
          strokeOpacity=".22"
          strokeDasharray={s === 0.77 ? '2 7' : undefined}
        />
      ))}
      <path d="M35 212H865M450 25V377" stroke="#6b8980" strokeOpacity=".18" strokeDasharray="3 9" />
      <text className="space-word" x="450" y="273" textAnchor="middle">
        QUORUM
      </text>
      {snapshot.nodes.flatMap((n, i) =>
        snapshot.nodes.slice(i + 1).map((p) => {
          const connected = snapshot.groups.some((g) => g.includes(n.id) && g.includes(p.id));
          const active =
            connected && !n.crashed && !p.crashed && (n.role === 'leader' || p.role === 'leader');
          const [x1, y1] = positions[n.id],
            [x2, y2] = positions[p.id];
          return (
            <path
              key={n.id + p.id}
              d={`M${x1} ${y1} Q450 ${200 + (i % 2) * 60} ${x2} ${y2}`}
              fill="none"
              stroke={connected ? '#84dfd1' : '#ff956c'}
              strokeWidth={active ? 1.5 : 0.8}
              opacity={active ? 0.5 : connected ? 0.14 : 0.14}
              strokeDasharray={connected ? undefined : '3 10'}
            />
          );
        }),
      )}
      {split && (
        <g className="partition-cut">
          <path
            d="M449 12 432 96 468 181 433 274 453 382"
            stroke="url(#cut)"
            strokeWidth="14"
            opacity=".13"
            fill="none"
          />
          <path
            d="M449 12 432 96 468 181 433 274 453 382"
            stroke="url(#cut)"
            strokeWidth="1.5"
            fill="none"
          />
          <text x="450" y="32" textAnchor="middle">
            NETWORK FRACTURE
          </text>
        </g>
      )}
      {snapshot.links
        .filter((l) => snapshot.groups.some((g) => g.includes(l.from) && g.includes(l.to)))
        .map((link) => {
          const [x1, y1] = positions[link.from],
            [x2, y2] = positions[link.to];
          const dx = x2 - x1,
            dy = y2 - y1,
            length = Math.hypot(dx, dy);
          const start = [x1 + (dx * 55) / length, y1 + (dy * 55) / length];
          const end = [x2 - (dx * 65) / length, y2 - (dy * 65) / length];
          const cx = 450 + ((x1 + x2) / 2 - 450) * 2 + (dy / length) * 16;
          const cy = 212 + ((y1 + y2) / 2 - 212) * 2 - (dx / length) * 16;
          return (
            <g key={`${link.from}>${link.to}`} aria-label={`单向切断 ${link.from} 到 ${link.to}`}>
              <path
                d={`M${start.join(' ')} Q${cx} ${cy} ${end.join(' ')}`}
                fill="none"
                stroke="#ff956c"
                strokeWidth="2"
                strokeDasharray="5 6"
                markerEnd="url(#cut-arrow)"
                opacity=".85"
              />
              <text
                x={start[0] * 0.25 + cx * 0.5 + end[0] * 0.25}
                y={start[1] * 0.25 + cy * 0.5 + end[1] * 0.25 - 7}
                fill="#ff956c"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {link.from}→{link.to} ×
              </text>
            </g>
          );
        })}
      {snapshot.packets
        .filter((p) => p.status !== 'held' && p.deliverAt + 160 > snapshot.now)
        .slice(-36)
        .map((p) => {
          const [x1, y1] = positions[p.from],
            [x2, y2] = positions[p.to];
          const t = p.dropped
            ? 0.47
            : Math.max(0, Math.min(1, (snapshot.now - p.sentAt) / (p.deliverAt - p.sentAt)));
          const cy = 200 + (snapshot.nodes.findIndex((n) => n.id === p.from) % 2) * 60;
          const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * 450 + t * t * x2;
          const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={p.payload.kind === 'append' && p.payload.entries.length ? 3.8 : 2.1}
              fill={p.dropped ? '#ff956c' : '#a3f7e5'}
              opacity={p.dropped ? 0.5 : 0.9}
            />
          );
        })}
      <g className={`quorum-core ${!committed && index ? 'uncommitted' : ''}`}>
        <text x="450" y="161" textAnchor="middle" className="core-kicker">
          {index ? `${selected} / ENTRY #${index} / TERM ${entry.term}` : 'NO PROPOSAL YET'}
        </text>
        <text x="450" y="212" textAnchor="middle" className="core-value">
          {String(copies).padStart(2, '0')}
          <tspan> / 05</tspan>
        </text>
        <text x="450" y="235" textAnchor="middle" className="core-kicker">
          {live < 3
            ? 'QUORUM UNAVAILABLE'
            : committed
              ? `COMMITTED / ${entry.key ?? 'NO-OP'}`
              : 'REPLICAS / COMMIT REQUIRES 3 ACKS'}
        </text>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={416 + i * 14}
            y="248"
            width="10"
            height="3"
            rx="1"
            fill={i < copies ? (committed ? '#a2efda' : '#ff986c') : '#395950'}
          />
        ))}
      </g>
      {snapshot.nodes.map((n) => {
        const [x, y] = positions[n.id];
        const color = n.crashed
          ? '#6e8485'
          : n.role === 'leader'
            ? '#acf2d6'
            : n.role === 'candidate'
              ? '#d3b7fa'
              : '#8dbabb';
        const pending = n.log.length - 1 > n.commitIndex;
        return (
          <g
            key={n.id}
            className={`node ${n.crashed ? 'dead' : ''}`}
            style={
              {
                transform: `translate(${x}px, ${y}px)`,
                '--node-color': color,
              } as React.CSSProperties
            }
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
          >
            <title>
              {n.id} · {n.crashed ? 'OFFLINE' : n.role.toUpperCase()} · term {n.term} · commit{' '}
              {n.commitIndex}
            </title>
            <ellipse cy="21" rx="58" ry="29" fill="#020f13" opacity=".65" />
            {n.role === 'leader' && !n.crashed && (
              <ellipse
                cy="9"
                rx="64"
                ry="41"
                fill="none"
                stroke={color}
                opacity=".4"
                strokeDasharray="3 6"
                className="leader-orbit"
              />
            )}
            <path
              d="M-44 0V20C-44 50 44 50 44 20V0"
              fill="url(#pod)"
              stroke={color}
              strokeOpacity=".3"
            />
            <ellipse
              rx="44"
              ry="28"
              fill="#17373b"
              stroke={color}
              strokeWidth={selected === n.id ? 2 : 1}
            />
            <ellipse rx="36" ry="22" fill="#122d32" stroke={color} strokeOpacity=".15" />
            {selected === n.id && (
              <path
                d="M-59-15v-12h14M59-15v-12H45M-59 40v12h14M59 40v12H45"
                fill="none"
                stroke={color}
                strokeWidth="1.5"
              />
            )}
            <text textAnchor="middle" y="8" className="node-id" fill={color}>
              {n.id}
            </text>
            <circle cx="34" cy="-18" r="4" fill={n.crashed ? '#657477' : color} />
            {[0, 1, 2, 3, 4].map((i) => (
              <rect
                key={i}
                x={-20 + i * 9}
                y="30"
                width="5"
                height="5"
                rx="1"
                fill={
                  i < n.commitIndex
                    ? '#a2f2d6'
                    : pending && i < n.log.length - 1
                      ? '#ff956c'
                      : '#37575b'
                }
              />
            ))}
            <text y="69" textAnchor="middle" className="node-role" fill={color}>
              {n.crashed ? 'OFFLINE' : n.role.toUpperCase()}
              <tspan fill="#7a9696"> / T{n.term}</tspan>
            </text>
          </g>
        );
      })}
      <text x="28" y="382" className="map-coordinate">
        {split ? `${snapshot.groups[0].length} NODES / MINORITY` : 'FIG. 01 / CONSENSUS FIELD'}
      </text>
      <text x="872" y="382" textAnchor="end" className="map-coordinate">
        {split
          ? `${Math.max(...snapshot.groups.map((g) => g.length))} NODES / LARGEST PARTITION`
          : 'CLICK A NODE TO INSPECT'}
      </text>
    </svg>
  );
}
