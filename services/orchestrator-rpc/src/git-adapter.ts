import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitIntegrationResult, GitRepositorySnapshot, WorkflowRun } from "@harness/shared";
import { createGitIntegration } from "@harness/workflow-core";

const execFileAsync = promisify(execFile);

export async function inspectGitIntegration(run: WorkflowRun, rootDir: string): Promise<GitIntegrationResult> {
  return createGitIntegration(run, await readGitSnapshot(rootDir));
}

export async function readGitSnapshot(rootDir: string): Promise<GitRepositorySnapshot> {
  const branch = await gitOutput(rootDir, ["rev-parse", "--abbrev-ref", "HEAD"], "unknown");
  const remote = await gitOutput(rootDir, ["config", "--get", "remote.origin.url"], "origin");
  const upstream = await gitOutput(rootDir, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], "");
  const statusShort = (await gitOutput(rootDir, ["status", "--short"], ""))
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  return {
    branch,
    remote,
    upstream: upstream || undefined,
    baseBranch: process.env.HARNESS_GIT_BASE_BRANCH ?? "main",
    changedFiles: statusShort.map(changedFileFromStatusLine).filter(Boolean),
    statusShort
  };
}

function changedFileFromStatusLine(line: string): string {
  const match = line.match(/^[ MADRCU?!]{1,2}\s+(.*)$/);
  const path = match?.[1]?.trim() ?? line.trim();
  return path.includes(" -> ") ? path.split(" -> ").at(-1)?.trim() ?? path : path;
}

async function gitOutput(rootDir: string, args: string[], fallback: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: rootDir });
    return stdout.trim();
  } catch {
    return fallback;
  }
}
