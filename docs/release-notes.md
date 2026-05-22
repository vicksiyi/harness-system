# Release Notes: Mind Map Save Sync Stabilization

- Fixed Save file so title edits and pending collaboration changes are persisted reliably.
- Product UI no longer exposes `RPC` as a user-facing concept; sync/database wording is used instead.
- New file now starts from a clean default mind map, avoiding repeated-test document overlap.
- Browser quality now verifies manual save, diff sync, queue drain, drag movement, Canvas connector pixels, and desktop/mobile screenshots.
- Validation passed with 54 tests, production build, full browser quality, Docker Compose config, and workflow `run_mphk8wv8_70p1cf8q`.

Known limit: diff collaboration is operation-log based and still needs a dedicated multi-client conflict simulation.
