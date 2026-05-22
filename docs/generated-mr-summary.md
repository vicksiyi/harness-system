# MR Summary: Implement: 支持打开不同脑图文件，使用 mindmap-rpc 和 SQLite 数据库存储，并通过浏览器验证 RPC 创建文件

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
支持打开不同脑图文件，使用 mindmap-rpc 和 SQLite 数据库存储，并通过浏览器验证 RPC 创建文件

## Scope
- Modify the isolated target project at apps/mindmap-editor.
- Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.
- Expose product changes through the target project UI and tests.
- Refresh generated MR summary, release notes, and execution records.

## Changes
- Added `services/mindmap-rpc` with SQLite-backed map file storage.
- Added shared map file and node payload types.
- Added optimistic `baseVersion` checks for saved map files.
- Added a front-end `Map Files` panel for creating, opening, and saving database-backed maps.
- Added a product RPC client in `apps/mindmap-editor/src/rpc.ts`.
- Updated browser quality to start/check `mindmap-rpc`, create a map through the UI, and validate the database-backed path before visual checks.
- Updated Docker Compose, health checks, ports, and AGENTS context for the new product service.

## Validation
- Tests: passed via `pnpm typecheck && pnpm test && pnpm target:build && pnpm target:browser` with score 98.
- Browser quality: passed on http://localhost:5175.
- Unit tests: 52 tests passed in full `pnpm verify`, including `services/mindmap-rpc/src/store.test.ts`.
- Compose: `docker compose config` passed and includes `mindmap-rpc` on port 4105.
- Visual review: `.harness/browser/browser_mphfscfp-desktop-connectors-mindmap-editor.png` and `.harness/browser/browser_mphfscfp-mobile-mindmap-editor.png` were inspected.
- Workflow: `run_mphfsvb0_a9md6fxw` passed at `completed`.
- Deployment: healthy on docker-compose-local.

## Risks
- `node:sqlite` is currently experimental in Node 22 and emits an experimental warning in tests.
- Front-end saves use optimistic versions; concurrent edits currently surface as save errors until DIFF collaboration lands.
- The local SQLite file under `.harness/mindmap` is intentionally ignored by Git.

## Rollback
- Revert `services/mindmap-rpc`, the shared map file types, the front-end RPC client, and the Map Files UI.
- Local-only maps can still fall back to localStorage if the RPC service is offline.

## Follow-ups
- Implement DIFF-mode collaboration for the active file.
- Expand import/export to include database file round-trips.
- Add infinite canvas pan/zoom with Canvas coordinate validation.
