# Quorum Lab v0.4.0 — The delivery is yours

**[Live observatory](https://qiyuhuating.github.io/quorum-lab/)** · [Source and architecture](https://github.com/qiyuhuating/quorum-lab)

An adversarial message scheduler for the independent five-node Raft laboratory.

- Hold a real RPC while protocol timers continue, release it at a chosen delay, discard it without invoking the receiver, or copy the complete payload into an independent transmission.
- Scheduling identities invalidate obsolete heap records: releasing to the original deadline still delivers once. Held storage survives forensic-history eviction; limits and unavailable packet references reject before history mutation.
- A delivery board shows intercepted messages, upcoming arrivals, provenance and actual independent voters. An RPC lineage diagram distinguishes physical copies from logical voters/requests.
- The vote-echo exhibit intercepts four real granted replies. One reply and two copies yield only 2/3 independent votes; copies run `duplicate-vote`. Another peer reply reaches 3/3 and elects the candidate.
- A delayed-ack fixture lets newer confirmations overtake a held AppendResponse. The late reply executes `stale-rpc` without regressing replication or changing receiver state.
- Seed/action replay restores held storage, copies, decisions and ordering exactly. Invalid replay references preserve the current experiment and original future.
- Actual production screenshots/video, mobile console, two generated replay fixtures and a two-minute interview walkthrough accompany the implementation.
- Local verification passed **33 engine tests** and **66 production browser checks** (22 per browser, 50.5 seconds, zero retries). CI adds **36 WebKit export/layout checks**, configured without retries; v0.4 cloud gates are pending at preparation of this record.
- Independent review reproduced two UI context regressions: selected original/copy families could show another lineage, and vote proof could show another reply recipient during simultaneous leader terms. The old UI failed both cases; the repaired UI passed **6/6** targeted checks across three browsers without retries.
- A first 66-case run exposed a baseline-capture race (**65 passed / 1 failed**). Capture is now disabled during pending replay; the existing test holds/releases the real Worker request and checks the correct checkpoint before capture. The subsequent complete run passed 66/66.
- The 100-seed combined-fault benchmark includes **800 holds, 800 releases, 800 copies and 898 discards**, **463,370 state checks** and **365,633 physical messages**. All snapshots replay exactly; no safety violation detected.
- Final convergence also requires every node online, identical logs and state machines, equal commit/applied indices and empty held storage.
- Portable verification uses a dynamic port and an IPC ready message from the actual spawned extracted server. Startup failure or early exit rejects; runtime exit terminates the owned verifier. Four actual local process probes passed, including an occupied endpoint receiving zero requests and `EADDRINUSE` producing no ready signal.
- The final production build and independently extracted portable ZIP passed local browser acceptance. Both reports mark revision verification false for local execution, with all new checks passed, responsive widths 320/390/768/1440px and no page/network/external errors.
- The exact public revision and extracted portable ZIP must exercise echo, held export/import, discard and delayed acknowledgement before publication. Revision-stamped reports and artifacts will be covered by SHA-256 checksums; no v0.4 cloud pass is claimed in this preparation record.

Source/media are published using the connected GitHub blob/tree/commit/ref tools. The gated Actions pipeline performs deployment, acceptance, packaging and release publication in the cloud.

Scope: fixed membership and simulated stable storage. Transport control and event explanations are model/test instrumentation. No real disk durability, member reconfiguration, client exactly-once semantics, linearizable reads or formal correctness proof.
