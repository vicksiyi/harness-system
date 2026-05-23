# MR Summary: Implement: 给 Files 页面增加跨文件节点搜索，使用 mindmap-rpc 查询数据库节点，并纳入浏览器质量门

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
给 Files 页面增加跨文件节点搜索，使用 mindmap-rpc 查询数据库节点，并纳入浏览器质量门

## Scope
- Modify the isolated target project at apps/mindmap-editor.
- Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.
- Expose product changes through the target project UI and tests.
- Refresh generated MR summary, release notes, and execution records.

## Changes
- Added `searchNodes` to the isolated `mindmap-rpc` JSON-RPC service.
- Added shared request/result types for cross-file node search and exposed the method in service health metadata.
- Implemented SQLite-backed search across node titles, notes, tags, and map titles, with result ranking and snippets.
- Added a Files page Node Search panel that calls the product RPC service and lets users jump from a result into the editor.
- Moved Node Search above the long file list after screenshot QA showed it was buried below many saved files.
- Extended browser quality checks to verify cross-file node search against a freshly saved database file.
- Updated product and RPC `AGENTS.md` context so future Agent runs understand the Files page / backend boundary.

## Validation
- TDD red: `pnpm test services/mindmap-rpc/src/store.test.ts` first failed with `store.searchNodes is not a function`.
- TDD correction: ranking expectation was adjusted after implementation correctly prioritized direct node-title matches over map-title matches.
- `pnpm test services/mindmap-rpc/src/store.test.ts`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed with 66 tests.
- `pnpm target:build`: passed.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser`: passed, including `cross-file node search finds saved node`.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`: passed.
- Workflow `run_mphvsld0_04f2is6q`: passed.
- Screenshot QA reviewed `.harness/browser/files-node-search-review.png`; Node Search was repositioned above the file list after visual review.

## Risks
- Search uses simple SQLite `LIKE` matching. Large libraries may need FTS indexing and pagination.
- Search result ranking is deterministic but basic; relevance scoring can become richer once node metadata grows.
- Existing dev servers must be restarted after this change so `mindmap-rpc` exposes the new `searchNodes` method.

## Rollback
- Revert this commit to remove `searchNodes`, the Files page Node Search panel, and the browser quality assertion.

## Follow-ups
- Add FTS-backed search and tag/status filters for very large map libraries.
- Add a result click browser assertion that opens the matching node in the editor.
