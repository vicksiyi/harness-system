# Harness Requirement

当用户使用 `$harness-requirement ...` 或 `$harness requirement ...` 时，使用本 Skill。

## 输入格式

```txt
$harness-requirement <自然语言需求>
```

示例：

```txt
$harness-requirement 增加一个工作流运行详情页
```

## 适用场景

- 新增 Harness 功能。
- 扩展工作流状态、事件、日志、评分、部署前检查等编排能力。
- 增加目标产品页面、编辑能力或后端 RPC 能力。

## 渐进式读取

1. 读取根目录 `AGENTS.md`。
2. 读取 `harness-worktree/AGENTS.md`。
3. 读取 `services/requirements-rpc/AGENTS.md` 和 `packages/workflow-core/AGENTS.md`。
4. 如果需求涉及 UI，读取 `apps/mindmap-editor/AGENTS.md`。
5. 如果需求涉及部署，读取 `services/deploy-rpc/AGENTS.md`。

## 执行命令

```bash
pnpm workflow:requirement "<需求>"
```

## 测试与修复

1. 查看 `.harness/runs/<run-id>.json`。
2. 若失败，读取 `.harness/logs/dev-services.log` 和 `docs/test-log.md`。
3. 先添加或更新单测，再实现修复。
4. 运行 `pnpm typecheck`、`pnpm test`、`pnpm target:build`。
5. 重新运行原始 workflow。

## MR Summary

必要时运行：

```bash
pnpm mr:summary
```

完成标准：

- 需求被结构化为验收标准。
- Workflow 到达 `completed`，或在文档中记录明确 blocker。
- `docs/generated-mr-summary.md`、`docs/release-notes.md`、`docs/agent-journal.md`、`docs/test-log.md` 已更新。
