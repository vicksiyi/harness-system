# MR Summary: Realtime Mind Map Diff Broadcast

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
Mind Map Studio required peers to manually click Pull diff before remote edits appeared locally. The requested behavior is that one client can edit, push DIFF operations, and the backend broadcasts those changes so connected peers apply them automatically.

## Changes
- Added `MindMapSyncEvent` and custom GET route support to the shared RPC server.
- Added `MindMapSyncBroadcaster` with SSE ready events, subscriber cleanup, and fan-out.
- Exposed `GET /events` from `mindmap-rpc` and broadcast successful `syncMap` writes.
- Added frontend `EventSource` subscription and live sync status.
- Fixed same-browser multi-tab sync by making `clientId` per editor instance instead of localStorage-persistent.
- Updated browser quality to verify separate-client broadcast apply and same-browser node DIFF apply.

## Current Support
- Supported: current-map `syncMap` DIFF operations: `rename-map`, `upsert-node`, `delete-node`, and `select-node`.
- Supported: node title/notes/tags/status edits and canvas moves.
- Supported: map title edits when saved through the DIFF path.
- Supported: peers with pending local ops; local ops are flushed before merging the server document.
- Not supported yet: broadcasts for pure `createMap`, `deleteMap`, or full `saveMap` writes with no pending DIFF.
- Not supported yet: auto-switching peers to a different map; broadcasts apply only to the currently open map.

## Validation
- `pnpm typecheck`
- `pnpm target:test`
- `pnpm test`
- `pnpm target:build`
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser`
- Workflow: `run_mpi3ifzc_5u6fr7u2` passed.

## Rollback
Revert the SSE route, broadcaster, and frontend subscription changes. Manual Push diff and Pull diff continue to work through `syncMap`.
