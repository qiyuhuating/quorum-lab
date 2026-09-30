# Quorum Lab v0.1.0

An interactive fixed-membership Raft laboratory with an independently implemented protocol and reproducible experiments.

- Five-node elections, heartbeat/log replication, current-term majority commits and new-leader no-ops.
- Virtual-time, seeded event scheduling, symmetric network partitions, jitter, loss and crash/recovery.
- React/SVG interface backed by a Web Worker, log matrix, node state-machine inspector and event trace.
- Historical safety observers plus versioned experiment export/import, rewind and branching.
- TypeScript checks, deterministic protocol tests, three-browser acceptance and gated Pages deployment workflow.
- MIT source, architecture/acceptance documents, interview walkthrough, screenshots and portable static demo.

Scope: simulated stable storage and fixed five-node membership. Snapshot compaction, configuration changes, production disk IO and linearizable read protocols are future work.

See the validation report and repository Actions page for actual execution results. The repository was created using the user's existing GitHub CLI login; source and media uploads use the GitHub connector.
