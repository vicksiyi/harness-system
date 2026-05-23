# Release Notes: Files Library Search And Sort

- Files page now supports searching database-backed mind map files.
- Files page can sort by recent update, title, or idea count.
- Browser quality now validates the file-library workflow before entering editor regressions.
- Product validation passed through unit tests, typecheck, build, browser checks, full verify, and Harness workflow `run_mphvdk6q_6fklwl3i`.

## Operator Notes
- Run `pnpm target:dev` to keep both the mind map frontend and `mindmap-rpc` online.
- Open [http://localhost:5175](http://localhost:5175), switch to Files, and use Search files / Sort files to manage saved maps.
- Inspect `.harness/runs/run_mphvdk6q_6fklwl3i.json` for the full workflow record.
