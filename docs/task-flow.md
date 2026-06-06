# Task JSON Flow

每次 Harness workflow 都会生成一个稳定任务文件：

```txt
.harness/tasks/<run-id>.json
```

这份 JSON 是 Skill 和 Agent 的执行轨道，目的是避免只靠提示词推进流程时跑偏。

## 标准 Flow

```txt
intake
-> requirement-analysis
-> test-case-generation
-> implementation-planning
-> coding
-> automated-testing
-> quality-validation
-> git-change-review
-> git-commit
-> git-push
-> mr-summary
-> mr-create
-> deployment
-> execution-record
```

## 关键字段

- `currentStepId`：当前应该处理的步骤。
- `flow.steps[]`：每一步的职责、输入、输出、命令、质量门、状态和证据。
- `acceptanceCriteria[]`：由 requirements-rpc 生成的验收标准。
- `testCases[]`：由 workflow-core 根据验收标准和风险生成的测试矩阵。
- `artifacts`：run JSON、task JSON、Git record、MR Summary、Release Notes、测试日志和执行日志路径。
- `blockers[]`：无法自动继续时的阻塞原因。

## 执行规则

1. Skill 先读 `.harness/tasks/<run-id>.json`，再执行当前步骤。
2. 不跳过 `test-case-generation` 和 `quality-validation`。
3. `quality-validation` 不规定固定路径，只规定要留下任务相关证据。
4. `git-change-review` 只记录边界和建议，不自动提交无关改动。
5. `git-commit` 必须基于显式文件列表，`git-push` 和 `mr-create` 必须记录结果或阻塞原因。
6. 失败要写入 step evidence、`docs/test-log.md` 和 `docs/agent-journal.md`。
7. 修复后重跑同一验证，直到通过或记录 blocker。

## 示例片段

```json
{
  "schemaVersion": 1,
  "taskId": "run_example",
  "currentStepId": "quality-validation",
  "flow": {
    "steps": [
      {
        "id": "quality-validation",
        "status": "in_progress",
        "commands": [
          "pnpm quality:agent-browser:doctor",
          "agent-browser commands chosen by the Agent"
        ],
        "qualityGates": [
          "Validation plan is task-specific, not a hard-coded path.",
          "Any visual or E2E failure is fixed and rerun."
        ],
        "evidence": []
      }
    ]
  }
}
```
