# MR Summary: Mind Map Sync Service Startup Fix

Type: bugfix
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background

The Mind Map Studio page could stay available at `http://localhost:5175` while the product sync service at `http://localhost:4105` was offline. In that state, Save file, Push diff, and Pull diff appeared broken even though the frontend itself loaded correctly.

## Scope

- Keep the product sample isolated in `apps/mindmap-editor`.
- Fix the local development entry so the product frontend and sync service start together.
- Stabilize the sync service database path across package-level process working directories.
- Preserve large node coordinates required by the infinite canvas.
- Refresh the product AGENTS guidance, runbook, execution journal, and test log.

## Changes

- Changed `pnpm target:dev` to start both `mindmap-rpc` and the Vite frontend.
- Added `pnpm target:web` for frontend-only debugging when the operator intentionally wants it.
- Updated `mindmap-rpc` storage path resolution to locate the monorepo root via `pnpm-workspace.yaml`.
- Made relative `MINDMAP_DB_PATH` values resolve from the workspace root.
- Raised persisted coordinate clamping from the old fixed canvas range to the infinite-canvas range.
- Added regression tests for package-directory startup and large canvas coordinate persistence.
- Documented the Save/Push/Pull failure triage path: check `curl http://localhost:4105/health`, then restart with `pnpm target:dev`.

## Validation

- `pnpm test services/mindmap-rpc/src/store.test.ts`
- `pnpm test services/mindmap-rpc/src/store.test.ts && pnpm typecheck`
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:bugfix "修复只启动前端时保存 Push Pull 同步服务离线失败"`
- Manual browser verification on `http://localhost:5175`: Save file, Pull diff, and Push diff all returned success while `http://localhost:4105/health` was healthy.

## Risks

- Running only `pnpm target:web` intentionally skips the sync service and will still make Save/Push/Pull fail.
- Existing local processes can hold port `4105`; stop stale `mindmap-rpc` processes before restarting the combined dev entry.
- Docker or local SQLite permission issues can still block persistence in unusual environments.

## Rollback

- Revert the startup script and storage path changes.
- Restart the previous separate service commands manually with `pnpm target:web` and `pnpm target:rpc`.
- If a local database path was accidentally changed, point `MINDMAP_DB_PATH` at the desired SQLite file and restart the sync service.

## Deployment Steps

1. Run `pnpm target:dev` for local product development.
2. Confirm `curl http://localhost:4105/health` returns `status: ok`.
3. Open `http://localhost:5175`.
4. Exercise Save file, Pull diff, and Push diff from the Files panel.

## Follow-Ups

- Add an in-app sync-service degraded state with a clear retry action.
- Expand browser checks to assert Save, Push, and Pull success messages automatically.
- Continue product complexity work through the Harness requirement loop.
