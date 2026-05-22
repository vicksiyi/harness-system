# Harness System

Harness System is a local-first Codex/Agent engineering harness. It provides a web console, multiple JSON-RPC services, a workflow state machine, Codex Skill instructions, Docker Compose deployment, and auditable execution records.

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
pnpm dev:web
```

Web console: http://localhost:5173

RPC services:

- Orchestrator: http://localhost:4100
- Requirements: http://localhost:4101
- Coding: http://localhost:4102
- Testing: http://localhost:4103
- Deploy: http://localhost:4104

## Verify

```bash
pnpm verify
docker compose up --build
```

See `docs/runbook.md` for the end-to-end workflow and `docs/test-log.md` for verification history.

