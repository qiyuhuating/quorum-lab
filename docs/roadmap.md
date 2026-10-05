# Roadmap

## v0.1 — delivered

- Independent fixed five-node Raft model, current-term commits, new-leader no-op and crash/recovery.
- Seeded transport, symmetric partitions, jitter/loss, runtime safety observers and Worker.
- Export/import, rewind/branch, tests, portable demo and gated GitHub Pages deployment.

## v0.2 — delivered

- A spatial consensus observatory with an editorial frame, moving partition groups and live replica evidence.
- Six real protocol checkpoints demonstrating minority refusal, majority progress and conflict repair.
- Actual RPC payload inspection, delivery status and drop causes; next-event queue and exact event stepping.
- Current-state baseline comparison, keyboard navigation and reduced-motion behavior.
- 18 engine tests and 39 production browser tests, including full automatic-tour completion.
- Updated production screenshots, interview material and portable demonstration release.

## v0.3 — delivered

- Actual receive-branch decisions with accepted/rejected/ignored/dropped verdicts.
- Before/after node slices, including higher-term step-down, conflict truncation and commit advancement.
- Directed link cuts with independent reverse links and delivery-time failure of in-flight packets.
- Keyboard-operable 5×5 matrix, topology arrows and bounded RPC filters.
- 24 engine tests and 48 three-browser checks; 20 asymmetric seed tests and 100 mixed-fault exact benchmark replays.
- Recovering-lagging-node and asymmetric fixtures, production screenshots and updated release artifacts.

## v0.4 — implemented; cloud release pending

- Real packet hold/release/discard/duplication with invalidated scheduling identities and bounded held storage.
- A delivery workbench, actual RPC lineage, independent-voter proof and keyboard controls.
- A vote-echo scenario built through public actions; held replies restore through exact export/import.
- Delayed acknowledgement fixture that executes the stale-response guard without regressing replication.
- 33 engine tests and 66 three-browser cases passed locally (22 each, zero retries), plus 100 mixed-fault exact replays including packet controls.
- Independent review reproduced two lineage/selected-voter context regressions: 2/2 failed on the old UI, then 6/6 passed across three browsers after correction without retries.
- Final convergence checks all nodes online, matching logs/commit/applied/state and no held packets.
- Final-build local live-style and extracted portable browser acceptance passed. The portable gate uses its spawned server's IPC ready signal and allocated port; four local process probes passed without reusing another service.
- Public and portable cloud gates must pass before release; zero retries and 36 extra WebKit export/layout cases are configured.

## Next — fault exploration

- Generated adversarial schedules and failure shrinking into a minimal replay.
- Minimal failure traces connecting multiple local event slices.
- Replay checkpoint caching if measured historical rebuild cost warrants it.

## Later — protocol depth

- Snapshot installation/log compaction under interrupted transfer.
- Pre-vote and check-quorum with observable availability tradeoffs.
- Client request deduplication, linearizable reads and documented assumptions.
- Joint-consensus membership changes and configuration safety monitors.

## Research direction

- Differential traces against a separately implemented reference model.
- A bounded TLA+ or PlusCal model with checked fault schedules.
- Durable storage adapter with explicit fsync and recovery semantics in a separate runtime.

Only v0.1–v0.4 and the release pipeline are implemented. Runtime observation and sampled testing do not establish a formal proof.

## Release engineering

Production CI also builds and checks source ZIP, a Node-only portable demo, a complete Git bundle and SHA-256 checksums. New versions are published automatically after verification and Pages deployment. Existing public release artifacts remain unchanged.
