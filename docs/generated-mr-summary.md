# MR Summary: Harness System Initial Build

## 需求背景

创建一个可本地运行、Docker 部署、可由 Codex Skill 调用并持续完善的 Harness 系统，用于验证 Codex / Agent 的端到端研发闭环能力。

## 改动范围

- 初始化 TypeScript pnpm monorepo。
- 增加 workflow-core 状态机和测试。
- 增加 orchestrator、requirements、coding、testing、deploy 五个 RPC 服务。
- 增加工具型 Web Console。
- 增加中文 Codex Skill 包。
- 增加 worktree-like 流程入口。
- 增加 AGENTS.md 渐进式知识库。

## 架构说明

服务统一使用 HTTP JSON-RPC，`orchestrator-rpc` 负责推进状态机并调用其它服务。运行记录写入 `.harness/runs`，文档记录写入 `docs`。

## 测试结果

- `pnpm typecheck`: passed
- `pnpm test`: passed
- Web build 和 Docker Compose 验证待最终闭环记录。

## 风险

- 当前编码执行器是模拟 patch plan，后续可接真实 Agent 执行器。
- Orchestrator 运行时状态在内存中，持久化 JSON 是审计来源。

## 回滚方式

回滚本次分支或删除新增 workspace 服务；Docker 部署可用 `docker compose down` 停止。

## 部署步骤

```bash
pnpm install
docker compose up --build
```

## 后续建议

- 增加真实 Agent patch executor。
- 增加服务级集成测试。
- 增加前端浏览器自动化检查。

