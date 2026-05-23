# MR Summary: Auto Sync Collaboration

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Workflow Run: run_mphrayls_hesgb8f8

## Background

Mind Map Studio supported manual diff push/pull, but collaborative editing should also support low-friction remote updates. This change adds an opt-in automatic sync loop and proves it with two browser clients.

## Scope

- Added an Auto sync toggle to the Collaboration panel.
- Persisted the local auto-sync preference.
- Added silent remote diff polling every 1.8 seconds.
- Paused auto-pull while local pending operations exist or sync is already in progress.
- Extended browser quality with a second-client auto-sync assertion.

## Architecture Notes

Auto sync uses the existing JSON-RPC `syncMap` operation with an empty operation list. Remote operations authored by another client trigger `applyRemoteMap`; no-change silent polls avoid unnecessary renders. Manual pull remains available for explicit recovery.

## Validation

- `pnpm typecheck`: passed.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser`: passed with peer auto-sync checks.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`: passed, 58 total tests plus build and browser quality.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:requirement "给脑图协同增加自动同步开关并验证多端免手动拉取"`: passed with run `run_mphrayls_hesgb8f8`.

## Risks

- Polling is simple interval-based sync rather than push transport.
- Auto-sync is per browser and local preference only.
- Conflicting simultaneous edits are still last-operation-wins through the operation log.

## Rollback

Revert the auto-sync toggle, timer, silent pull branch, and browser-quality peer assertion. Manual Push diff and Pull diff continue to work.

## Follow-ups

- Add visible remote-change toast or timeline item.
- Add conflict preview for simultaneous edits to the same field.
- Replace polling with WebSocket or Server-Sent Events when the product needs lower latency.
