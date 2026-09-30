<div align="center">

# Quorum Lab

### Break the network. Watch consensus survive.

**让网络失联。让共识发生。**

TypeScript · React · Web Worker · Raft · Deterministic Replay

[![Verify and deploy](https://github.com/qiyuhuating/quorum-lab/actions/workflows/verify-and-deploy.yml/badge.svg)](https://github.com/qiyuhuating/quorum-lab/actions/workflows/verify-and-deploy.yml)

[运行项目](#运行项目) · [协议架构](docs/architecture.md) · [验收证据](docs/validation.md) · [演示脚本](docs/demo-script.md) · [路线图](docs/roadmap.md)

![Quorum Lab production UI](docs/media/desktop.png)

</div>

独立实现的五节点 Raft 共识实验室。每个节点维护自己的任期、投票与日志，通过有延迟、乱序、丢包和分区的模拟网络交换协议消息。在浏览器中停止一个节点、切开网络，再逐条观察选举、提交与日志修复。

项目与 `yihe-health` 完全独立：不同领域、独立源码、独立构建与部署。它把分布式协议、可复现调试和交互可视化放在同一个可运行作品里。

## 你能实际操作什么

- **打断多数派**：把旧领导者留在 2/5 少数派；观察它接受提案却无法提交，3/5 多数派重新选举并继续写入。
- **修复冲突日志**：恢复链路，观察旧领导者退位和未提交后缀被覆盖，五个节点重新收敛。
- **崩溃并恢复**：保留模拟稳定存储中的任期、投票与日志，清空易失状态，重启后重新同步。
- **调整消息网络**：改变虚拟延迟与随机丢包率，查看投票、复制、消息投递与提交 P95。
- **检查内部状态**：查看逐节点日志、commit/applied index、投票、复制进度与已提交状态机。
- **精确复现实验**：导出随机种子与完整操作序列，导入后恢复相同快照；回到任意操作，再创建不同分支。

![Partitioned cluster with leaders in different terms](docs/media/partition.png)

## 工程深度

| 设计                              | 为什么这样做                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| 独立协议核心                      | 选举与复制由 RPC 触发，UI 只发送操作并显示快照                           |
| 稳定最小堆 + 虚拟时钟             | 相同种子和操作有相同的事件顺序，能精确复现故障                           |
| 当前任期提交规则 + 新领导者 no-op | 通过多数派确认安全提交继承日志                                           |
| 带请求序号的 AppendEntries 响应   | 处理乱序回复，防止过期反馈回退复制进度                                   |
| Web Worker                        | 协议运算和历史重建与界面线程分离                                         |
| 历史安全观察器                    | 持续检查 election safety、leader completeness、log matching 与应用一致性 |
| 有界且预校验的回放格式            | 拒绝无效操作、超大输入与超长实验；错误导入保留当前实验                   |
| 同一生产构建的三浏览器验收        | 本地演示与 CI 都验证实际编译产物，包含仓库子路径和移动端宽度             |

详细算法、状态生命周期和实现边界见 [architecture.md](docs/architecture.md)。依据 [Raft 原论文](https://raft.github.io/raft.pdf) 的 Figure 2 与 §5.2–5.4 独立实现。

## 运行项目

需要 Node.js **22.12+**，CI 使用 Node 24。

```sh
npm ci
npm run dev
```

开发入口由终端给出。运行生产构建：

```sh
npm run build
npm run demo
```

打开 `http://127.0.0.1:4173/quorum-lab/`。Worker 需要 HTTP 环境，不能直接双击 `dist/index.html`。便携演示包提供启动脚本，无需安装 npm 依赖。

初始页面已通过真实选举与复制提交两个示例写入，并暂停等待操作。点击「运行」让虚拟时间前进；「单步」推进 100ms。实验最大虚拟时间为 120 秒，最多 6,000 次操作。

## 验证

```sh
npm run check
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
npm run benchmark
```

协议用例验证多数派、分区、崩溃恢复、全节点重启、冲突修复、回放和分支。浏览器用例验证真实界面、键盘、导入错误、生产 Worker、仓库子路径和 320/390/768/1440px 布局。

100 组额外确定性故障实验检查了 **523,843** 次状态转换、发送 **402,771** 条模拟消息，全部精确回放，未检测到安全违规。记录及测试数量见 [validation.md](docs/validation.md)，机器与时间数据见 [benchmark.json](docs/benchmark.json)。这些结果是模拟器的测试证据，不代表生产集群吞吐或形式化证明。

## 项目结构

```text
src/engine/    Raft、事件队列、输入验证、回放、Worker 协议
src/ui/        React 控制台、SVG 拓扑、快照桥接
tests/         协议与确定性故障测试
e2e/           三浏览器生产构建验收
scripts/       便携服务器、基准、演示素材采集
docs/          架构、验收、测量、展示素材与发布交接
.github/       验收与 GitHub Pages 发布流程
```

## 演示与发布

- [90 秒演示与简历表述](docs/demo-script.md)
- [真实界面录屏](docs/media/demo.webm)
- [移动端截图](docs/media/mobile.png)
- [GitHub 审查与选题依据](docs/github-audit.md)
- [新仓库发布步骤](docs/publish.md)

[GitHub 仓库](https://github.com/qiyuhuating/quorum-lab) 已创建。工作流对 `main` 的发布依赖全部验收通过；Pages 使用 GitHub Actions 部署。实时执行结果见上方状态与 [验收记录](docs/validation.md)。

## 实现范围

固定五节点、对称分区、基本 Raft、内存中的稳定存储模型和确定性字符串状态机。尚未实现真实磁盘 IO、快照压缩、成员变更、真实客户端发现、恰好一次语义和线性一致读。具体后续项见 [roadmap.md](docs/roadmap.md)。

## License

[MIT](LICENSE) © 2026 qiyuhuating
