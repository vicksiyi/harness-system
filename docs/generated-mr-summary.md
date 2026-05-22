# MR Summary: Implement: 给脑图编辑器增加 JSON 导入导出和导入预览

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
给脑图编辑器增加 JSON 导入导出和导入预览

## Scope
- Modify the isolated target project at apps/mindmap-editor.
- Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.
- Expose product changes through the target project UI and tests.
- Refresh generated MR summary, release notes, and execution records.

## Changes
- Added portable JSON export for the current mind map.
- Added import JSON parsing with normalization, duplicate-id rejection, and preview metadata.
- Added a `JSON Transfer` UI panel with export preview, import input, live preview, and guarded apply action.
- Added an automatic safety snapshot before replacing the current map with imported JSON.
- Added command palette entries for JSON export selection and JSON import focus.
- Extended browser quality validation to paste JSON, verify preview, apply import, and inspect resulting desktop/mobile screenshots.

## Validation
- Tests: passed via `pnpm typecheck && pnpm test && pnpm target:build && pnpm target:browser` with score 98.
- Browser quality: passed on http://localhost:5175.
- Visual review: mobile screenshot `.harness/browser/browser_mphedor1-mobile-mindmap-editor.png` was inspected after JSON import.
- Workflow: `run_mphee81h_xyq47wgr` passed at `completed`.
- Deployment: healthy on docker-compose-local.

## Risks
- Local Docker or port conflicts can block deployment validation.
- JSON import replaces the current map after Apply; the feature creates a safety snapshot, but users still need to restore manually if they apply the wrong payload.
- Very large JSON payloads are not yet paginated or streamed.
- In-memory service state is reset when orchestrator-rpc restarts; persisted JSON run files are the audit source.

## Rollback
- Revert the JSON Transfer UI and domain import/export helpers.
- Existing localStorage maps remain compatible because this change only adds a transfer surface.

## Follow-ups
- Add file upload/download buttons once browser download handling is part of the visual QA loop.
- Add schema version migration tests when the JSON format evolves.
- Add desktop node drag and auto-layout next.
