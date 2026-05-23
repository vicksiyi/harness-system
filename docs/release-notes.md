# Release Notes: Search Navigation Quality Gate

- Browser quality now clicks a cross-file node search result and confirms the editor opens the matching node.
- The gate records both editor navigation and selected title assertions.
- Full verify and workflow `run_mphvwqy2_tu52uhwl` passed.

## Operator Notes
- Run `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser` to exercise the strengthened flow.
- Inspect `.harness/runs/run_mphvwqy2_tu52uhwl.json` for the workflow record.
