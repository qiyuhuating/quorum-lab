# Executed validation

## v0.4.0 — adversarial delivery

Recorded across **2026-10-04–05 (Asia/Singapore)**, Windows/Node **v24.16.0**. Local production verification has no cloud revision marker; the cloud gate separately requires the exact `GITHUB_SHA` marker and tests the public URL and newly extracted portable ZIP.

At this record's preparation, v0.4 has not been published and its cloud gates have not run. The final complete local browser run passed **66/66 cases**, 22 per browser, in **50.5 seconds**, with zero retries. Strict types, all 33 engine tests and the production build also passed again after the corrections below.

| Gate                                         | Executed local result                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Strict types, engine suite, production build | Passed; **33 engine tests**                                                                  |
| Production browsers                          | **66 passed**, 22 per Chromium/Firefox/WebKit; 50.5 seconds, zero retries                    |
| Deadline invalidation                        | Hold past deadline; release at original deadline executes once                               |
| Independent voters                           | Original + two copies = 2/3; distinct peer = elected 3/3                                     |
| Delayed acknowledgement                      | Actual `stale-rpc`; receiver state/confirmed indices unchanged                               |
| Delivery faults                              | Cut/offline cause after release; discard bypasses receiver                                   |
| Storage/validation                           | Held record survives eviction; bound/unavailable references reject atomically                |
| Exact replay                                 | Held records, copies, decisions and ordering fully restored                                  |
| Responsive/keyboard                          | 320/390/768/1440px; keyboard release; no document overflow                                   |
| Combined-fault benchmark                     | **100 / 100** exact replays; **0** detected violations                                       |
| Final convergence                            | All five online; identical logs, commit/applied indices and state machines; no held messages |
| State checks / physical messages             | **463,370 / 365,633**                                                                        |
| Packet operations                            | Holds/releases **800 each**, copies **800**, discards **898**                                |
| Local live-style and portable acceptance     | Final build and independently extracted ZIP passed; zero page/network/external errors        |

[benchmark.json](benchmark.json) records this round's schedule and measured host timings. It combines partitions, directed cuts, crash/recovery, jitter/loss and targeted packet controls. Counts differ from v0.3 because the schedule changed. Wall times include model/observer/snapshot work and do not measure physical-cluster throughput.

The browser export case also imports an otherwise valid document with an unavailable packet reference. Replay fails in a temporary simulator, preserving held state and original history. Both fixtures are generated through public actions with `npm run fixtures`.

CI is configured to repeat the directed-cut WebKit export, held-packet export and live fault-control layout cases twelve times each, with zero retries. Public and portable gates must exercise the new controls plus the delayed-ack case before release publication. Once executed, workflow output and downloadable revision-stamped reports will provide cloud evidence: [workflow history](https://github.com/qiyuhuating/quorum-lab/actions/workflows/verify-and-deploy.yml), [v0.4.0 release target](https://github.com/qiyuhuating/quorum-lab/releases/tag/v0.4.0). No v0.4 cloud pass is claimed here.

Updated [media](media/) records the compiled application, actual original/copy lineage, the 2/3→3/3 transition and mobile console. [Design and acceptance](transport-design.md) states behavior and limits.

### v0.4 layout regression and correction

A final local run initially returned **59 passed / 1 failed**. The WebKit minority/heal case exhausted its 30-second test budget. Trace showed about 27 seconds spent trying to click a fault control whose position changed during live updates. A separate WebKit measurement observed roughly 21px of movement while messages/timer explanations changed.

The causal observation pane now has a bounded, keyboard-scrollable viewport; selected-message and vote-proof areas reserve their dimensions. The same measurement then observed zero movement and a 160ms heal click. The browser case asserts control-position stability during continued auto-run; CI repeats it twelve times without retries, alongside both export checks (**36 additional WebKit cases** total). All twelve local repetitions passed in 57.1 seconds. Final full-suite and cloud gates still require zero retries.

### Independent review: two context regressions

Two new browser cases failed against the old UI (**2/2 failed**):

- With two held original/copy families, selecting an original or copy could leave the lineage graph on another family. The regression now asserts the selected original ID, sender/receiver and both retained family records.
- With leaders in two simultaneous terms, selecting a held vote reply could show the higher-term leader's votes rather than the selected reply's recipient. The regression now asserts recipient identity, current term/role, vote count and the exact counted voter IDs; event stepping restores the default highest-term context.

After correction, both cases passed in Chromium, Firefox and WebKit (**6/6 passed**, zero retries). They raise the complete production suite from the earlier 60 cases to **66**, 22 per browser. These targeted results preceded the final complete run, which passed all 66 cases.

### Final-suite regression: capturing a baseline during replay

The first complete 66-case run returned **65 passed / 1 failed**. While chapter 05 was still loading through the Worker, the baseline button could capture the initial **2.20s** snapshot; the chapter then reached **4.80s**, and event stepping exposed the incorrectly captured comparison. This was a real asynchronous UI race.

The baseline control is now disabled while the Worker request is pending. The existing regression case deliberately holds the real `story` request, asserts the control is disabled, releases the request, waits for **4.80s**, and then captures the baseline. It exercises the production Worker rather than injecting a staged snapshot, and adds no new case to the total. After the fix, the final full run passed **66/66** in **50.5 seconds** with zero retries. Types, the 33 engine tests and the production build passed again. Final-build local public-style/portable acceptance subsequently passed; cloud gates remain pending.

### Independent review: stronger convergence and portable identity

The benchmark's final convergence gate previously compared only logs and detected violations. It now also rejects any offline node, nonempty held storage, unequal commit positions, `lastApplied !== commitIndex`, or unequal state machines. All node logs must still match, and the complete observed snapshots must replay exactly. The fault schedule is unchanged.

Portable verification previously waited only for process creation on a fixed port. A bind failure could occur afterward and leave a verifier connecting to another running service. The bundled server now binds `PORT=0`, prints its actual bound URL and sends a structured IPC readiness message to its parent. The verifier accepts only that spawned child's readiness signal, uses its allocated address, rejects startup failure/timeout/early exit, and terminates its owned browser-verifier process if the server exits during acceptance. Cleanup waits for its own processes and removes only its created temporary directory.

Four actual local process probes passed using temporary ZIPs and owned random ports:

1. The verifier fetched the extracted marker from its allocated server; an occupied service received zero requests, and the owned URL refused connections after cleanup.
2. A server startup exception rejected before the verifier started.
3. Server exit 19 during verification rejected and left no live verifier PID.
4. An occupied-port bind returned `EADDRINUSE` and exit 1 without emitting ready, even though process creation had succeeded.

These are local process-lifecycle checks. They do not claim that the pending v0.4 public or portable cloud browser gates have passed.

The final production build passed local live-style acceptance at **2026-10-05T12:24:19.740Z**. The independently extracted portable ZIP passed the same browser gate at **2026-10-05T12:25:04.216Z**, using the owned server's IPC-assigned port **56679**. Both reports identify v0.4.0 with `revision: null` and `revisionMarkerVerified: false`, as expected for local execution. The new echo/export/discard/stale-ack checks passed; document width equaled viewport width at 320/390/768/1440px. Each report ended with **836 checks / 0 violations** and empty page-error, failed-request, bad-response and external-request lists. The cloud gate still requires the actual published `GITHUB_SHA` marker.

## Historical v0.3.0

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

[benchmark-v0.3.json](benchmark-v0.3.json) records this historical run. Richer packet/event observations add snapshot work. Host wall times measure the model and observers, not physical distributed-cluster throughput. Reproduce with `npm run benchmark`.

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
