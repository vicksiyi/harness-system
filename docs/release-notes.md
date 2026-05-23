# Release Notes: Cross-File Node Search

- Files page now searches node titles, notes, tags, and map titles across saved database files.
- `mindmap-rpc` exposes a new `searchNodes` JSON-RPC method backed by SQLite.
- Search results show map context, status, tags, and note snippets, and can open the matching map in the editor.
- Browser quality now verifies cross-file node search during the standard product regression.

## Operator Notes
- Restart `mindmap-rpc` after updating so `/health` lists `searchNodes`.
- Run `pnpm target:dev` for local product development.
- Full workflow record: `.harness/runs/run_mphvsld0_04f2is6q.json`.
