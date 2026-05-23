# Release Notes: Mind Map Sync Service Startup Fix

## Product Impact

- Save file, Push diff, and Pull diff now have the expected local backend when developers start the product with `pnpm target:dev`.
- The Mind Map Studio frontend remains at `http://localhost:5175`; the product sync service remains at `http://localhost:4105`.
- Infinite-canvas node positions are now preserved by persistence instead of being clamped back to the old fixed-canvas range.

## Operator Notes

- Use `pnpm target:dev` for normal local development.
- Use `pnpm target:web` only when intentionally testing the frontend without persistence.
- If sync actions fail, first run `curl http://localhost:4105/health`.
- The active SQLite file should resolve to `.harness/mindmap/mindmaps.sqlite` at the repository root unless `MINDMAP_DB_PATH` is set.

## Verification

- Store unit regression tests passed.
- Full typecheck passed.
- Harness verify loop passed with the local browser target.
- Harness bugfix workflow passed.
- Manual browser check confirmed Save, Pull, and Push success states.

## Known Limits

- The UI still needs a more graceful degraded/offline sync state.
- Browser automation should be expanded to click Save, Push, and Pull as part of the standard target check.
