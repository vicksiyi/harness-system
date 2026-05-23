# MR Summary: Relationship Insight Panel

Type: requirement
Target Project: apps/mindmap-editor
Workflow Run: run_mphu8nqs_hr9q0hsz
Status: passed
Stage: completed

## Background

Mind Map Studio needed richer branch-level understanding as maps become larger. The editor already had outline, focus queue, snapshots, import/export, collaboration, and infinite canvas controls, but it did not summarize how the selected branch relates to its parent path, siblings, descendants, and same-tag branches.

## Scope

- Add pure domain logic for selected-branch relationship analysis.
- Surface relationship insight in the product inspector without exposing Harness concepts.
- Keep the target product isolated in `apps/mindmap-editor`.
- Upgrade Harness browser quality checks so the new panel is validated automatically.
- Record the TDD-style failure, fix, screenshot review, and workflow result.

## Changes

- Added `RelationshipInsight` and `buildRelationshipInsight`.
- The insight model reports depth, parent title, ancestor trail, child count, descendant count, sibling count, leaf count, status mix, same-tag related branches, and a next-step recommendation.
- Added TDD regression coverage in `apps/mindmap-editor/src/domain.test.ts`; the test failed first because the function did not exist, then passed after implementation.
- Added a new `Relationship Insight` inspector panel with compact metric tiles, status pills, recommendation text, and same-tag branch navigation.
- Updated `harness-worktree/scripts/browser-quality-check.mjs` to assert the Relationship Insight heading and metrics in the browser flow.

## Validation

- `pnpm target:test`
- `pnpm typecheck`
- `pnpm target:build`
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser`
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:requirement "给脑图产品增加关系洞察面板，并让浏览器验证覆盖该面板"`

Result: 62 total tests passed, target build passed, browser quality passed, and workflow `run_mphu8nqs_hr9q0hsz` completed successfully.

## Visual QA

- Desktop screenshot reviewed: `.harness/browser/browser_mphu7ral-desktop-mindmap-editor.png`
- Mobile screenshot reviewed: `.harness/browser/browser_mphu7ral-mobile-mindmap-editor.png`
- Relationship Insight is visible in the inspector on desktop and mobile.
- No horizontal overflow, obvious truncation, or panel overlap was observed.

## Risks

- Very dense same-tag maps currently show only the top four related branches.
- The relationship model is local to the loaded map; it does not yet search across different saved map files.
- Recommendations are heuristic and should become more nuanced as branch scoring grows.

## Rollback

- Revert the domain function, inspector panel markup/styles, and browser-quality assertions.
- The rest of the editor remains compatible because Relationship Insight does not alter persisted map data.

## Follow-Ups

- Add branch collapse/expand so relationship-heavy maps can stay readable.
- Add cross-file related branch search through `mindmap-rpc`.
- Add a conflict preview panel for collaborative edits that touch related branches.
