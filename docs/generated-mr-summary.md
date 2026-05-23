# MR Summary: Stabilize Mind Map Save, Shortcuts, Canvas, and Diff Sync

Type: bugfix
Target Project: apps/mindmap-editor
Workflow Run: run_mphzxyd4_bye74m1r
Status: passed
Stage: completed

## Background

The product sample needed four concrete fixes before continuing autonomous iteration: saving could fail when the frontend stayed online without the mindmap RPC service, `Cmd/Ctrl+R` was captured by the app instead of refreshing the browser, the infinite canvas lacked direct drag/zoom interaction, and collaboration DIFF payloads did not expose a clear file ID.

## Scope

- `apps/mindmap-editor`: shortcut ownership, File ID display, explicit `mapId` sync calls, background pan, wheel/focal zoom, command palette zoom commands, and focused editor viewport behavior.
- `services/mindmap-rpc` and `packages/shared`: explicit `mapId` DIFF contract, legacy `id` compatibility, per-file operation records, and unit coverage.
- `harness-worktree/scripts/browser-quality-check.mjs`: save/DIFF quality gate, File ID assertions, background pan/wheel zoom checks, and keep-alive handling for the target RPC service.
- `docs`: execution journal, test log, MR summary, and release notes.

## Architecture Notes

- Collaboration DIFF now routes by `mapId`; the old `id` field remains as a compatibility fallback but the frontend sends `mapId`.
- The visible File ID appears on both the Files page and the Collaboration panel so operators can confirm which database-backed map is receiving DIFF operations.
- Browser refresh is preserved by ignoring app-level `Cmd/Ctrl+R`; app create actions now use unmodified keys such as `R` and `C`.
- Canvas pan/zoom uses viewport state (`x`, `y`, `zoom`) and updates CSS variables/data attributes so browser tests can verify behavior without relying only on visual inspection.
- Browser quality keeps `mindmap-rpc` alive when it attaches to an already-running frontend, preventing the previous save-failure mode.

## Validation

- `pnpm test services/mindmap-rpc/src/store.test.ts`: passed.
- `pnpm target:test`: passed, 29 mindmap editor tests.
- `pnpm typecheck`: passed.
- `pnpm target:build`: passed.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser`: passed with desktop/mobile screenshots.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`: passed, 69 tests plus browser quality.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:bugfix "修复保存文件失败、Cmd+R 误触创建节点、无限画布拖拽缩放缺失、协同 DIFF 缺少文件 ID 语义"`: passed.

## Screenshots

- `.harness/browser/browser_mphzx2y7-desktop-mindmap-editor.png`
- `.harness/browser/browser_mphzx2y7-mobile-mindmap-editor.png`
- `.harness/browser/run_mphzxyd4_bye74m1r-desktop-viewport-mindmap-editor.png`

## Risks

- The local dev environment still depends on ports 5175 and 4105 being available.
- DIFF conflict resolution remains last-write/operation-order based; richer conflict UI is a follow-up.
- The target RPC keep-alive behavior is intentionally local-dev oriented and should be revisited for long-running production process supervision.

## Rollback

Revert the commit for this change. If only the browser quality keep-alive behavior causes issues, revert the `browser-quality-check.mjs` portion while keeping the app-level `mapId`, shortcut, and canvas fixes.

## Deployment

1. Run `pnpm verify`.
2. Run `docker compose up --build`.
3. Run `pnpm health`.
4. Open `http://localhost:5175` and confirm save, File ID display, pan, zoom, and DIFF sync.

## Follow-ups

- Add conflict inspection for concurrent edits.
- Add version history and per-file operation timeline.
- Continue autonomous product iteration through `$harness requirement`, `$harness bugfix`, and `$harness polish`.
