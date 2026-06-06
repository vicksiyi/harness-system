#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const runDir = join(root, ".harness", "runs");
const taskDir = join(root, ".harness", "tasks");
const gitDir = join(root, ".harness", "git");
const docsDir = join(root, "docs");

const rawTokens = process.argv.slice(2);
const hasExplicitAction = rawTokens[0] && !rawTokens[0].startsWith("--");
const action = hasExplicitAction ? rawTokens[0] : "review";
const args = parseArgs(rawTokens.slice(hasExplicitAction ? 1 : 0));

if (!["review", "commit", "push", "mr"].includes(action)) {
  console.error(`Unknown git finalization action "${action}". Use review, commit, push, or mr.`);
  process.exit(2);
}

const runId = await resolveRunId(args["run-id"]);
const run = await readRun(runId);
const snapshot = await readGitSnapshot();
const git = run.git ?? createGitIntegration(run, snapshot);

if (action === "review") {
  const reviewed = createGitIntegration(run, snapshot);
  git.review = reviewed.review;
  git.commit = git.commit ?? reviewed.commit;
  git.push = git.push ?? reviewed.push;
  git.mr = git.mr ?? reviewed.mr;
}

if (action === "commit") {
  git.commit = await commitChanges(git.review.recommendedCommitMessage);
}

if (action === "push") {
  git.push = await pushBranch(snapshot);
}

if (action === "mr") {
  git.mr = await createOrRecordMr(run, snapshot);
}

run.git = git;
run.updatedAt = new Date().toISOString();
await persistGitState(run, git, action);
console.log(JSON.stringify({ runId, action, git }, null, 2));

if (action === "commit" && git.commit.status === "failed") {
  process.exitCode = 1;
}
if (action === "push" && git.push.status === "failed") {
  process.exitCode = 1;
}
if (action === "mr" && git.mr.status === "failed") {
  process.exitCode = 1;
}

async function resolveRunId(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  const files = (await readdir(runDir).catch(() => [])).filter((file) => file.endsWith(".json")).sort();
  if (files.length > 0) {
    return files.at(-1).replace(/\.json$/, "");
  }
  return `git_${Date.now().toString(36)}`;
}

async function readRun(runId) {
  const path = join(runDir, `${runId}.json`);
  const raw = await readFile(path, "utf8").catch(() => "");
  if (raw.trim()) {
    return JSON.parse(raw);
  }
  const at = new Date().toISOString();
  return {
    id: runId,
    type: "requirement",
    targetProject: "harness-system",
    title: "Manual Git Finalization",
    prompt: "Manual Git finalization",
    stage: "reviewing",
    status: "running",
    attempts: 0,
    maxAttempts: 0,
    createdAt: at,
    updatedAt: at,
    events: [],
    logs: []
  };
}

async function readGitSnapshot() {
  const branch = await gitOutput(["rev-parse", "--abbrev-ref", "HEAD"], "unknown");
  const remote = await gitOutput(["config", "--get", "remote.origin.url"], "origin");
  const upstream = await gitOutput(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], "");
  const statusShort = (await gitOutput(["status", "--short"], ""))
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

function changedFileFromStatusLine(line) {
  const match = line.match(/^[ MADRCU?!]{1,2}\s+(.*)$/);
  const path = match?.[1]?.trim() ?? line.trim();
  return path.includes(" -> ") ? path.split(" -> ").at(-1)?.trim() ?? path : path;
}

