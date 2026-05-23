# MR Summary: Implement: 给跨文件节点搜索增加状态筛选，贯穿 mindmap-rpc、Files 页面和浏览器质量门

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
给跨文件节点搜索增加状态筛选，贯穿 mindmap-rpc、Files 页面和浏览器质量门

## Scope
- Modify the isolated target project at apps/mindmap-editor.
- Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.
- Expose product changes through the target project UI and tests.
- Refresh generated MR summary, release notes, and execution records.

## Changes
- Added optional `status` filtering to `MindMapNodeSearchInput`.
- Updated `MindMapStore.searchNodes` to filter SQLite results by `seed`, `exploring`, or `committed`.
- Added a Files page `Result status` selector for cross-file node search.
- Extended browser quality checks to verify a committed-only search finds `Research signals` before validating search-result navigation.
- Added TDD coverage for status-filtered search results.

## Validation
- TDD red: `pnpm test services/mindmap-rpc/src/store.test.ts` failed because `searchNodes` ignored `status`.
- Fix: threaded `status` through shared types, RPC server params, SQLite query, Files page state, and browser quality.
- `pnpm test services/mindmap-rpc/src/store.test.ts`: passed.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`: passed with 66 tests, build, and browser quality.
- Workflow `run_mphw9qox_t7loz6ea`: passed.

## Risks
- SQLite `LIKE` search is still basic; status filtering narrows results but does not replace indexed full-text search.
- The search query uses an OR text match group plus a status predicate; future filter additions should keep SQL precedence covered by tests.

## Rollback
- Revert this commit to remove the status selector and status predicate from node search.

## Follow-ups
- Add tag filtering next, then move heavy search to SQLite FTS when data volume grows.
