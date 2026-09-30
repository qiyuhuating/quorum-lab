# Repository audit and project selection

Audit date: 2026-09-30 (Asia/Singapore). Source: the user's authenticated GitHub connector, repository README/root contents, and the public [profile](https://github.com/qiyuhuating).

| Repository               | Observed focus                                                               | Implication for this project                                              |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `yihe-health`            | Community care frontend and Python/SQLite HTTP baseline                      | Choose a different domain and original codebase                           |
| `qiyuhuating`            | Profile README emphasizing frontend delivery, tests and Pages                | Add systems/algorithm depth to the portfolio                              |
| `LZ-litchi`              | Existing Java/Spring development platform; README credits its upstream basis | Avoid another generic administration/CRUD platform                        |
| `github_vps`             | Upstream-based VM/VPS experiment                                             | Avoid another environment launcher                                        |
| `Useful-Tools`           | Tool archive                                                                 | Build a maintained, executable engineering artifact                       |
| Private learning archive | Introductory webpage experiment                                              | Build a distinct algorithmic project with source and automated acceptance |

Quorum Lab was selected to show protocol implementation, deterministic simulation, failure analysis, worker boundaries, replay validation, visual communication and reproducible delivery. It uses no files, APIs, backend, data or deployment from `yihe-health`.

## Connector capability finding

The current GitHub connector exposes repository reads, branch creation, blobs, trees, commits, ref updates, contents writes, issues and pull requests. It exposes **no create-repository operation**. Its generic fetch operation accepts GET-only approved repository endpoints and cannot substitute a repository-creation POST. No existing repository was modified to simulate a new project.

The supplied ChatGPT reference preview was empty, and this session has no callable `read_thread` tool. This project follows the user's complete current instructions and live GitHub audit rather than claiming to have read the earlier conversation.

## Ready for publication

Proposed repository: `qiyuhuating/quorum-lab`, public, MIT.

Description: `A deterministic Raft consensus lab: fault injection, real log replication, safety invariants, and exact experiment replay. TypeScript + React + Web Worker.`

Topics: `raft`, `distributed-systems`, `consensus`, `typescript`, `react`, `web-worker`, `fault-injection`, `deterministic-simulation`, `playwright`, `github-pages`.

The empty public repository [qiyuhuating/quorum-lab](https://github.com/qiyuhuating/quorum-lab) was created using the user's existing authenticated GitHub CLI login, which supplies the creation operation missing from the connector. Source and media uploads use the GitHub connector. See [publish.md](publish.md) for the delivery workflow and [validation.md](validation.md) for execution evidence.
