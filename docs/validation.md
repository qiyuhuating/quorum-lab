# Executed validation — v0.3.0

Recorded on **2026-10-02 (Asia/Singapore)**. Local Windows host, Node **v24.16.0**, npm **11.3.0**. GitHub Actions repeats the verification gates on Ubuntu before publishing main: [workflow history](https://github.com/qiyuhuating/quorum-lab/actions/workflows/verify-and-deploy.yml).

| Gate                                   | Executed result                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| Strict TypeScript and production build | Passed; separate production Worker                                                 |
| Engine tests                           | **24 passed**, including six causal/directed-fault cases                           |
| Existing seeded fault coverage         | **40 schedules**, safety and final convergence                                     |
| Asymmetric fault coverage              | **20 seeds**, safety, final convergence and full diagnostic replay                 |
| Production browser acceptance          | **48 passed**, 16 each in Chromium, Firefox and WebKit                             |
| Automatic tour                         | Restarts from final checkpoint, completes chapters and stops in each browser       |
| Real chapter evidence                  | Minority copies 2/5; majority applied 3/5; repaired application/log agreement 5/5  |
| Event step and RPC                     | Actual event identity/time, payload, drop causes and immutable views               |
| Causal slices                          | Actual vote/quorum/commit branches; red-to-blue repair; unchanged log on rejection |
| Directed cuts                          | Reverse link independent; in-flight drop; keyboard matrix; cuts restore on import  |
| Replay and branching                   | Complete snapshots restored; steps export/import; invalid imports preserve state   |
| First desktop viewport                 | Complete network/log matrix and six chapters fit **1440 × 900**                    |
| Responsive widths                      | **320, 390, 768, 1440 px**, no document overflow in all three engines              |
| Keyboard and reduced motion            | Node/chapter activation, Escape close, decorative animation disabled               |
| Production subpath/assets              | `/quorum-lab/` and Worker work; **zero external asset requests**                   |
| Extended benchmark                     | **100 seeds**, 49.8 seconds virtual time each                                      |
| Runtime state checks                   | **469,695**                                                                        |
| Simulated messages                     | **372,137**                                                                        |
| Complete snapshot exact replays        | **100 / 100**, including decisions, node transitions, cuts and event queue         |
| Detected safety violations             | **0**                                                                              |

## Evidence and measurement

[benchmark.json](benchmark.json) records this run. Richer packet/event observations add snapshot work. Host wall times measure the model and observers, not physical distributed-cluster throughput. Reproduce with `npm run benchmark`.

The v0.3 benchmark adds two directed cuts per ten-round fault cycle, combined with the existing partitions, jitter/loss and crash/recovery. Its event counts and timings are not directly comparable with the earlier schedule. The 20-seed unit case separately verifies eventual log/state-machine agreement after restoring a healthy network.

Protocol tests inspect actual logs and state machines at all six action prefixes, including minority conflicts immediately after reconnect. Event tests compare each executed event with the visible queue head, then replay the complete history. Packet tests mutate a returned payload and verify the stored protocol value remains intact; newly partitioned in-flight packets record a delivery-time drop.

Browser tests use compiled assets and the production Worker for writes, recovery, tour completion, chapters, RPC inspection, event steps, baseline comparison, branching and invalid imports. Playwright **1.63.0** bundles Chromium **1243**, Firefox **1543** and WebKit **2359**.

New browser cases step until a real repair/rejection branch, inspect its immutable transition and serialized RPC, toggle a directed cut by keyboard, export/import the cut and verify that a cross-partition matrix cell stays locked. One initial test failure was an overly exact selector for the existing icon-prefixed reset button; correcting the selector produced the recorded passing suite.

Screenshots and video in [media/](media/) come from the production app without staged visual edits. [capture-info.json](media/capture-info.json) records viewports and page-error results. [Experiment fixtures](experiments/) use the same production engine.

## Deployment evidence

The earlier v0.2 source passed verification and Pages deployment on Ubuntu in [run 36802348560](https://github.com/qiyuhuating/quorum-lab/actions/runs/36802348560). Its historical deployment check is retained in [live-check-v0.2.json](live-check-v0.2.json). The v0.3 publication uses the same verification → Pages → release gates. Current production validation is recorded in [live-check.json](live-check.json) with its explicit version.

The earlier portable ZIP was unpacked into a separate directory and verified with its bundled server. v0.3 automates this in the cloud: the published URL passes `scripts/verify-demo.mjs`, then `scripts/verify-portable.mjs` extracts the newly built ZIP and runs the same browser checks against its bundled server/Worker. The release contains both revision-stamped reports and their checksums. Public release creation requires these checks as well as source/demo ZIP and full Git-bundle integrity.

Source and media are published through GitHub connector Git data operations. Published release versions are preserved; unfinished draft releases can resume uploads before becoming public.

## Limits

Fixed membership and simulated stable storage; no disk IO, membership changes, compaction, linearizable reads or exactly-once API. Sampled tests do not exhaustively prove all executions. Runtime safety observations collect evidence rather than formal verification.

## Cloud stability follow-up — v0.3.1

Recorded on **2026-10-04 (Asia/Singapore)**. The first v0.3.0 cloud run reported **47 passed and 1 flaky**: WebKit's directed-cut export timed out once, then passed its configured retry. All four jobs and the separate public/portable acceptance succeeded in [run 37209224340](https://github.com/qiyuhuating/quorum-lab/actions/runs/37209224340). This retry outcome is not represented as 48 first-attempt passes.

The patch attaches the hidden download anchor to the document and keeps the blob URL available for 60 seconds before removing/revoking it. This addresses download startup lifetime; the original timeout alone does not establish a unique root cause. CI disables browser retries and repeats the WebKit export/import case twelve times. The final workflow and attached reports provide the executed result for that revision.
