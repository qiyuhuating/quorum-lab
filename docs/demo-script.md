# A 90-second interview walkthrough

## 0–15 seconds: show the contradiction

Open the observatory and choose chapter 03. Point to the physically separated islands and the two leaders in different terms. The orange proposal has two replicas, so it cannot collect the required three acknowledgements. The accepted-write count and committed state are different concepts.

## 15–35 seconds: let the majority move

Choose chapter 04. `blue-route` is committed and applied on three nodes. The two minority nodes still carry `red-route` as a pending suffix. The log matrix and live evidence are independently calculated from actual node snapshots.

## 35–55 seconds: inspect the moment before repair

Choose chapter 05. Connectivity is restored, but virtual time remains 4.80 seconds and logs are still divergent. Fix the current state as a baseline, then execute the next protocol event. Inspect an actual AppendEntries payload, previous index/term and leader commit. The scheduler orders events by time and insertion sequence; it skips invalidated timers during event stepping.

## 55–70 seconds: show convergence

Choose chapter 06. All five logs agree and apply `blue-route`; the uncommitted `red-route` is removed. Open the protocol event stream to find conflict truncation. Explain the current-term commit rule and new-leader no-op.

## 70–90 seconds: reproduce and show evidence

Export the experiment, reset and import it. Rewind to a checkpoint and stop a node to create a different branch. Show the test/CI evidence and clarify the model's boundaries: fixed membership, simulated stable storage, no production disk IO or linearizable read API.

## Resume wording

> 独立设计并发布 Quorum Lab 共识观测台：以 TypeScript 实现五节点 Raft 确定性事件引擎，通过 Web Worker 驱动选举、复制与故障恢复；将分区与冲突日志修复呈现为六幕可交互实验，支持真实 RPC 取证、逐事件调试、历史回放与分支对照；使用 18 项协议测试、39 项多浏览器验收和 GitHub Actions 发布门禁交付。

Use current executed counts from validation.md. Describe a tested protocol model, not a production database or formally verified system.
