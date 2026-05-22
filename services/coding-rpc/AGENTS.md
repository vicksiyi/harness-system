# Coding RPC AGENTS

## 模块职责

模拟或封装编码执行步骤，生成 patch plan、变更摘要和下一步测试建议。当前实现是本地可审计模拟器，便于验证 Agent 闭环。

## 关键入口

- `src/server.ts`：`planAndPatch` RPC。

## 常用命令

```bash
pnpm --filter @harness/coding-rpc dev
pnpm typecheck
pnpm test
```

## 修改注意事项

- 输出应包含文件列表、步骤和测试建议。
- 真实接入 Agent 执行器时，仍要保留结构化 `CodingResult`。
- Bugfix 场景必须给出回归测试建议。

## 常见故障

- Patch plan 缺少文件：检查 requirements-rpc 的 `recommendedFiles`。
- 测试建议不完整：补充 `testSuggestions`。

