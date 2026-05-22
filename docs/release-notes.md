# Release Notes: Fix: 节点连接线漂移，将脑图连接线从 SVG 改为 Canvas 渲染并增加像素级验证

- Workflow type: bugfix
- Target project: apps/mindmap-editor
- Result: passed
- Score: 100
- Deployment: healthy

## Operator Notes
- Connector rendering now uses Canvas instead of SVG.
- Browser quality validates connector pixels and saves a dedicated desktop connector screenshot.
- Auto Layout is available from the top toolbar and command palette.
- Inspect `.harness/runs/run_mphercp6_ycgddaxm.json` for the full JSON execution record.