function createGitIntegration(run, snapshot) {
  const recommendedCommitMessage = recommendedCommitMessageFor(run);
  const mrUrl = compareUrl(snapshot.remote, snapshot.baseBranch, snapshot.branch);
  return {
    review: {
      status: snapshot.changedFiles.length === 0 ? "clean" : "dirty",
      branch: snapshot.branch,
      remote: snapshot.remote,
      upstream: snapshot.upstream,
      baseBranch: snapshot.baseBranch,
      changedFiles: snapshot.changedFiles,
      statusShort: snapshot.statusShort,
      recommendedCommitMessage,
      notes: [
        snapshot.changedFiles.length === 0 ? "No uncommitted changes were detected during workflow review." : "Review changed files before staging; leave unrelated user edits untouched.",
        "workflow:git records the local Git handoff for the current Harness run."
      ]
    },
    commit: {
      status: "pending",
      message: recommendedCommitMessage,
      reason: "Run pnpm workflow:git commit -- --files <files> after reviewing the diff."
    },
    push: {
      status: "pending",
      remote: snapshot.remote,
      branch: snapshot.branch,
      reason: "Run pnpm workflow:git push after commit succeeds."
    },
    mr: {
      status: snapshot.branch === snapshot.baseBranch ? "skipped" : mrUrl ? "manual" : "pending",
      title: run.title,
      url: snapshot.branch === snapshot.baseBranch ? undefined : mrUrl,
      reason:
        snapshot.branch === snapshot.baseBranch
          ? "Current branch is the base branch; record direct push instead of creating an MR."
          : mrUrl
            ? "Use this compare URL or pass --create to attempt gh pr create."
            : "Could not infer GitHub compare URL from remote."
    }
  };
}

async function commitChanges(defaultMessage) {
  const files = [...asList(args.file), ...asList(args.files)];
  const message = typeof args.message === "string" && args.message.trim() ? args.message.trim() : defaultMessage;
  if (files.length === 0) {
    return {
      status: "failed",
      message,
      reason: "Refusing to commit without explicit --file or --files input."
    };
  }
  try {
    await execFileAsync("git", ["add", "--", ...files], { cwd: root });
    await execFileAsync("git", ["commit", "-m", message], { cwd: root });
    const hash = await gitOutput(["rev-parse", "--short", "HEAD"], "");
    return { status: "created", message, hash };
  } catch (error) {
    return {
      status: "failed",
      message,
      reason: error instanceof Error ? error.message : "git commit failed"
    };
  }
}

async function pushBranch(snapshot) {
  const remoteName = typeof args.remote === "string" && args.remote.trim() ? args.remote.trim() : "origin";
  const branch = typeof args.branch === "string" && args.branch.trim() ? args.branch.trim() : snapshot.branch;
  if (!branch || branch === "HEAD" || branch === snapshot.baseBranch) {
    return {
      status: "skipped",
      remote: snapshot.remote,
      branch,
      reason: "Current branch is not a pushable task branch."
    };
  }
  try {
    await execFileAsync("git", ["push", "-u", remoteName, branch], { cwd: root });
    return { status: "pushed", remote: snapshot.remote, branch };
  } catch (error) {
    return {
      status: "failed",
      remote: snapshot.remote,
      branch,
      reason: error instanceof Error ? error.message : "git push failed"
    };
  }
}

async function createOrRecordMr(run, snapshot) {
  const url = compareUrl(snapshot.remote, snapshot.baseBranch, snapshot.branch);
  const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : run.title;
  if (snapshot.branch === snapshot.baseBranch) {
    return {
      status: "skipped",
      title,
      reason: "Current branch is the base branch; no MR was created."
    };
  }
  if (args.create !== true) {
    return {
      status: url ? "manual" : "pending",
      title,
      url,
      reason: url ? "Manual compare URL recorded. Pass --create to attempt gh pr create." : "Could not infer compare URL."
    };
  }
  try {
    const { stdout } = await execFileAsync("gh", ["pr", "create", "--fill", "--title", title], { cwd: root });
    return {
      status: "created",
      title,
      url: stdout.trim().split("\n").at(-1) || url
    };
  } catch (error) {
    return {
      status: "failed",
      title,
      url,
      reason: error instanceof Error ? error.message : "gh pr create failed"
    };
  }
}

