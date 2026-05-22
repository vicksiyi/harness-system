# Workflow Core AGENTS

## 模块职责

`packages/workflow-core` 是工作流状态机和闭环决策核心。它负责创建 run、推进 stage、决定测试后是修复还是总结、生成 MR Summary 和 Release Notes。

## 关键入口

- `src/index.ts`：状态机、转换、评分、摘要生成。
- `src/index.test.ts`：状态机和重试决策单测。

## 常用命令

```bash
pnpm test packages/workflow-core/src/index.test.ts
pnpm typecheck
```

## 修改注意事项

- 先改测试，再改状态机。
- `allowedTransitions` 是行为契约，新增 stage 必须补测试。
- `terminalStages` 不能再转移。
- MR Summary 和 Release Notes 输出要保持可读、可审计。

## 常见故障

- Invalid workflow transition：检查前一阶段是否符合 `allowedTransitions`。
- 重试次数异常：检查 `attachTestResult` 和 `decideAfterTest`。

