# Release Notes: Fix: Poll fallback勾选和不勾选没什么区别，判断是否为bug，若是bug修复

- Workflow type: bugfix
- Target project: apps/mindmap-editor
- Result: passed
- Score: 100
- Deployment: healthy

## Operator Notes
- Run `pnpm health` after deployment.
- Inspect `.harness/runs` for the full JSON execution record.

## Product Notes
- Fixed the collaboration auto-sync toggle so unchecked `Poll fallback` prevents automatic live broadcast application as well as polling.
- Re-checking the control immediately pulls pending remote changes, preserving the intended recovery path.
- New map creation now clears stale file IDs and file rows while the create request is pending, preventing users and browser checks from acting on the previous file.
