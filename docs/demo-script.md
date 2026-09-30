# A 90-second interview walkthrough

## 0–15 seconds: a working system

Open the lab. Explain that the two starter writes were submitted to the actual model and replicated through the same protocol as every subsequent write. Point to the leader, current term, per-node log colors and identical applied state.

## 15–40 seconds: split the network

Choose **少数派隔离**. The former leader remains with one peer; three peers elect a new leader in a later term. The minority proposal stays pending. Explain that two leaders in different terms are allowed, while two elected leaders in the same term are forbidden.

Submit `signal=majority-safe` to the automatic highest-term leader. Run the experiment. The committed-write count increases and only the majority applies the new value.

## 40–60 seconds: recover and repair

Choose **恢复全部链路**. Observe the old leader stepping down, conflict truncation in the event stream and all five logs converging. The formerly pending minority value disappears. Explain the current-term commit rule and why every new leader adds a no-op.

## 60–75 seconds: reproduce the failure

Pause and export. Reset, import the JSON and show that virtual time, messages, logs and metrics return to the same state. Rewind to an earlier operation and take a different action to create a branch. The worker keeps replay computation away from the interface thread.

## 75–90 seconds: engineering evidence and boundaries

Show runtime safety checks, protocol tests, three-browser tests and the measured seed benchmark. Describe the distinction between sampled test evidence and a formal proof. This version models stable storage in memory and fixed membership; it is an executable educational model rather than a production database.

## Resume wording

> 独立设计并实现 Quorum Lab 分布式共识实验室：以 TypeScript 构建确定性 Raft 事件引擎，通过 Web Worker 驱动五节点选举与日志复制；支持网络分区、丢包、崩溃恢复、冲突日志修复、运行时安全检查及精确回放；使用协议测试、多浏览器回归与 GitHub Actions 验收交付。

Use specific test counts and measured numbers from `validation.md` only. Do not describe planned features, live public hosting, real disk durability or formal verification as completed until each is actually delivered.
