# Orchestrator RPC AGENTS

## 模块职责

总编排服务。负责创建工作流、调用其它 RPC 服务、推进状态机、管理测试重试、生成 MR Summary / Release Notes、持久化运行记录。

## 关键入口

- `src/server.ts`：服务启动、RPC 方法、流程编排。

## RPC 方法

- `createWorkflow`
- `runWorkflow`
- `listWorkflows`
- `getWorkflow`
- `serviceHealth`

## 常用命令

```bash
pnpm --filter @harness/orchestrator-rpc dev
pnpm typecheck
pnpm test
```

## 修改注意事项

- 状态转移必须通过 `packages/workflow-core`。
- 调用其它服务时使用 `@harness/rpc-client`。
- 任何失败都要进入 `failed` 或 `blocked`，并记录 `blocker`。
- 持久化输出在 `.harness/runs` 和 `docs/*`。

## 测试方式

- 状态转移逻辑优先在 `packages/workflow-core/src/index.test.ts` 覆盖。
- 编排行为可通过 `pnpm workflow:requirement "<需求>"` 触发。

## 常见故障

- 依赖服务不可用：运行 `pnpm health`，查看 dependency health。
- 测试重试没有发生：检查 `decideAfterTest` 和 run attempts。

