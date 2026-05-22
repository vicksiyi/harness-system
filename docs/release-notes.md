# Release Notes: Harness System 0.1.0

## Added

- Web Console for workflow operation and observation.
- JSON-RPC services for orchestration, requirement analysis, coding plans, testing/log parsing, and deployment checks.
- Workflow state machine with retry, blocking, completion, scoring, MR Summary, and Release Notes generation.
- Chinese Codex Skill entrypoints for `$harness`, `$harness-requirement`, `$harness-bugfix`, and `$harness-polish`.
- Worktree-like execution directory with workflow scripts and runbooks.
- Progressive `AGENTS.md` knowledge base across root, web, services, workflow-core, worktree, and docs.
- Docker Compose deployment with health checks.
- Unit tests for workflow-core, requirements analyzer, testing log parser, and shared RPC server.

## Validation

- TypeScript typecheck passed.
- Unit tests passed: 20 tests across 4 files.
- Frontend build passed.
- Full `pnpm verify` passed.
- Workflow closed-loop validation passed with automatic fix and retest.
- Docker Compose build and health checks passed.
- Browser smoke test passed.

## Notes

- Docker defaults to Web port 5173. Use `WEB_PORT=5174 docker compose up --build` if another local process already owns 5173.
- Current coding execution is a deterministic simulation suitable for Harness validation; real Agent patch execution is the next major extension.
