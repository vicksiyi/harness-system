---
name: harness-requirement
description: "当用户使用 $harness-requirement 或 $harness requirement 提出新需求时使用；负责通过 Harness 编排完成需求理解、验收标准、实现、测试、浏览器验证、MR Summary、部署记录和可审计执行日志。"
metadata:
  short-description: "运行 Harness 需求闭环"
---

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

执行后必须读取：

```txt
.harness/tasks/<run-id>.json
```

按 task JSON 的 flow 执行，不要跳过 `test-case-generation`、`quality-validation`、`git-change-review`、`execution-record`。

## 测试与修复

1. 查看 `.harness/runs/<run-id>.json`。
2. 查看 `.harness/tasks/<run-id>.json`，确认当前 step、testCases 和 quality gates。
3. 若失败，读取 `.harness/logs/dev-services.log` 和 `docs/test-log.md`。
4. 先添加或更新单测，再实现修复。
5. 运行 `pnpm typecheck`、`pnpm test`、`pnpm target:build`。
6. 使用 `harness-quality` Skill 自主设计 E2E / 截图 / network 验证。
7. 重新运行原始 workflow。

## MR Summary

必要时运行：

```bash
pnpm mr:summary
```

完成标准：

- 需求被结构化为验收标准。
- Workflow 到达 `completed`，或在文档中记录明确 blocker。
- `.harness/git/<run-id>.json`、`docs/generated-mr-summary.md`、`docs/release-notes.md`、`docs/agent-journal.md`、`docs/test-log.md` 已更新。
