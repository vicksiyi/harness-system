# Release Notes: Infinite Canvas Viewport

Date: 2026-05-23
Target Project: apps/mindmap-editor
Workflow Run: run_mphqvfcp_2441duqy

## Added

- Large canvas viewport with pan, zoom, and reset controls.
- Persistent local viewport state for the current browser.
- Zoom-aware desktop node dragging.
- Browser quality checks for infinite canvas state and screenshots.

## Changed

- Node coordinates now support large-map authoring up to 100000 in each axis.
- Canvas rendering now uses a transformed surface so nodes and connector pixels move together.
- Mobile keeps a readable stacked layout instead of attempting transformed canvas interactions.

## Validation

- 57 total tests passed through `pnpm verify`.
- Browser quality passed on `http://localhost:5175`.
- Workflow `run_mphqvfcp_2441duqy` completed successfully.

## Known Limits

- Button controls are implemented first; direct canvas panning and wheel zoom are pending.
- Viewport is local browser state and is not part of multi-client diff sync yet.
