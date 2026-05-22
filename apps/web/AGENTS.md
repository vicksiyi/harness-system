# Web Console AGENTS

## 模块职责

`apps/web` 是 Harness 的前端控制台。它直接展示工作流列表、运行详情、事件时间线、日志流、服务健康、测试结果、部署状态、最近 Agent 记录和 MR Summary 预览。

## 关键入口

- `src/main.ts`：无框架 TypeScript UI、RPC 调用和状态管理。
- `src/style.css`：工具型控制台样式。
- `index.html`：Vite 入口。

## 常用命令

```bash
pnpm --filter @harness/web dev
pnpm --filter @harness/web build
pnpm typecheck
```

## 修改注意事项

- 不要做营销页，首屏应是可操作控制台。
- 保持信息密度，优先展示任务、状态、健康、日志和 MR Summary。
- 所有按钮、输入和列表在移动端不能溢出。
- UI 文字应服务操作，不写冗长功能介绍。

## 测试方式

- 构建校验：`pnpm --filter @harness/web build`
- 类型校验：`pnpm typecheck`
- 端到端观察：启动 `pnpm dev:services` 和 `pnpm dev:web` 后访问 `http://localhost:5173`

## 上下游

- 上游：`services/orchestrator-rpc`
- 下游：用户和 Codex 观察闭环结果

## 常见故障

- 控制台显示 health unavailable：检查 orchestrator 是否在 `http://localhost:4100`。
- CORS 或 RPC 失败：确认服务使用共享 `createRpcServer`。

