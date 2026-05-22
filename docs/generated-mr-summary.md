# MR Summary: Fix: 节点连接线漂移，将脑图连接线从 SVG 改为 Canvas 渲染并增加像素级验证

Type: bugfix
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
节点连接线漂移，将脑图连接线从 SVG 改为 Canvas 渲染并增加像素级验证

## Scope
- Modify the isolated target project at apps/mindmap-editor.
- Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.
- Expose product changes through the target project UI and tests.
- Refresh generated MR summary, release notes, and execution records.

## Changes
- Replaced the SVG connector layer with a Canvas connector renderer.
- Canvas connectors are drawn from parent node edge to child node edge, removing the previous rotated-line drift.
- Added parent metadata on rendered map nodes so connector drawing and browser validation share the same source of truth.
- Added Auto Layout action and command entry to arrange hierarchy lanes.
- Tightened default auto-layout spacing so desktop screenshots do not clip deeper nodes.
- Extended browser quality validation with Canvas pixel sampling, connector-state screenshots, desktop node visibility checks, and Layout action verification.

## Validation
- Tests: passed via `pnpm typecheck && pnpm test && pnpm target:build && pnpm target:browser` with score 98.
- Browser quality: passed on http://localhost:5175.
- Visual review: `.harness/browser/browser_mpheqpsd-desktop-connectors-mindmap-editor.png` was inspected for connector placement.
- Workflow: `run_mphercp6_ycgddaxm` passed at `completed`.
- Deployment: healthy on docker-compose-local.

## Risks
- Local Docker or port conflicts can block deployment validation.
- Canvas rendering is not directly represented in the accessibility tree, so the browser gate now samples pixels and stores screenshots.
- Future drag interactions must redraw the connector canvas after node movement.
- In-memory service state is reset when orchestrator-rpc restarts; persisted JSON run files are the audit source.

## Rollback
- Revert the Canvas connector renderer and browser pixel checks.
- The node data model is unchanged, so rollback does not require localStorage migration.

## Follow-ups
- Add drag-to-move nodes and redraw Canvas connectors during pointer movement.
- Add a richer visual diff gate for connector screenshots.
