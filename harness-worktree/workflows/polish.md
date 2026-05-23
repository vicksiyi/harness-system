# Polish Workflow

输入：体验、文案、UI、DX、性能或流程可观察性改进。

步骤：

1. orchestrator-rpc 创建 `.harness/tasks/<run-id>.json`，固定 polish flow。
2. 评估影响面。
3. 选择 UI、文案、性能、DX 或流程改进路径。
4. 生成 `testCases[]` 和 `quality-validation` 计划占位。
5. 先补测试或明确手工检查项。
6. 实现最小可验证改动。
7. 运行构建、类型检查和测试。
8. 使用 `harness-quality` Skill 根据改动自主选择 agent-browser snapshot、截图、console、network 或 diff 验证。
9. 生成改进记录、MR Summary、Release Notes 和 task JSON 证据。

本地命令：

```bash
pnpm workflow:polish "<优化目标>"
```
