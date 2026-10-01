# Quorum Lab v0.2.0 — Consensus, under pressure

**[Live observatory](https://qiyuhuating.github.io/quorum-lab/)** · [Source and architecture](https://github.com/qiyuhuating/quorum-lab)

A substantial redesign of the independent five-node Raft laboratory.

- Warm editorial framing, spatial node platforms, animated partition separation and live replica counts.
- Six real protocol checkpoints: healthy state, partition, minority proposal, majority commit, reconnect, conflict repair.
- Actual RPC payloads, delivery/drop causes, upcoming event queue and one-event deterministic stepping.
- Inline proposal values, log divergence, node state, pinned baseline comparison and replay branching.
- Keyboard interaction and reduced motion; all assets and simulation remain local to the browser.
- Updated screenshots, actual production recording, interview walkthrough and portable demo.
- Version-aware Actions release pipeline with checked source/demo ZIPs, complete Git bundle, checksums and resumable draft publication.

Validation: 18 engine tests, 39 production tests across Chromium/Firefox/WebKit, 100 exact full-snapshot benchmark replays, 523,843 runtime state checks and zero detected safety violations.

The source/media commit uses the connected GitHub blob/tree/commit/ref tools. The Actions release job performs publication after verification and Pages deployment. The public observatory has also passed an actual new committed write, six-chapter/guide completion, event/RPC inspection and all four responsive widths, with zero page errors or safety violations.

Scope: fixed membership, symmetric partitions and simulated stable storage. No real disk durability, member reconfiguration, exactly-once client semantics, linearizable reads or formal correctness proof.
