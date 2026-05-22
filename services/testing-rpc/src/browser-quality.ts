import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { asRecord, type BrowserQualityResult } from "@harness/shared";

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = process.env.HARNESS_ROOT ?? join(here, "../../..");

export type BrowserQualityRunner = (params: unknown) => Promise<BrowserQualityResult>;

export const skippedBrowserQuality: BrowserQualityRunner = async (params) => {
  const record = asRecord(params);
  const targetProject = typeof record.targetProject === "string" ? record.targetProject : "apps/mindmap-editor";
  const targetUrl = typeof record.targetUrl === "string" ? record.targetUrl : "http://localhost:5175";
  return {
    passed: true,
    command: "browser quality skipped",
    targetProject,
    targetUrl,
    startedServer: false,
    checks: [{ name: "browser quality skipped", ok: true, detail: "No runner was provided for this validation context." }],
    rawLog: "browser-quality: skipped"
  };
};

export async function runBrowserQualityCheck(params: unknown): Promise<BrowserQualityResult> {
  const record = asRecord(params);
  const runId = typeof record.runId === "string" ? record.runId : `browser_${Date.now().toString(36)}`;
  const targetProject = typeof record.targetProject === "string" ? record.targetProject : "apps/mindmap-editor";
  const targetUrl =
    typeof record.targetUrl === "string"
      ? record.targetUrl
      : process.env.HARNESS_BROWSER_TARGET_URL ?? "http://localhost:5175";

  const args = [
    "harness-worktree/scripts/browser-quality-check.mjs",
    "--url",
    targetUrl,
    "--target",
    targetProject,
    "--run-id",
    runId
  ];

  return new Promise((resolve) => {
    execFile("node", args, { cwd: rootDir, env: process.env, timeout: 60000 }, (error, stdout, stderr) => {
      const parsed = parseBrowserResult(stdout);
      if (parsed) {
        resolve(parsed);
        return;
      }

      const rawLog = [stdout.trim(), stderr.trim(), error instanceof Error ? error.message : ""].filter(Boolean).join("\n");
      resolve({
        passed: false,
        command: `node ${args.join(" ")}`,
        targetProject,
        targetUrl,
        startedServer: false,
        checks: [{ name: "browser quality process", ok: false, detail: rawLog || "Browser quality script failed." }],
        rawLog: rawLog || "browser-quality: failed without output",
        failure: rawLog || "Browser quality script failed without JSON output."
      });
    });
  });
}

function parseBrowserResult(stdout: string): BrowserQualityResult | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as BrowserQualityResult;
  } catch {
    const start = trimmed.lastIndexOf("\n{");
    if (start === -1) {
      return null;
    }
    try {
      return JSON.parse(trimmed.slice(start + 1)) as BrowserQualityResult;
    } catch {
      return null;
    }
  }
}
