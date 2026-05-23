# MR Summary: File-Level Import and Export

Type: requirement
Target Project: apps/mindmap-editor
Status: passed
Workflow Run: run_mphr4zhb_i7lulh0f

## Background

Mind Map Studio already had JSON and Markdown text previews, but a real editor workflow needs file-level transfer: download portable exports and upload JSON files without manual copy/paste.

## Scope

- Added export artifact generation for JSON and Markdown.
- Added safe export filenames based on the current map title and export date.
- Added Download Markdown and Download JSON controls.
- Added Import JSON file control that reads a local file into the existing import preview/apply flow.
- Extended browser quality checks to verify real downloads and real file upload.

## Architecture Notes

The import/export logic remains in the isolated target product domain layer. The UI only handles browser-specific Blob download and File upload plumbing. Existing parsing, preview, snapshot-before-import, and diff-sync behavior remain shared with textarea imports.

## Validation

- `pnpm target:test`: passed, 23 target tests.
- `pnpm typecheck && pnpm target:test && HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm target:browser`: passed.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`: passed, 58 total tests plus build and browser quality.
- `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:requirement "完善脑图编辑器文件级导入导出下载上传体验"`: passed with run `run_mphr4zhb_i7lulh0f`.

## Risks

- Browser download behavior may vary in non-Chromium browsers, although the feature uses standard Blob URLs and anchor downloads.
- Imported files are JSON-only; Markdown import is not implemented.
- Uploaded file contents are read client-side and are not stored until the user applies and syncs the map.

## Rollback

Revert the export artifact helper, the download/upload controls, and browser-quality additions. Existing maps and database documents are unchanged.

## Follow-ups

- Add Markdown import or structured outline import.
- Add export buttons for the active branch only.
- Add import conflict preview before replacing the current map.
