# Release Notes: Card Editor Harness Loop

## Added

- Isolated Card Editor target app under `apps/card-editor`.
- Card templates for requirement, bugfix, and polish cards.
- Board summary metrics for draft, review, published, and tag count.
- Markdown export for the visible card set.
- Target-app domain tests covering templates, summaries, filtering, scoring, and export.

## Changed

- Removed the separate Harness front-end console to avoid confusing the control plane with the product sample.
- Harness control is now Skill / RPC / workflow script / `.harness/runs` / docs driven.
- Docker Compose now starts Card Editor plus the five RPC services.
- Workflow records now include `targetProject`, defaulting to `apps/card-editor`.
- `run-workflow.mjs` writes returned run JSON to the host `.harness/runs` even when orchestrator runs inside Docker.

## Validation

- `pnpm verify`: passed
- Unit tests: 29 passed across 5 files
- `docker compose up --build -d --remove-orphans`: passed
- `pnpm health`: passed
- Browser smoke test for `http://localhost:5175`: passed
- `$harness` script equivalent `pnpm workflow:requirement "给卡片编辑器增加模板和 Markdown 导出能力"`: passed

## Notes

- Docker defaults the target app to port 5175. Use `CARD_EDITOR_PORT=5176 docker compose up --build` if needed.
- Current coding execution is a deterministic simulation suitable for Harness validation; real Agent patch execution is the next major extension.
