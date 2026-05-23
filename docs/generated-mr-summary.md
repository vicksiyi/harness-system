# MR Summary: Canvas Mini Map

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Workflow Run: run_mphrha29_grrcdp7u

## Background

The mind map now supports a large panning and zooming canvas. A mini map gives users a compact overview of document structure and current viewport position.

## Scope

- Added `MiniMapModel` and `buildMiniMap` domain logic.
- Added unit coverage for mini map sizing, selected marker, and viewport frame.
- Rendered a mini map in the canvas panel.
- Added selected node marker and current viewport frame.
- Extended browser quality checks to verify mini map rendering.

## Architecture Notes

The mini map is derived from existing node coordinates and local viewport state. It introduces no new persistence or RPC contract. The main Canvas connector system remains unchanged.

## Validation

- `pnpm target:test`: passed, 24 target tests.
- `pnpm typecheck && pnpm target:test && HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser`: passed.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`: passed, 59 total tests plus build and browser quality.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:requirement "给无限画布增加小地图概览并纳入浏览器质量门"`: passed with run `run_mphrha29_grrcdp7u`.

## Risks

- The mini map is read-only; clicking to navigate is not implemented yet.
- It uses a normalized bounding box and may need richer scaling controls for extremely sparse maps.

## Rollback

Revert the mini map domain helper, UI rendering, CSS, and browser-quality assertions. Infinite canvas pan/zoom remains intact.

## Follow-ups

- Make the mini map clickable for viewport navigation.
- Add branch density or collapsed-branch indicators.
- Add keyboard shortcuts for moving viewport by mini map quadrants.
