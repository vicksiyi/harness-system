# Harness Worktree

这是 Harness 的 Agent 闭环执行入口。当前目录是 worktree-like 结构，用于集中放置流程说明和脚本；如果之后需要真实 git worktree，可执行：

```bash
git worktree add ../harness-system-worktree main
```

## 主要命令

```bash
pnpm workflow:requirement "增加一个工作流运行详情页"
pnpm workflow:bugfix "测试服务日志解析失败"
pnpm workflow:polish "优化前端任务状态展示"
```

这些命令是 Codex Skill 的底层执行器，用户主要入口仍然是：

```txt
$harness requirement ...
$harness bugfix ...
$harness polish ...
```

## 执行闭环

1. 读取根目录 `AGENTS.md`。
2. 按任务类型读取 `workflows/*.md`。
3. 检查或启动 RPC 服务。
4. 调用 `orchestrator-rpc`。
5. 持久化 `.harness/runs/<run-id>.json`。
6. 更新 `docs/agent-journal.md`、`docs/test-log.md`、`docs/generated-mr-summary.md`、`docs/release-notes.md`。

