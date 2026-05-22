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

## Workflow Validation run_mphbeszb_ibsczodq

- Command: pnpm workflow:bugfix "测试服务日志解析失败"
- Result: passed
- Attempts: 2/2
- Log summary: testing-rpc: running simulated regression suite | typecheck passed | vitest passed | web build passed
- Fix actions: Applying automated fix suggestion
