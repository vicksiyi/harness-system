# Harness Bugfix

当用户使用 `$harness-bugfix ...` 或 `$harness bugfix ...` 时，使用本 Skill。

## 输入格式

```txt
$harness-bugfix <Bug 描述或失败日志>
```

示例：

```txt
$harness-bugfix 测试服务日志解析失败
```

## 适用场景

- RPC 服务失败。
- 测试失败。
- 日志解析失败。
- Docker 或健康检查失败。
- 目标产品 UI 展示异常。

## 渐进式读取

1. 读取根目录 `AGENTS.md`。
2. 读取 `harness-worktree/AGENTS.md`。
3. 优先读取 `services/testing-rpc/AGENTS.md`，确认日志解析和失败归因规则。
4. 根据失败模块继续读取对应 AGENTS 文件。
5. 若涉及编排状态，读取 `packages/workflow-core/AGENTS.md` 和 `services/orchestrator-rpc/AGENTS.md`。

## 执行命令

```bash
pnpm workflow:bugfix "<Bug 描述或失败日志>"
```

## 日志读取

重点检查：

- `.harness/runs/<run-id>.json` 的 `tests.failures[]`
- `.harness/logs/dev-services.log`
- `docs/test-log.md`

## 修复规则

- 先写或更新回归单测，再修改实现。
- 日志解析类 Bug 必须让 `testing-rpc` 返回结构化 `ParsedFailure`。
- 修复后运行 `pnpm typecheck`、`pnpm test` 和相关 build。
- 重新执行同一 bugfix workflow。
- 如果仍失败，记录证据、原因、下一步，不要假装通过。

## 完成标准

- 失败可以复现或有明确日志签名。
- 根因摘要写入执行记录。
- 回归测试覆盖失败签名。
- MR Summary 和 Release Notes 已刷新。
