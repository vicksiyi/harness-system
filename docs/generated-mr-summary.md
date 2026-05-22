# MR Summary: Fix: 移动端脑图节点截图显示被截断，浏览器门禁需要输出并检查桌面和移动截图

Type: bugfix
Target Project: apps/mindmap-editor
Status: passed
Stage: completed

## Background
移动端脑图节点截图显示被截断，浏览器门禁需要输出并检查桌面和移动截图

## Scope
- Modify the isolated target project at apps/mindmap-editor.
- Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.
- Expose product changes through the target project UI and tests.
- Refresh generated MR summary, release notes, and execution records.

## Changes
- Fixed mobile map rendering so nodes stack inside the visible canvas instead of being clipped off to the right.
- Updated browser quality validation to produce separate desktop and mobile screenshots.
- Added a mobile map-node visibility assertion so visual clipping is caught automatically.
- Updated the Harness Skill instructions to require Codex screenshot review, not only DOM assertions.
- Recorded screenshot-guided visual QA in the journal, decision log, and test log.

## Validation
- Tests: passed via `pnpm typecheck && pnpm test && pnpm target:build && pnpm target:browser` with score 98.
- Browser quality: passed on http://localhost:5175.
- Visual review: desktop and mobile screenshots were generated and the mobile screenshot was inspected by Codex.
- Workflow: `run_mphe8410_4fygji8e` passed at `completed`.
- Deployment: healthy on docker-compose-local.

## Risks
- Local Docker or port conflicts can block deployment validation.
- Mobile now uses a stacked map layout; future drag/position features should define separate desktop and mobile interaction behavior.
- Screenshot review is still human-in-the-loop through Codex; future work can add image heuristics for more automated visual checks.
- In-memory service state is reset when orchestrator-rpc restarts; persisted JSON run files are the audit source.

## Rollback
- Revert the mobile canvas CSS and browser quality script changes.
- Restore the previous browser screenshot behavior if screenshot artifact volume becomes an issue.

## Follow-ups
- Add JSON import/export and validate the import preview visually.
- Add desktop/mobile screenshots to future MR summaries automatically.
