# Docs AGENTS

## 模块职责

`docs` 保存 Harness 的可审计执行记录、架构说明、运行手册、测试日志、MR Summary 和 Release Notes。

## 关键文件

- `architecture.md`
- `runbook.md`
- `task-flow.md`
- `agent-journal.md`
- `decision-log.md`
- `test-log.md`
- `generated-mr-summary.md`
- `release-notes.md`

## 修改注意事项

- 不记录完整私有思维链。
- 记录可审计摘要：命令、结果、失败现象、修复动作、后续计划。
- 测试失败和 Docker 阻塞必须写入 `test-log.md`。

## 常用命令

```bash
pnpm mr:summary
pnpm deploy:local
```

## 常见故障

- MR Summary 过期：运行 `pnpm mr:summary`。
- 测试日志缺失失败信息：补充命令、退出码、关键日志摘要和修复记录。
