# Release Notes: Node Search Status Filter

- Files page cross-file node search now supports filtering by `all`, `seed`, `exploring`, or `committed`.
- `mindmap-rpc` applies the status predicate in SQLite instead of filtering in the browser.
- Browser quality now verifies committed-only search results before opening a search result in the editor.

## Operator Notes
- Restart `mindmap-rpc` after pulling this change so the service uses the new query parameters.
- Run `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify` for the full regression.
- Full workflow record: `.harness/runs/run_mphw9qox_t7loz6ea.json`.
