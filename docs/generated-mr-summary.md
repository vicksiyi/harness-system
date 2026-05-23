# MR Summary: Undo/Redo Collaborative History Sync And Harness Flow Guardrails

Type: bugfix + harness orchestration improvement
Target Project: apps/mindmap-editor
Status: passed

## Background

Mind Map Studio 的 undo/redo 只恢复本地状态，未生成协同 DIFF，也不会触发远端同步。多端打开同一脑图文件时，端 1 的历史回退/重做无法自动广播到端 2。

本轮还把 Harness Skill 执行轨道从“自然语言步骤”升级为稳定 task JSON + flow，并新增中文 `harness-quality` Skill，让质量验证按本次风险自主设计，而不是固定点击路径。

## Scope

- 修复 `apps/mindmap-editor` 的 undo/redo 协同同步。
- 增加 undo/redo 协同 DIFF 的单测。
- 扩展浏览器质量门，验证同一文件双端收到 node、undo、redo DIFF。
- 新增中文 `harness-quality` Skill，并把现有 Harness Skills 接入 task JSON flow。
- 在 workflow-core/orchestrator 中持久化 `.harness/tasks/<run-id>.json`。
- 修正 task test case 状态回写，覆盖 automated、quality、deployment 三类结果。

## Architecture Notes

- `buildHistorySyncOperations()` 将恢复后的历史帧转换为 `select-node`、父子有序 `upsert-node` 和缺失节点 `delete-node`。
- `applyHistoryFrame()` 在 undo/redo 后排队这些 operations，并调用 `scheduleRemoteSave()`。
- 每次 workflow 生成 10 步任务流：intake、requirement-analysis、test-case-generation、implementation-planning、coding、automated-testing、quality-validation、mr-summary、deployment、execution-record。
- `harness-quality` 只描述质量验证方法，由 Agent 根据本次风险选择 agent-browser / Playwright / 单测 / 日志检查组合。

## Validation

- `pnpm test apps/mindmap-editor/src/domain.test.ts` passed, 30 tests.
- `pnpm typecheck` passed.
- `pnpm test packages/workflow-core/src/index.test.ts services/testing-rpc/src/log-parser.test.ts services/testing-rpc/src/test-runner.test.ts services/mindmap-rpc/src/store.test.ts services/mindmap-rpc/src/sync-events.test.ts` passed, 35 tests.
- `pnpm test` passed, 77 tests.
- `pnpm verify` passed, including typecheck, full tests, production build, and browser quality.
- `pnpm quality:agent-browser:doctor` passed.
- Workflow `run_mpi5frdl_dap795zp` passed with score 98.
- Workflow `run_mpi5t35u_46w08ajp` passed and confirmed all generated task test cases were `passed`.
- Browser checks passed for `same-browser peer receives node diff`, `same-browser peer receives undo diff`, and `same-browser peer receives redo diff`.
- agent-browser screenshot: `.harness/browser/run_mpi5frdl_dap795zp-agent-browser-quality.png`.

## Risks

- Undo/redo currently syncs full restored node state for the file, which is robust but can be heavier than minimal inverse operations for very large maps.
- Runtime task JSON is intentionally ignored by Git; durable summaries live in `docs/agent-journal.md` and `docs/test-log.md`.
- `agent-browser` quality remains a Skill-directed tool surface; deterministic `pnpm target:browser` is still the default automated browser gate.

## Rollback

- Revert the undo/redo sync patch in `apps/mindmap-editor/src/main.ts` and `apps/mindmap-editor/src/domain.ts`.
- Remove the same-browser undo/redo browser checks if they block a hotfix rollback.
- Keep task JSON flow changes unless they cause orchestration regressions; they are additive and isolated from product runtime.

## Deployment

```bash
pnpm verify
docker compose up --build
pnpm health
```

## Follow-ups

- Add conflict visualization for simultaneous history replay.
- Persist richer per-step quality notes from `harness-quality` into task JSON.