async function persistGitState(run, git, completedAction) {
  await mkdir(runDir, { recursive: true });
  await mkdir(gitDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(gitDir, `${run.id}.json`), `${JSON.stringify(git, null, 2)}\n`, "utf8");
  await writeFile(join(runDir, `${run.id}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");

  const taskPath = join(taskDir, `${run.id}.json`);
  const taskRaw = await readFile(taskPath, "utf8").catch(() => "");
  if (taskRaw.trim()) {
    const task = JSON.parse(taskRaw);
    task.artifacts = { ...task.artifacts, gitRecord: `.harness/git/${run.id}.json` };
    updateTaskFromGit(task, git, completedAction);
    await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, "utf8");
  }
}

function updateTaskFromGit(task, git, completedAction) {
  const updates = {
    review: {
      id: "git-change-review",
      status: "passed",
      evidence: [`branch=${git.review.branch}`, `changed=${git.review.changedFiles.length}`, ...git.review.statusShort.slice(0, 20)],
      notes: [...git.review.notes, `Recommended commit: ${git.review.recommendedCommitMessage}`]
    },
    commit: {
      id: "git-commit",
      status: gitStepStatus(git.commit.status),
      evidence: [git.commit.hash ? `commit=${git.commit.hash}` : `message=${git.commit.message}`],
      notes: git.commit.reason ? [git.commit.reason] : []
    },
    push: {
      id: "git-push",
      status: gitStepStatus(git.push.status),
      evidence: [`remote=${git.push.remote}`, `branch=${git.push.branch}`],
      notes: git.push.reason ? [git.push.reason] : []
    },
    mr: {
      id: "mr-create",
      status: git.mr.status === "manual" ? "passed" : gitStepStatus(git.mr.status),
      evidence: [git.mr.url ?? git.mr.title],
      notes: git.mr.reason ? [git.mr.reason] : []
    }
  };
  const update = updates[completedAction];
  if (update) {
    markTaskStep(task, update.id, update.status, update.evidence, update.notes);
  }
}

function markTaskStep(task, stepId, status, evidence, notes) {
  const step = task.flow?.steps?.find((item) => item.id === stepId);
  if (!step) {
    return;
  }
  const at = new Date().toISOString();
  step.status = status;
  step.startedAt = step.startedAt ?? at;
  if (["passed", "failed", "blocked", "skipped"].includes(status)) {
    step.completedAt = at;
  }
  step.evidence = appendUnique(step.evidence ?? [], evidence);
  step.notes = appendUnique(step.notes ?? [], notes);
  task.currentStepId = stepId;
  task.updatedAt = at;
}

function gitStepStatus(status) {
  if (status === "created" || status === "pushed") {
    return "passed";
  }
  if (status === "manual") {
    return "passed";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "skipped") {
    return "skipped";
  }
  return "pending";
}

async function gitOutput(gitArgs, fallback) {
  try {
    const { stdout } = await execFileAsync("git", gitArgs, { cwd: root });
    return stdout.trim();
  } catch {
    return fallback;
  }
}

function recommendedCommitMessageFor(run) {
  const prefix = run.type === "bugfix" ? "fix" : run.type === "polish" ? "polish" : "feat";
  const summary = String(run.title ?? "")
    .replace(/^Fix:\s*/i, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, " ")
    .trim()
    .slice(0, 56)
    .toLowerCase();
  return `${prefix}: ${summary || "complete harness workflow"}`;
}

function compareUrl(remote, baseBranch, branch) {
  const normalized = remote.endsWith(".git") ? remote.slice(0, -4) : remote;
  const sshMatch = normalized.match(/^git@github\.com:(.+\/.+)$/);
  const httpsMatch = normalized.match(/^https:\/\/github\.com\/(.+\/.+)$/);
  const repo = sshMatch?.[1] ?? httpsMatch?.[1];
  if (!repo || !branch || branch === "HEAD") {
    return undefined;
  }
  return `https://github.com/${repo}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(branch)}?expand=1`;
}

function parseArgs(tokens) {
  const parsed = { _: [] };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--") {
      continue;
    }
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = tokens[index + 1];
    const value = next && next !== "--" && !next.startsWith("--") ? next : true;
    if (value !== true) {
      index += 1;
    }
    if (parsed[key] === undefined) {
      parsed[key] = value;
    } else if (Array.isArray(parsed[key])) {
      parsed[key].push(value);
    } else {
      parsed[key] = [parsed[key], value];
    }
  }
  return parsed;
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.flatMap(asList);
  }
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function appendUnique(target, values) {
  return [...target, ...values.filter((value) => !target.includes(value))];
}
