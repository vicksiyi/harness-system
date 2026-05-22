# MR Summary: Stabilize Mind Map File Save And Sync Naming

## Background
The Mind Map Studio sample exposed a broken save path and product-facing `RPC` wording. Browser quality also needed to catch real click failures and screenshot-visible rendering problems instead of only checking happy-path selectors.

## Change Scope
- Added diff-style mind map sync types, operation storage, and `syncMap` support in the mind map service.
- Fixed Save file so it flushes pending diff operations, avoids stale version coupling, and does not lose clicks after title blur.
- Renamed product-visible transport wording to sync service/database file terminology.
- Made New file create a clean starter map instead of cloning the currently opened document.
- Upgraded browser quality to verify manual save, diff push, import diff drain, drag behavior, Canvas connector pixels, and desktop/mobile screenshots.

## Architecture Notes
The product still uses HTTP JSON-RPC internally, but that is now an implementation detail. The UI speaks in product concepts: files, database, sync, pending changes, and collaboration.

## Validation
- `pnpm typecheck`
- `pnpm test services/mindmap-rpc/src/store.test.ts`
- `pnpm target:test`
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser` twice consecutively
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`
- `docker compose config`
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:bugfix "修复保存文件失败，隐藏产品界面 RPC 命名，并稳定浏览器截图验证"`

Final result: 54 tests passed, build passed, browser quality passed, workflow `run_mphk8wv8_70p1cf8q` passed.

## Risk
- The collaboration model is still an operation log, not a full CRDT.
- Existing local SQLite data may contain old browser-test files; New file now starts cleanly, so old data should not affect new runs.

## Rollback
Revert this commit to restore the previous snapshot-save behavior and earlier browser quality checks. If needed, clear `.harness/mindmap/` local data after rollback.

## Deployment
Run `docker compose up --build` and verify the product at `http://localhost:5175`; service config is valid via `docker compose config`.

## Follow-ups
- Add a second-browser/session simulation for multi-client diff sync.
- Continue toward import/export hardening and infinite canvas.
