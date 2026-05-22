# Harness System Agent Index

本文件是 Harness 的渐进式知识库总入口。Codex 处理任务时先读这里，再按任务类型进入下一级 `AGENTS.md`。

## 系统职责

Harness System 用于验证 Codex / Agent 的端到端研发闭环能力。它包含：

- 前端控制台：`apps/web`
- 多个后端 JSON-RPC 服务：`services/*-rpc`
- 工作流状态机：`packages/workflow-core`
- RPC 客户端和共享类型：`packages/rpc-client`、`packages/shared`
- Skill 调用入口和流程编排 worktree：`skills/*`、`harness-worktree`
- 审计文档：`docs`

## 主要入口

- Codex Skill：`$harness requirement|bugfix|polish <内容>`
- 本地脚本：`pnpm workflow:requirement "<需求>"`
- 开发服务：`pnpm dev:services`、`pnpm dev:web`
- 测试闭环：`pnpm typecheck`、`pnpm test`、`pnpm --filter @harness/web build`
- Docker：`docker compose up --build`

## 渐进式阅读路径

- 需求和编排任务：读 `harness-worktree/AGENTS.md`、`packages/workflow-core/AGENTS.md`、`services/orchestrator-rpc/AGENTS.md`
- 需求拆解：读 `services/requirements-rpc/AGENTS.md`
- 编码计划：读 `services/coding-rpc/AGENTS.md`
- 测试、日志、失败修复：读 `services/testing-rpc/AGENTS.md`
- 部署：读 `services/deploy-rpc/AGENTS.md`
- 前端控制台：读 `apps/web/AGENTS.md`
- 文档和发布记录：读 `docs/AGENTS.md`

## 修改注意事项

- 优先补单测，再改实现，保持类似 TDD 的节奏。
- 不要跳过失败日志；测试失败时必须读取日志、判断原因、修复、重跑，并写入 `docs/test-log.md`。
- 不要破坏 Git 历史，不使用 `git reset --hard` 或 `git checkout --` 丢弃用户改动。
- 前端是工具型控制台，不做营销页。
- RPC 服务统一使用 `GET /health` 和 `POST /rpc`。

## 常见故障

- 端口冲突：查看 `.harness/logs/dev-services.log`，或设置服务 `PORT`。
- 依赖服务未启动：运行 `pnpm dev:services` 后再 `pnpm health`。
- 日志解析失败：优先读 `services/testing-rpc/AGENTS.md` 并补 `log-parser.test.ts`。
- Docker 构建失败：先运行 `docker compose config`，再查看具体服务 build 日志。

