# Release Notes: Collaborative Undo/Redo And Harness Flow Guardrails

## Product

- Undo and redo now synchronize across clients editing the same mind map file.
- History replay emits DIFF operations for restored nodes and removed nodes, so peers no longer keep stale titles or undone branches.
- Browser regression coverage now validates peer receipt of node, undo, and redo DIFFs in the same browser context.

## Harness

- Added the Chinese `harness-quality` Skill for task-specific quality validation with agent-browser.
- Added stable `.harness/tasks/<run-id>.json` task flow records for each workflow run.
- Updated Harness Skills to read task JSON, generate tests before coding, and enter a quality-validation phase before MR/deploy records.
- Task test cases now receive concrete pass/fail status from automated tests, browser quality, and deployment health checks.

## Validation

- Unit/domain tests: passed.
- Typecheck: passed.
- Workflow-core/testing-rpc/mindmap-rpc focused tests: passed.
- Full Vitest suite: passed, 77 tests.
- `pnpm verify`: passed with browser quality screenshots.
- agent-browser doctor, snapshot, console/errors, and screenshot checks: passed.
- Workflows `run_mpi5frdl_dap795zp` and `run_mpi5t35u_46w08ajp`: passed.

## Operator Notes

- Start product sample on port 5175 with `pnpm target:dev`.
- Run the full quality gate with `pnpm verify`.
- Inspect `.harness/tasks/<run-id>.json` for current workflow step, evidence, test cases, and blockers.
