# Release Notes: Relationship Insight Panel

## Product Impact

- The inspector now includes Relationship Insight for the selected branch.
- Users can quickly see children, descendants, siblings, leaves, branch status mix, same-tag related branches, and the recommended next action.
- Same-tag related branch rows are clickable and reuse the existing node selection behavior.

## Harness Impact

- Browser quality now verifies the Relationship Insight section and metric labels.
- The full verify loop continues to cover persistence, Save file, Push diff, Pull diff, multi-client sync, canvas connectors, infinite canvas, mini map, import/export, accessibility names, and desktop/mobile overflow.

## Verification

- Product domain tests: 25 passed.
- Full repo tests: 62 passed.
- Target build: passed.
- Browser quality: passed with Relationship Insight checks.
- Workflow: `run_mphu8nqs_hr9q0hsz` passed.

## Known Limits

- Related branches are ranked by shared selected-node tags and capped at four results.
- The current insight panel analyzes the active file only.
- Recommendation text is intentionally lightweight until deeper scoring is introduced.
