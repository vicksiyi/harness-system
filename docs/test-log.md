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
- Commands: `docker compose up --build -d`, `docker compose ps`, `pnpm health`, `curl -fsS http://localhost:5175`, `curl -fsS http://localhost:4100/health`
- Result: passed
- Services: requirements-rpc, coding-rpc, testing-rpc, deploy-rpc, orchestrator-rpc, mindmap-editor all healthy.
- Container workflow check: `runWorkflow` via `http://localhost:4100/rpc` completed with status `passed`, stage `completed`, tests `true`, deploy `healthy`.
- Note: Harness console was removed later; visual smoke checks now focus on the target app.

## Target Project TDD Pass

- At: 2026-05-23
- Commands: `pnpm target:test`, `pnpm typecheck`
- Result: passed
- Target project: `apps/mindmap-editor`
- Tests: 8 passed in `apps/mindmap-editor/src/domain.test.ts`
- Product features covered: card normalization, filtering, tag collection, completion scoring, card templates, board summary, Markdown export.

## Harness Console Removal Regression

- At: 2026-05-23
- Command: `pnpm verify`
- Result: failed, then fixed
- Failure: `services/requirements-rpc/src/analyzer.test.ts` still expected polish criteria to mention `operator review` after the analyzer was updated to target product editing language.
- Fix: updated the test assertion to match the new target product editing criterion and reran verification.

## Docker Orchestrator Run Persistence

- At: 2026-05-23
- Command: `pnpm workflow:requirement "给脑图编辑器增加结构化编辑能力"`
- Result: workflow passed, but host `.harness/runs/<run-id>.json` was missing because the healthy orchestrator was running inside Docker and persisted the file inside the container filesystem.
- Fix: updated `harness-worktree/scripts/run-workflow.mjs` to always write the returned run JSON into the host `.harness/runs` directory.

## Final Isolated Product Harness Pass

- At: 2026-05-23
- Commands: `pnpm verify`, `docker compose up --build -d --remove-orphans`, `pnpm health`, browser smoke test at `http://localhost:5175`, `pnpm workflow:requirement "给脑图编辑器增加结构化编辑能力"`
- Result: passed
- Tests: 29 passed across 5 files
- Docker: mindmap-editor and all five RPC services healthy; old removed front-end container cleaned up as an orphan.
- Browser: Mind Map Studio rendered the editing workspace, outline, focus queue, and Markdown export.
- Workflow run persisted on host: `.harness/runs/run_mphc6v85_awfm002g.json`

## Workflow Validation run_mphbeszb_ibsczodq

- Command: pnpm workflow:bugfix "测试服务日志解析失败"
- Result: passed
- Attempts: 2/2
- Log summary: testing-rpc: running simulated regression suite | typecheck passed | vitest passed | web build passed
- Fix actions: Applying automated fix suggestion

## Workflow Validation run_mphc6cqz_2lt2mci0

- Command: pnpm workflow:requirement "给脑图编辑器增加结构化编辑能力"
- Target project: apps/mindmap-editor
- Result: passed
- Attempts: 1/2
- Log summary: testing-rpc: running simulated regression suite | typecheck passed | vitest passed | web build passed
- Fix actions: none

## Workflow Validation run_mphc6v85_awfm002g

- Command: pnpm workflow:requirement "给脑图编辑器增加结构化编辑能力"
- Target project: apps/mindmap-editor
- Result: passed
- Attempts: 1/2
- Log summary: testing-rpc: running simulated regression suite | typecheck passed | vitest passed | web build passed
- Fix actions: none

## Workflow Validation run_mphcdu9e_f6p05eh5

- Command: pnpm workflow:requirement "给脑图编辑器增加关联视图、反向引用和下一步焦点队列"
- Target project: apps/mindmap-editor
- Result: passed
- Attempts: 1/2
- Log summary: testing-rpc: running simulated regression suite | typecheck passed | vitest passed | web build passed
- Fix actions: none

## Workflow Validation run_mphci54n_mldhhnlg

- Command: pnpm workflow:requirement "给脑图编辑器增加关联视图、反向引用和下一步焦点队列"
- Target project: apps/mindmap-editor
- Result: passed
- Attempts: 1/2
- Log summary: testing-rpc: running simulated regression suite for apps/mindmap-editor | typecheck passed | vitest passed | target app tests passed | target build passed
- Fix actions: none

## Mind Map Studio Isolation TDD Pass

- At: 2026-05-23
- Commands: `pnpm target:test`, `pnpm typecheck`, `pnpm test`, `pnpm target:build`
- Result: passed after one parser fix
- Tests: 36 passed across 6 files; target product domain suite has 9 tests.
- Failure observed: `parseFailureLog` treated passing `accessible control names` browser logs as failures because the rule matched accessibility text without requiring `browser-quality: failed`.
- Fix action: tightened the parser to classify accessibility only when the browser quality log line is failed.
- Retest result: `pnpm test` passed.

## Browser Quality Gate

- At: 2026-05-23
- Initial command: `pnpm target:browser`
- Initial result: failed
- Failure observed: `localhost:5175` was still served by the old Docker `card-editor` container, so the browser check could not find the `Mind Map Studio` heading.
- Fix action: updated `browser-quality-check.mjs` to infer the Vite dev port from `HARNESS_BROWSER_TARGET_URL`, then reran on `http://localhost:5176`.
- Retest command: `HARNESS_BROWSER_TARGET_URL=http://localhost:5176 pnpm target:browser`
- Retest result: passed; checks covered heading visibility, map canvas, outline, focus queue, Markdown export, search, child creation, live title edit, accessible control names, desktop overflow, and mobile overflow.
- Screenshot artifact: `.harness/browser/browser_mphd7pag-mindmap-editor.png`

## Full Verify With Browser Gate

- At: 2026-05-23
- Command: `HARNESS_BROWSER_TARGET_URL=http://localhost:5176 pnpm verify`
- Result: passed
- Scope: typecheck, all Vitest suites, Mind Map Studio production build, and real browser quality gate.

## Docker Compose Blocker

- At: 2026-05-23
- Command: `docker compose up --build -d --remove-orphans`
- Result: blocked by local Docker daemon
- Failure observed: Docker Desktop returned `input/output error` while extracting Chromium layers, then returned `input/output error` writing `io.containerd.metadata.v1.bolt/meta.db` while removing the old container.
- Fix attempted: split Chromium into `services/testing-rpc/Dockerfile` so only testing-rpc carries the browser dependency; attempted targeted removal of `harness-system-*` images and old containers.
- Current blocker: old `harness-system-card-editor-1` still occupies `5175`; Docker daemon metadata write errors require Docker Desktop restart or local Docker storage repair outside the repo.
