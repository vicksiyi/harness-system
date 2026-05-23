# Release Notes: Realtime Mind Map Diff Broadcast

- Workflow type: requirement
- Target project: apps/mindmap-editor
- Result: passed
- Latest workflow: `run_mpi3ifzc_5u6fr7u2`

## Product Changes
- Connected clients now receive backend DIFF broadcasts over `GET /events`.
- Current-map DIFFs are applied automatically without pressing Pull diff.
- Same-browser multi-tab clients now get unique editor instance IDs, so one tab no longer ignores another tab's broadcasts.
- Collaboration UI shows live sync stream status; polling remains available as fallback.

## Known Gap
- File lifecycle broadcasts for create/delete/full-save are not implemented yet.
