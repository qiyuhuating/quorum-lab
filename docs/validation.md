# Executed validation — v0.2.0

Recorded on **2026-10-01 (Asia/Singapore)**. Local Windows host, Node **v24.16.0**, npm **11.3.0**. GitHub Actions repeats the verification gates on Ubuntu before publishing main: [workflow history](https://github.com/qiyuhuating/quorum-lab/actions/workflows/verify-and-deploy.yml).

| Gate                                   | Executed result                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| Strict TypeScript and production build | Passed; separate production Worker                                                |
| Engine tests                           | **18 passed**, including four observatory cases                                   |
| Existing seeded fault coverage         | **40 schedules**, safety and final convergence                                    |
| Production browser acceptance          | **39 passed**, 13 each in Chromium, Firefox and WebKit                            |
| Automatic tour                         | Restarts from final checkpoint, completes chapters and stops in each browser      |
| Real chapter evidence                  | Minority copies 2/5; majority applied 3/5; repaired application/log agreement 5/5 |
| Event step and RPC                     | Actual event identity/time, payload, drop causes and immutable views              |
| Replay and branching                   | Complete snapshots restored; steps export/import; invalid imports preserve state  |
| First desktop viewport                 | Complete network/log matrix and six chapters fit **1440 × 900**                   |
| Responsive widths                      | **320, 390, 768, 1440 px**, no document overflow in all three engines             |
| Keyboard and reduced motion            | Node/chapter activation, Escape close, decorative animation disabled              |
| Production subpath/assets              | `/quorum-lab/` and Worker work; **zero external asset requests**                  |
| Extended benchmark                     | **100 seeds**, 49.8 seconds virtual time each                                     |
| Runtime state checks                   | **523,843**                                                                       |
| Simulated messages                     | **402,771**                                                                       |
| Complete snapshot exact replays        | **100 / 100**, including payload/status and event queue                           |
| Detected safety violations             | **0**                                                                             |

## Evidence and measurement

[benchmark.json](benchmark.json) records this run. Richer packet/event observations add snapshot work. Host wall times measure the model and observers, not physical distributed-cluster throughput. Reproduce with `npm run benchmark`.

Protocol tests inspect actual logs and state machines at all six action prefixes, including minority conflicts immediately after reconnect. Event tests compare each executed event with the visible queue head, then replay the complete history. Packet tests mutate a returned payload and verify the stored protocol value remains intact; newly partitioned in-flight packets record a delivery-time drop.

Browser tests use compiled assets and the production Worker for writes, recovery, tour completion, chapters, RPC inspection, event steps, baseline comparison, branching and invalid imports. Playwright **1.63.0** bundles Chromium **1243**, Firefox **1543** and WebKit **2359**.

Screenshots and video in [media/](media/) come from the production app without staged visual edits. [capture-info.json](media/capture-info.json) records viewports and page-error results. [Experiment fixtures](experiments/) use the same production engine.

## Deployment evidence

The [public observatory](https://qiyuhuating.github.io/quorum-lab/) publishes only after formatting, protocol/browser tests and benchmark gates pass. [live-check.json](live-check.json) records the latest executed online browser check; its version identifies the checked release. Source and media are published through GitHub connector Git data operations.

## Limits

Fixed membership and simulated stable storage; no disk IO, membership changes, compaction, linearizable reads or exactly-once API. Sampled tests do not exhaustively prove all executions. Runtime safety observations collect evidence rather than formal verification.
