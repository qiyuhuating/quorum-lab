# A two-minute interview walkthrough

## 0–20 seconds: show the contradiction

Open the observatory and choose chapter 03. Point to the physically separated islands and the two leaders in different terms. The orange proposal has two replicas, so it cannot collect the required three acknowledgements. The accepted-write count and committed state are different concepts.

## 20–40 seconds: let the majority move

Choose chapter 04. `blue-route` is committed and applied on three nodes. The two minority nodes still carry `red-route` as a pending suffix. The log matrix and live evidence are independently calculated from actual node snapshots.

## 40–65 seconds: inspect the moment before repair

Choose chapter 05. Connectivity is restored, but virtual time remains 4.80 seconds and logs are still divergent. Fix the state as a baseline. Step until the causal slice says “截断冲突后缀”: the receiver tail changes `red-route` → `blue-route`, its term increases, and its commit/applied positions advance. Select “冲突修复” in RPC filters to inspect the exact historical message. The scheduler skips invalidated timers and orders active events by time and insertion sequence.

## 65–80 seconds: show convergence

Choose chapter 06. All five logs agree and apply `blue-route`; the uncommitted `red-route` is removed. Cut N1→N2 in the matrix: the reverse cell remains enabled and the topology marks the disabled direction. Explain why an accepted RPC, an accepted client proposal and a committed entry are three different observations.

## 80–105 seconds: make a vote echo

Load the vote echo in the message scheduler. Show one original reply and two full-payload copies in the lineage diagram: both copies run `duplicate-vote`, and the candidate remains at 2/3 independent votes. Select another held peer reply, set delay to 1ms, release it and step one event. Only then does the candidate reach 3/3 and become leader. The fixture uses ordinary protocol actions; no votes or roles are assigned by the interface.

## 105–120 seconds: reproduce and show evidence

Export the experiment, reset and import it. Rewind to a checkpoint and stop a node to create a different branch. Show the test/CI evidence and clarify the model's boundaries: fixed membership, simulated stable storage, no production disk IO or linearizable read API.

If asked about review, show the two new context regressions: selecting either an original or a copy keeps its own lineage; selecting a vote reply chooses that recipient's current votes even when two leaders coexist. Both failed on the old UI and passed 6/6 checks after correction across three browsers without retries. The final complete local suite passed 66/66 cases, 22 per browser, without retries. Distinguish these executed local results from the pending cloud gates.

The 100-seed recovery gate checks all nodes online, matching logs/commit/applied/application state and no held messages. Portable acceptance gets a dynamic address from its own spawned server's IPC ready signal. Four actual process probes checked identity, startup failure, runtime exit and occupied-port rejection.

## Resume wording

> 独立设计实现 Quorum Lab 共识观测台：以 TypeScript 实现五节点 Raft 确定性事件引擎，通过 Web Worker 驱动协议；构建六幕分区/修复实验与对抗消息调度，支持真实 RPC 谱系、重复选票与旧确认乱序取证、精确回放；构建 33 项协议测试、66 项多浏览器验收用例、100 种混合故障精确回放和云端发布门禁。

Use current executed counts from validation.md. Describe a tested protocol model, not a production database or formally verified system.
