# Quorum Lab v0.1.0

An interactive fixed-membership Raft laboratory with an independently implemented protocol and reproducible experiments.

**[Live demo](https://qiyuhuating.github.io/quorum-lab/)** · [Source](https://github.com/qiyuhuating/quorum-lab)

- Five-node elections, heartbeat/log replication, current-term majority commits and new-leader no-ops.
- Virtual-time, seeded event scheduling, symmetric network partitions, jitter, loss and crash/recovery.
- React/SVG interface backed by a Web Worker, log matrix, node state-machine inspector and event trace.
- Historical safety observers plus versioned experiment export/import, rewind and branching.
- TypeScript checks, deterministic protocol tests, three-browser acceptance and gated Pages deployment workflow.
- MIT source, architecture/acceptance documents, interview walkthrough, screenshots and portable static demo.

Scope: simulated stable storage and fixed five-node membership. Snapshot compaction, configuration changes, production disk IO and linearizable read protocols are future work.

Validation: **14 engine tests**, **24 production browser tests**, **100 exact benchmark replays**, **523,843 state checks**, **0 detected safety violations**. The Ubuntu verification and Pages deployment jobs passed, and a real browser verified a new committed write on the public site.

See the validation report and repository Actions page for execution evidence. The repository was created using the user's existing GitHub CLI login; source and media uploads use the GitHub connector.
