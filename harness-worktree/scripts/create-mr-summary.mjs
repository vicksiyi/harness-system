#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const runDir = join(root, ".harness", "runs");
const docsDir = join(root, "docs");

const files = (await readdir(runDir).catch(() => [])).filter((file) => file.endsWith(".json")).sort();
if (files.length === 0) {
  throw new Error("No persisted workflow runs found in .harness/runs.");
}

const latest = files.at(-1);
const run = JSON.parse(await readFile(join(runDir, latest), "utf8"));
const mrSummary = run.mrSummary ?? `# MR Summary: ${run.title}\n\n- Status: ${run.status}\n- Stage: ${run.stage}\n`;
const releaseNotes = run.releaseNotes ?? `# Release Notes: ${run.title}\n\n- Result: ${run.status}\n`;

await writeFile(join(docsDir, "generated-mr-summary.md"), `${mrSummary}\n`, "utf8");
await writeFile(join(docsDir, "release-notes.md"), `${releaseNotes}\n`, "utf8");
console.log(`Generated MR summary from ${latest}`);

