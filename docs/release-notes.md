# Release Notes: Canvas Mini Map

Date: 2026-05-23
Target Project: apps/mindmap-editor
Workflow Run: run_mphrha29_grrcdp7u

## Added

- Mini map in the canvas panel.
- Selected node marker.
- Current viewport frame.
- Browser quality checks for mini map visibility and rendered dimensions.

## Changed

- Domain tests now cover mini map model generation.
- Infinite canvas verification now includes overview rendering.

## Validation

- 59 total tests passed through `pnpm verify`.
- Browser quality passed on `http://localhost:5175` with mini map checks.
- Workflow `run_mphrha29_grrcdp7u` completed successfully.

## Known Limits

- Mini map is visual-only; click-to-pan is a future enhancement.
