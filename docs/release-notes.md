# Release Notes: Auto Sync Collaboration

Date: 2026-05-23
Target Project: apps/mindmap-editor
Workflow Run: run_mphrayls_hesgb8f8

## Added

- Auto sync toggle in the Collaboration panel.
- Silent polling for remote diff operations.
- Browser validation that a second client receives a rename diff without manual pull.

## Changed

- Manual Pull diff remains available, while automatic sync skips polling when local edits are pending.
- Browser quality now covers manual and automatic collaboration paths.

## Validation

- 58 total tests passed through `pnpm verify`.
- Browser quality passed on `http://localhost:5175` with peer auto-sync checks.
- Workflow `run_mphrayls_hesgb8f8` completed successfully.

## Known Limits

- Auto sync is polling-based.
- Conflict handling remains operation-log order with no user-facing merge preview yet.
