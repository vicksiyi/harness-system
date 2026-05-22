# Harness Polish

当用户使用 `$harness-polish ...` 或 `$harness polish ...` 时，使用本 Skill。

## 输入格式

```txt
$harness-polish <UI、文案、DX、性能或流程优化目标>
```

示例：

```txt
$harness-polish 优化前端任务状态展示
```

## 适用场景

- 优化前端控制台的信息密度和可读性。
- 改善状态、日志、测试、部署展示。
- 改善脚本、文档、Skill 调用体验。
- 改善流程编排可观察性。

## 渐进式读取

1. 读取根目录 `AGENTS.md`。
2. 读取 `harness-worktree/AGENTS.md`。
3. UI 相关任务读取 `apps/web/AGENTS.md`。
4. 流程相关任务读取 `packages/workflow-core/AGENTS.md` 和 `services/orchestrator-rpc/AGENTS.md`。
5. 文档相关任务读取 `docs/AGENTS.md`。

## 执行命令

```bash
pnpm workflow:polish "<优化目标>"
```

## 校验方式

UI polish 至少运行：

```bash
pnpm --filter @harness/web build
pnpm typecheck
pnpm test
```

流程 polish 至少运行：

```bash
pnpm typecheck
pnpm test
pnpm workflow:polish "<优化目标>"
```

## 约束

- 控制台是工具型产品，不要做营销页。
- 第一屏优先展示任务、状态、日志、健康和 MR Summary。
- 不要引入与现有架构不匹配的新抽象。
- 改动要有测试或明确的手工检查记录。

## 输出

完成后刷新：

- `docs/generated-mr-summary.md`
- `docs/release-notes.md`
- `docs/test-log.md`
- `docs/agent-journal.md`

