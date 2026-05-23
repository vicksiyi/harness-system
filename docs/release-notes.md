# Release Notes: File-Level Import and Export

Date: 2026-05-23
Target Project: apps/mindmap-editor
Workflow Run: run_mphr4zhb_i7lulh0f

## Added

- Download Markdown export.
- Download JSON export.
- Import JSON file upload.
- Browser validation for download events and JSON file upload.

## Changed

- Export filenames now use safe map-title slugs and the export date.
- JSON file upload feeds the existing preview and apply flow instead of replacing it.

## Validation

- 58 total tests passed through `pnpm verify`.
- Browser quality passed on `http://localhost:5175` with file transfer checks.
- Workflow `run_mphr4zhb_i7lulh0f` completed successfully.

## Known Limits

- Markdown export is download-only; Markdown import is not implemented yet.
- File upload applies only after the user confirms the import.
