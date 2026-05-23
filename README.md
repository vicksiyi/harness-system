# Harness System

Harness System is a local-first Codex/Agent engineering harness. It provides multiple JSON-RPC services, a workflow state machine, Codex Skill instructions, Docker Compose deployment, and auditable execution records.

The Harness control plane is intentionally isolated from the product under development. The default target product is `apps/mindmap-editor`, a standalone mind map editor that Codex can grow through Harness workflows.

Primary Codex entrypoints are the Skill-style commands documented in `skills/harness/SKILL.md`:

```txt
$harness requirement 增加一个工作流运行详情页
$harness bugfix 测试服务日志解析失败
$harness polish 优化前端任务状态展示
```

Local script equivalents are available for the Skill executor:

```bash
pnpm workflow:requirement "增加一个工作流运行详情页"
pnpm workflow:bugfix "测试服务日志解析失败"
pnpm workflow:polish "优化前端任务状态展示"
```

## Quick Start

```bash
pnpm install
pnpm dev:services
pnpm target:dev
```

Target product: http://localhost:5175

RPC services:

- Orchestrator: http://localhost:4100
- Requirements: http://localhost:4101
- Coding: http://localhost:4102
- Testing: http://localhost:4103
- Deploy: http://localhost:4104
- Mind Map product RPC: http://localhost:4105

Target app commands:

```bash
pnpm target:dev     # starts both mindmap-rpc and the Vite app
pnpm target:web     # starts only the Vite app
pnpm target:rpc     # starts only the product sync service
pnpm target:test
pnpm target:build
pnpm target:browser
```

## Verify

```bash
pnpm verify
docker compose up --build
```

See `docs/runbook.md` for the end-to-end workflow and `docs/test-log.md` for verification history.
