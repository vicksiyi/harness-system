# Release Notes: Focused Mind Map Editor Workspace

## Product Impact

- File management now lives on a separate Files page.
- The Editor page is focused on searching nodes, navigating the canvas, collaboration status, and editing the selected node.
- Direct toolbar buttons for create node, undo, redo, snapshot save, layout, and reset map were removed from the editor header.
- Creation, undo/redo, layout, snapshots, search, and zoom are supported through keyboard shortcuts and command palette flow.
- Auto sync now defaults on and pulls immediately when enabled.
- Branch collapse/expand is available from Relationship Insight.

## Harness Impact

- Browser quality now exercises the Files page before returning to the Editor page.
- Browser quality verifies shortcut-driven node creation, undo/redo, keyboard zoom, branch collapse/expand, file export/import, manual pull, and automatic peer sync.
- Visual QA now includes an additional Files page screenshot.

## Verification

- Product domain tests: 27 passed.
- Full repo tests: 64 passed.
- Target build: passed.
- Browser quality: passed.
- Workflow: `run_mphuzbxm_8v7ws9id` passed.

## Known Limits

- File library sorting and search are not yet implemented.
- Auto sync is still interval polling, not push-based realtime transport.
- Files page import/export is functional but can be further compressed for very small screens.
