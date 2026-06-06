# MR Summary: Fix: Poll fallback勾选和不勾选没什么区别，判断是否为bug，若是bug修复

Type: bugfix
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
Poll fallback勾选和不勾选没什么区别，判断是否为bug，若是bug修复

## Scope
- Modify the isolated target project at apps/mindmap-editor.
- Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.
- Expose product changes through the target project UI and tests.
- Refresh generated MR summary, release notes, and execution records.

## Changes
- Confirmed this was a product bug: the `Poll fallback` checkbox only gated timer polling, while live SSE broadcasts still auto-applied remote diffs when unchecked.
- Added `shouldApplyAutomaticRemoteSync()` in the target domain layer and regression coverage for disabled auto sync, own-client events, wrong-map events, stale events, and pending-operation merge cases.
- Updated the editor live-sync handler so unchecked auto sync blocks automatic broadcast application; re-checking the control still pulls remote changes.
- Fixed a file-creation race where the Files page briefly exposed the old file ID/list while a new database-backed map was being created.

## Validation
- Tests: passed via `pnpm typecheck && pnpm test && pnpm target:build && pnpm target:browser` with score 98.
- Browser quality: passed on http://localhost:5175.
- Task-specific browser validation passed: `.harness/browser/poll-gate-mpi6epxl-poll-fallback.json`.
- Deployment: healthy on docker-compose-local.

## Risks
- Local Docker or port conflicts can block deployment validation.
- A simulated Agent action may not reflect every real coding failure mode.
- In-memory service state is reset when orchestrator-rpc restarts; persisted JSON run files are the audit source.

## Rollback
- Revert the target project changes in `apps/mindmap-editor/src/domain.ts`, `apps/mindmap-editor/src/domain.test.ts`, and `apps/mindmap-editor/src/main.ts`.

## Follow-ups
- Consider renaming the visible `Poll fallback` label in a separate polish pass if product wants the control to describe both polling and live broadcast gating.
