# MR Summary: Implement: 给脑图编辑器增加桌面节点拖拽并实时重绘 Canvas 连线

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
给脑图编辑器增加桌面节点拖拽并实时重绘 Canvas 连线

## Scope
- Modify the isolated target project at apps/mindmap-editor.
- Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.
- Expose product changes through the target project UI and tests.
- Refresh generated MR summary, release notes, and execution records.

## Changes
- Added `moveNode` domain logic with coordinate clamping coverage.
- Added desktop pointer drag for map nodes.
- Redraws Canvas connectors while a node is dragged and persists coordinates on pointer up.
- Added drag styling for grabbed nodes.
- Extended browser quality validation to drag a node with Playwright mouse events before Layout and Canvas pixel checks.

## Validation
- Tests: passed via `pnpm typecheck && pnpm test && pnpm target:build && pnpm target:browser` with score 98.
- Browser quality: passed on http://localhost:5175.
- Visual review: `.harness/browser/browser_mpheycmc-desktop-connectors-mindmap-editor.png` was inspected after drag/layout validation.
- Workflow: `run_mpheyvim_drrxh78f` passed at `completed`.
- Deployment: healthy on docker-compose-local.

## Risks
- Dragging is desktop-only; mobile continues to use stacked static nodes.
- Future canvas zoom/pan features will need coordinate transform handling.
- In-memory service state is reset when orchestrator-rpc restarts; persisted JSON run files are the audit source.

## Rollback
- Revert the pointer drag handlers and `moveNode` helper.
- Existing saved maps remain compatible because coordinates use the same `x`/`y` fields.

## Follow-ups
- Add undo/redo for drag moves.
- Add backend-backed sync/version history.
