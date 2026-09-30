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

See [validation.md](validation.md) for recorded results and [benchmark.json](benchmark.json) for measured numbers. CI repeats the deterministic gates before Pages deployment; remote CI cannot run until the new GitHub repository exists.
