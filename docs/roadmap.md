# Roadmap

## v0.1 — implemented

- Fixed five-node Raft model with independent elections and replication.
- Current-term commit rule, new-leader no-op, stable-state crash/recovery.
- Seeded discrete-event transport, symmetric partitions, latency and random loss.
- Runtime safety observers, production Web Worker, node inspector and event stream.
- Versioned experiment export/import, operation rewind and branch replay.
- Automated protocol and browser checks, portable demo and GitHub Actions Pages workflow.

## v0.2 — debugging depth

- Asymmetric link cuts and message duplication with delivery-level controls.
- Packet inspection, single-message stepping and explanation of rejected RPCs.
- Property-based schedule generation with automatic failure shrinking to a minimal replay.
- Periodic replay checkpoints to make large historical seeks cheaper.

## v0.3 — protocol depth

- Snapshot installation and log compaction, tested through interrupted transfer.
- Pre-vote and check-quorum as explicit optional extensions; compare availability tradeoffs.
- Client request deduplication and linearizable read protocols with documented assumptions.
- Joint-consensus membership changes and safety monitors for configuration transitions.

## v1 exploration — executable specification

- Differential traces against a separately implemented Raft reference model.
- A small TLA+ or PlusCal model checked over bounded fault schedules.
- Pluggable durable storage adapter with explicit fsync and recovery semantics, in a separate runtime.

These are planned capabilities. The v0.1 implementation and validation report do not claim them.
