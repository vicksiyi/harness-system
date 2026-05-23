# Release Notes: Mind Map Save and Canvas Stability

Release date: 2026-05-23
Target: apps/mindmap-editor
Workflow: run_mphzxyd4_bye74m1r

## Fixed

- Save and DIFF sync now use an explicit `mapId`, with File ID visible in Files and Collaboration views.
- Browser refresh shortcuts are preserved; `Cmd/Ctrl+R` no longer creates a node.
- Infinite canvas can be dragged from empty background space and zoomed with the wheel or keyboard.
- Browser quality validation keeps the target mindmap RPC service online when attaching to an already-running frontend.

## Validation

- 69 unit tests passed.
- Typecheck and production build passed.
- Headless browser quality passed on `http://localhost:5175`.
- Workflow bugfix loop passed with healthy deployment status.

## Operator Notes

- Start the local product sample with `pnpm target:dev`.
- If the frontend is already running at `http://localhost:5175`, `pnpm target:browser` will keep `mindmap-rpc` available at `http://localhost:4105` for continued manual testing.
- Confirm File ID in the Collaboration panel before debugging DIFF messages.

## Next Candidates

- Conflict review UI for concurrent edits.
- Version history per file.
- Operation timeline with author/client filters.
