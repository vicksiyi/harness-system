# Harness Worktree AGENTS

## 模块职责

`harness-worktree` 是 Agent 闭环执行总入口。当前实现为 worktree-like 目录，负责流程编排脚本、Skill 背后的执行器、MR Summary 生成和部署验证。

默认目标项目是 `apps/mindmap-editor`。Harness 负责编排，Mind Map Studio 是被 Agent 持续开发的产品样例。可以通过环境变量切换目标：

```bash
HARNESS_TARGET_PROJECT=apps/mindmap-editor pnpm workflow:requirement "<需求>"
```

## 关键入口

- `scripts/run-workflow.mjs`
- `scripts/create-mr-summary.mjs`
- `scripts/deploy.mjs`
- `scripts/health-check.mjs`
- `scripts/install-skills.mjs`
- `workflows/requirement.md`
- `workflows/bugfix.md`
- `workflows/polish.md`

## 常用命令

```bash
pnpm workflow:requirement "<需求>"
pnpm workflow:bugfix "<Bug 或日志>"
pnpm workflow:polish "<优化目标>"
pnpm mr:summary
pnpm deploy:local
pnpm skills:install
```

## 修改注意事项

- 脚本要能从仓库根目录稳定运行。
- 普通需求、Bugfix、Polish 默认作用于 `apps/mindmap-editor`。
- 失败必须写入 `docs/agent-journal.md` 和 `docs/test-log.md`。
- 如果迁移为真实 git worktree，可用：

```bash
git worktree add ../harness-system-worktree main
```

然后将 `harness-worktree` 的脚本保留为流程入口或迁移到真实 worktree 根目录。

## 常见故障

- 服务启动超时：查看 `.harness/logs/dev-services.log`。
- workflow 脚本退出 1：读取 `.harness/runs/<run-id>.json` 的 `blocker`。
- Agent 执行跑偏：读取 `.harness/tasks/<run-id>.json`，按 `currentStepId` 和 `flow.steps[]` 恢复执行轨道。
