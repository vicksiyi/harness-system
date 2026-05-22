# Release Notes: Fix: 移动端脑图节点截图显示被截断，浏览器门禁需要输出并检查桌面和移动截图

- Workflow type: bugfix
- Target project: apps/mindmap-editor
- Result: passed
- Score: 100
- Deployment: healthy

## Operator Notes
- `pnpm target:browser` now emits both desktop and mobile screenshots.
- Codex should inspect those screenshots as part of visual QA.
- Mobile map nodes now stack inside the visible canvas instead of being clipped horizontally.
- Inspect `.harness/runs/run_mphe8410_4fygji8e.json` for the full JSON execution record.
