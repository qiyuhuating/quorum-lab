# Quorum Lab v0.3.1 — Every message tells you why

**[Live observatory](https://qiyuhuating.github.io/quorum-lab/)** · [Source and architecture](https://github.com/qiyuhuating/quorum-lab)

A causal debugger and directional fault workbench for the independent five-node Raft laboratory.

Stability patch: download anchors are attached to the document and their object URLs remain alive for 60 seconds before cleanup. CI now uses zero browser retries and adds 12 repeated WebKit export/import checks. v0.3.0 had one export timeout that passed on retry; this patch strengthens the product path and makes that outcome fail the gate.

- Actual RPC receive-branch explanations: accepted, rejected, ignored and transport-dropped verdicts with diagnostic values.
- Before/after receiver slices for role, term, vote, log tail, commit and applied indices; historical packet inspection preserves its original slice.
- Distinct prefix rejection, conflict truncation, old-term requests, stale confirmations and current-term commit advancement.
- Independent directed cuts, a keyboard-operable 5×5 matrix and directional topology arrows. Cuts affect sends and in-flight deliveries; heal clears cuts and partitions.
- Bounded RPC filters for exceptional outcomes and actual repairs; exported actions restore cuts and all diagnostic observations exactly.
- Recovering-lagging-node and asymmetric experiment fixtures, actual production screenshots, recording and updated interview walkthrough.
- Existing six-chapter exhibit, Worker isolation, replay branching, portable demo and gated version-aware release pipeline remain available.
- Cloud-only publication gates now test the actual Pages URL and extracted portable ZIP, then attach both revision-stamped reports with SHA-256 checksums. The remaining pipeline can finish independently of the development computer.

Validation: 24 engine tests, 48 production tests across Chromium/Firefox/WebKit, 20 asymmetric seed cases and 100 exact mixed-fault benchmark replays. The benchmark executed 469,695 runtime checks and sent 372,137 simulated messages with zero detected safety violations.

The source/media commit uses the connected GitHub blob/tree/commit/ref tools. The Actions release job verifies artifact integrity and performs publication after verification and Pages deployment. The packaged source documents executed validation and the production check version explicitly.

Scope: fixed membership, symmetric partitions, directed cuts and simulated stable storage. A causal slice explains one local event. No real disk durability, member reconfiguration, exactly-once client semantics, linearizable reads or formal correctness proof.
