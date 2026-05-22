# Release Notes: Implement: 给脑图编辑器增加桌面节点拖拽并实时重绘 Canvas 连线

- Workflow type: requirement
- Target project: apps/mindmap-editor
- Result: passed
- Score: 100
- Deployment: healthy

## Operator Notes
- Desktop map nodes can now be dragged.
- Canvas connectors redraw during drag and are validated with browser pixel checks.
- Browser quality now performs a real Playwright mouse drag.
- Inspect `.harness/runs/run_mpheyvim_drrxh78f.json` for the full JSON execution record.
