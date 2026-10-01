# v0.2: from console to observatory

## Reflection

The first release had real protocol behavior, but the presentation obscured it. The oversized introduction pushed the network below the fold. Equal-weight cards made faults, evidence and settings compete. A partition was a static preset with no explanation of what actually changed. Packet dots exposed no message contents. Test counts alone did not make the experience memorable.

## Direction

A warm editorial frame surrounds a dark, spatial network stage. Orange represents a proposal that cannot reach quorum; cyan represents replicated, committed work. Network partitions physically separate the nodes. The log matrix shares the first screen with the network, so disagreement is visible immediately. All role, log, status and evidence labels are derived from actual snapshots.

The central exhibit is a six-chapter partition experiment. Each chapter is a checkpoint in one deterministic action history: healthy network, disconnected groups, minority proposal, majority commit, reconnection, repaired logs. Chapters run the protocol in a Worker; they never manufacture node state. Changing any controls exits the narrated checkpoint and starts a free experiment from that state.

## Acceptance

- At 1440 × 900, the network, chapter controls and replicated log matrix are visible together.
- At 320, 390, 768 and 1440 px, the document has no horizontal overflow; inner log/RPC scrollers are explicit.
- Each chapter's claims are checked against actual log replicas, applied state and committed indices. The minority entry is present on two nodes, uncommitted, then removed from all five after repair.
- Packet inspection reveals the actual serialized RequestVote/AppendEntries payload, status and drop cause; no synthetic packets.
- Event stepping processes exactly one live scheduled event, skipping invalidated timers; its actions export, import and branch deterministically.
- Keyboard controls, reduced motion, all three browser engines, CI and the published production build are verified.
- README, architectural notes, demonstration footage and release package describe this implementation and its limits.

## Scope

Keep the independently implemented five-node Raft engine and existing hosting. Extend its observation and event controls. Do not add a backend, account system or unrelated product features. Runtime invariants remain testing instrumentation, not a formal proof.
