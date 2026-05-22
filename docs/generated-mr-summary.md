# MR Summary: Harness System Initial Release

## 需求背景

创建一个可本地运行、可 Docker 部署、可由 Codex Skill 指令调用，并能持续完善的 Harness 系统，用于验证 Codex / Agent 的端到端研发闭环能力。

## 改动范围

- 初始化 pnpm + TypeScript monorepo。
- 增加 Web Console，包含工作流列表、新建任务入口、运行详情、事件时间线、日志流、服务健康、测试结果、部署状态、最近 Agent 记录和 MR Summary 预览。
- 增加五个 HTTP JSON-RPC 服务：orchestrator、requirements、coding、testing、deploy。
- 增加 workflow-core 状态机、重试决策、评分、MR Summary 和 Release Notes 生成。
- 增加 `harness-worktree` 作为 Skill 背后的流程编排入口。
- 增加中文 Codex Skill 包：`$harness`、`$harness-requirement`、`$harness-bugfix`、`$harness-polish`。
- 增加渐进式 `AGENTS.md` 知识库。
- 增加 Dockerfile、Docker Compose、健康检查和部署验证脚本。
- 增加单测，覆盖状态机、需求分析、日志解析和 RPC server。

## 架构说明

所有后端服务暴露 `GET /health` 和 `POST /rpc`。`orchestrator-rpc` 推进状态机并依次调用 requirements、coding、testing、deploy 服务。执行记录写入 `.harness/runs`，人类可读记录写入 `docs/agent-journal.md` 和 `docs/test-log.md`。

## 测试结果

- `pnpm typecheck`: passed
- `pnpm test`: passed, 20 tests across 4 files
- `pnpm --filter @harness/web build`: passed
- `pnpm verify`: passed
- `pnpm workflow:bugfix "测试服务日志解析失败"`: passed after simulated failure, fix, and retest
- `WEB_PORT=5174 docker compose up --build -d`: passed
- `pnpm health`: passed
- Browser smoke test on `http://localhost:5174`: passed

## 风险

- `coding-rpc` 当前是模拟 patch plan，后续应接入真实 Agent patch executor。
- `orchestrator-rpc` 的运行时列表是内存态，审计来源是 `.harness/runs/<run-id>.json`。
- 本机端口冲突会影响默认 Compose 端口；已支持 `WEB_PORT`、`ORCHESTRATOR_PORT` 等环境变量覆盖。

## 回滚方式

- 本地服务：停止 `pnpm dev:services` 或 `docker compose down`。
- 代码回滚：使用 Git revert 回滚对应 commit。
- 部署回滚：停止当前 Compose stack，并切回上一版本镜像或提交。

## 部署步骤

```bash
pnpm install
pnpm verify
docker compose up --build
pnpm health
```

如果 5173 被占用：

```bash
WEB_PORT=5174 docker compose up --build
```

## 后续建议

- 接入真实 Codex patch executor。
- 增加服务级端到端集成测试。
- 增加前端交互自动化测试。
- 增加持久化 run index，避免 orchestrator 重启后列表仅依赖内存。
