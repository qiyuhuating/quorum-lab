# Acceptance contract

The release is accepted when all checks below execute against the production build or the engine that production imports.

| Behavior                | Observable pass criterion                                                             | Automated evidence               |
| ----------------------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| Healthy replication     | One leader; proposed map update applied by all five nodes                             | Engine + browser tests           |
| Follower rejection      | Proposal to a follower changes no log                                                 | Engine test                      |
| Minority safety         | A leader in a two-node partition cannot commit a new proposal                         | Engine + browser tests           |
| Majority availability   | Three-node partition elects a new leader and commits                                  | Engine + browser tests           |
| Conflict repair         | Healing removes the old leader's pending divergent suffix; state machines agree       | Engine + browser tests           |
| Crash/recovery          | Stable term/vote/log preserved; recovered node catches up                             | Engine + browser tests           |
| Majority loss           | With three nodes offline, two cannot commit                                           | Engine test                      |
| All-node restart        | Committed history becomes applied again through a new-term no-op                      | Engine test                      |
| Seeded chaos            | Safety holds across 40 deterministic schedules; all live nodes converge after healing | Engine test                      |
| Exact replay            | Full snapshots match after export/import, including messages, traces and metrics      | Engine test + 100-seed benchmark |
| Rewind/branch           | Historical prefix restored; new branch does not inherit future writes                 | Engine + browser tests           |
| Untrusted replay        | Malformed, oversized or out-of-range data rejected before replacement                 | Engine + browser tests           |
| Keyboard                | SVG nodes activate by keyboard; protocol dialog closes on Escape                      | Browser tests                    |
| Responsive layout       | Document width fits 320, 390, 768 and 1440 px viewports                               | Browser tests                    |
| Pages-compatible assets | Worker and assets load from `/quorum-lab/`; no external asset requests                | Browser tests                    |

## Commands

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm run benchmark
```

The browser suite runs against the compiled `dist/` using the same portable static server shipped with the demo. Chromium, Firefox and WebKit run the same behavior tests. Benchmarks report host-specific wall time, virtual time and the tested seed count; they do not claim production distributed-system throughput.

See [validation.md](validation.md) for recorded results and [benchmark.json](benchmark.json) for measured numbers. CI repeats these deterministic gates before GitHub Pages deployment.

## v0.2 exhibit and debugging gates

| Behavior             | Observable criterion                                                 | Evidence               |
| -------------------- | -------------------------------------------------------------------- | ---------------------- |
| Six real checkpoints | 2/5 uncommitted minority, 3/5 applied majority, 5/5 healed agreement | Engine + browser tests |
| Event stepping       | Exactly the visible next live event executes; replay matches         | Engine + browser tests |
| RPC visibility       | Real fields/status and delivery-time partition cause                 | Engine + browser tests |
| Snapshot isolation   | Modifying observed payload cannot mutate protocol                    | Engine test            |
| Desktop hierarchy    | All five log rows and six chapters fit 1440 × 900                    | Browser tests          |
| Automatic guide      | Restarts, reaches final evidence and stops                           | Three browser engines  |
| Reduced motion       | Animation disabled; keyboard chapters still work                     | Three browser engines  |
| Baseline and branch  | Pinned observation persists; exported branch restores                | Browser tests          |

## v0.3 causal debugging gates

| Behavior                | Observable criterion                                                               | Evidence                          |
| ----------------------- | ---------------------------------------------------------------------------------- | --------------------------------- |
| Branch fidelity         | Vote/quorum/commit verdict comes from the executed branch with actual values       | Engine tests                      |
| Rejected prefix         | Missing prefix produces rejection and leaves log/commit unchanged, then catches up | Engine + browser tests            |
| Conflict slice          | Actual removed index exceeds prior commit; tail changes red → blue                 | Engine + browser tests            |
| Diagnostic isolation    | Mutating a returned transition cannot alter stored evidence                        | Engine test                       |
| Directional failure     | Cutting A→B leaves B→A enabled; in-flight packets get delivery-time cause          | Engine + browser tests            |
| Atomic input validation | Self-links, invalid IDs and non-boolean switches change no state/history           | Engine test                       |
| Diagnostic replay       | Full decisions, transitions and canonical cuts match exactly                       | Engine + 100-seed mixed benchmark |
| Matrix accessibility    | Keyboard toggles a direction; partition constraints remain locked                  | Three browser engines             |
