# Harness Worktree AGENTS

## 模块职责

`harness-worktree` 是 Agent 闭环执行总入口。当前实现为 worktree-like 目录，负责流程编排脚本、Skill 背后的执行器、MR Summary 生成和部署验证。

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
- 失败必须写入 `docs/agent-journal.md` 和 `docs/test-log.md`。
- 如果迁移为真实 git worktree，可用：

```bash
git worktree add ../harness-system-worktree main
```

然后将 `harness-worktree` 的脚本保留为流程入口或迁移到真实 worktree 根目录。

## 常见故障

- 服务启动超时：查看 `.harness/logs/dev-services.log`。
- workflow 脚本退出 1：读取 `.harness/runs/<run-id>.json` 的 `blocker`。

