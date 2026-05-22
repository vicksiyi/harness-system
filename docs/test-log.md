# Test Log

本文件记录测试命令、结果、失败日志摘要、修复动作和重试结果。

## Unit Coverage Pass

- At: 2026-05-23
- Commands: `pnpm typecheck`, `pnpm test`
- Result: passed
- Coverage scope: workflow-core 状态机、需求分析、日志解析、RPC server health/rpc dispatch。
- Tests: 20 passed across 4 files.
- Fix actions: 为 services 拆分 `analyzer.ts` 和 `log-parser.ts`，避免单测启动真实端口。

## Full Local Verify

- At: 2026-05-23
- Command: `pnpm verify`
- Result: passed
- Typecheck: passed
- Unit tests: 20 passed across 4 files
- Frontend build: passed with Vite production build
- Fix actions: none

## Docker Port Preflight

- At: 2026-05-23
- Command: `lsof -ti tcp:4100,4101,4102,4103,4104,5173`
- Result: found existing process on host port 5173 from another local Vite project.
- Action: parameterized Docker Compose host ports with environment-variable overrides; default remains `5173`, validation can use `WEB_PORT=5174`.

## Workflow Closed Loop

- At: 2026-05-23
- Command: `pnpm workflow:bugfix "测试服务日志解析失败"`
- Result: passed
- Run id: `run_mphbeszb_ibsczodq`
- Attempts: 2/2
- Failure observed: first test pass intentionally produced `Log parser failed` and `Test assertion failed` signatures.
- Fix action: orchestrator entered `fixing`, applied simulated fix suggestion, and reran validation.
- Retest result: passed with score 96 and deployment status `healthy`.

## Docker Compose Validation

- At: 2026-05-23
- Commands: `WEB_PORT=5174 docker compose up --build -d`, `WEB_PORT=5174 docker compose ps`, `pnpm health`, `curl -fsS http://localhost:5174`, `curl -fsS http://localhost:4100/health`
- Result: passed
- Services: requirements-rpc, coding-rpc, testing-rpc, deploy-rpc, orchestrator-rpc, web all healthy.
- Container workflow check: `runWorkflow` via `http://localhost:4100/rpc` completed with status `passed`, stage `completed`, tests `true`, deploy `healthy`.
- Note: `WEB_PORT=5174` was used only because another local project already occupied host port 5173.

## Browser Console Smoke Test

- At: 2026-05-23
- Target: `http://localhost:5174`
- Result: passed
- Observed: Harness Console rendered, Start Workflow button visible, workflow detail visible, timeline/log/test/deploy/MR sections visible.
- Follow-up fix: included orchestrator itself in service health list so the console covers all five RPC services.

## Final Verification After Health Polish

- At: 2026-05-23
- Commands: `pnpm verify`, `WEB_PORT=5174 docker compose up --build -d`, `pnpm health`, browser reload at `http://localhost:5174`
- Result: passed
- Unit tests: 20 passed across 4 files
- Compose: all six containers running; five RPC services healthy and web healthy after startup
- Browser: service health list shows orchestrator, requirements, coding, testing, and deploy; workflow detail shows completed run, healthy deployment, and MR Summary preview.

## Workflow Validation run_mphbeszb_ibsczodq

- Command: pnpm workflow:bugfix "测试服务日志解析失败"
- Result: passed
- Attempts: 2/2
- Log summary: testing-rpc: running simulated regression suite | typecheck passed | vitest passed | web build passed
- Fix actions: Applying automated fix suggestion
