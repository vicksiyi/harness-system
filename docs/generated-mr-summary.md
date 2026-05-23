# MR Summary: Implement: 给 Files 页面增加文件搜索和排序，并纳入浏览器质量门

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
给 Files 页面增加文件搜索和排序，并纳入浏览器质量门

## Scope
- Modify the isolated target project at apps/mindmap-editor.
- Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.
- Expose product changes through the target project UI and tests.
- Refresh generated MR summary, release notes, and execution records.

## Changes
- Added file-library search on the isolated Files page so operators can filter database-backed mind map files without leaving file management.
- Added file sorting by most recent update, title, and idea count through a typed `MapFileSortMode` domain model.
- Kept the editor page focused on node editing; file discovery remains isolated from the canvas workspace.
- Extended `browser-quality-check.mjs` to create a database-backed file, filter the file list, switch the sort mode, and then continue export/import and editor regression checks.
- Added unit coverage for file filtering and sorting, including the TDD correction for title ordering.

## Validation
- `pnpm target:test`: passed.
- `pnpm typecheck`: passed.
- `pnpm target:build`: passed.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser`: passed, including file search and sort checks.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`: passed with 65 total tests.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:requirement "给 Files 页面增加文件搜索和排序，并纳入浏览器质量门"`: workflow `run_mphvdk6q_6fklwl3i` passed.

## Risks
- Search currently indexes title, node count, and version; future metadata such as owner or tags will need explicit inclusion.
- Sorting runs client-side over the loaded file list. Very large file libraries should move sorting/filtering into the RPC query.
- Browser validation depends on `mindmap-rpc` being reachable at `http://localhost:4105`.

## Rollback
- Revert this commit to remove the Files page filter/sort controls and the additional browser quality assertions.

## Follow-ups
- Add cross-file search across node titles once the backend supports indexed queries.
- Add persisted user preferences for Files page sort mode.
