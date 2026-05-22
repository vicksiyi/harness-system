# Mindmap RPC AGENTS

## 模块职责

`services/mindmap-rpc` 是产品样例的后端服务，和 Harness 编排服务隔离。它通过 JSON-RPC 提供多脑图文件能力，并把文件、节点和版本号存储在本地 SQLite 数据库中。

## 关键入口

- `src/store.ts`：SQLite schema、读写事务、版本校验和节点规范化。
- `src/store.test.ts`：数据库行为单测，新增存储能力先补这里。
- `src/server.ts`：JSON-RPC 方法和健康检查。

## RPC 方法

- `listMaps`
- `getMap`
- `createMap`
- `saveMap`
- `deleteMap`

## 常用命令

```bash
pnpm --filter @target/mindmap-rpc dev
pnpm test services/mindmap-rpc/src/store.test.ts
```

## 修改注意事项

- 本服务属于产品样例，不要引入 Harness workflow、Agent 或 Codex UI 概念。
- 数据库默认路径是 `.harness/mindmap/mindmaps.sqlite`，测试必须使用临时路径。
- `saveMap` 使用 `baseVersion` 做乐观并发检查；后续 DIFF 协同时应复用版本字段。
- Schema 变更必须保持旧数据可迁移，并补存储层测试。

## 下一级上下文

- 前端：`apps/mindmap-editor/AGENTS.md`
- RPC 基础：`packages/shared/src/index.ts`
- 浏览器门禁：`harness-worktree/scripts/browser-quality-check.mjs`

## 常见故障

- 前端显示 RPC offline：确认 `http://localhost:4105/health` 可访问。
- 版本冲突：读取最新 `getMap` 后再保存，或在协同层合并 DIFF。
- 数据库写入失败：检查 `.harness/mindmap` 目录权限和 SQLite 文件锁。
