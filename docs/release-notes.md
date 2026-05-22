# Release Notes: Isolate Mind Map Studio Product Sample

- Workflow type: requirement
- Target project: apps/mindmap-editor
- Result: verified locally
- Score: browser quality passed
- Deployment: blocked by local Docker daemon I/O error

## Operator Notes
- Run `pnpm health` after deployment.
- Run `pnpm target:browser` to execute the browser quality gate.
- If port `5175` is held by the old container, temporarily run `HARNESS_BROWSER_TARGET_URL=http://localhost:5176 pnpm target:browser`.
- Inspect `.harness/runs` for the full JSON execution record.
