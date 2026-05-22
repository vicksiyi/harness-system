#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const logDir = join(root, ".harness", "logs");
const runDir = join(root, ".harness", "runs");
const serviceLog = join(logDir, "dev-services.log");
const portOffset = Number(process.env.HARNESS_PORT_OFFSET ?? 0) || 0;
const port = (base) => base + portOffset;
const orchestratorUrl = process.env.ORCHESTRATOR_RPC_URL ?? `http://localhost:${port(4100)}`;
const services = [
  ["orchestrator", `http://localhost:${port(4100)}`],
  ["requirements", `http://localhost:${port(4101)}`],
  ["coding", `http://localhost:${port(4102)}`],
  ["testing", `http://localhost:${port(4103)}`],
  ["deploy", `http://localhost:${port(4104)}`]
];

const type = process.argv[2] ?? "requirement";
const prompt = process.argv.slice(3).join(" ").trim() || "Run a full harness workflow.";
const targetProject = process.env.HARNESS_TARGET_PROJECT ?? "apps/mindmap-editor";

if (!["requirement", "bugfix", "polish"].includes(type)) {
  console.error(`Unknown workflow type "${type}". Use requirement, bugfix, or polish.`);
  process.exit(2);
}

await mkdir(logDir, { recursive: true });

let child;
try {
  const alreadyHealthy = await allHealthy(1000);
  if (!alreadyHealthy && process.env.HARNESS_SKIP_BOOT !== "1") {
    child = await startServices();
    await waitForServices(30000);
  } else if (!alreadyHealthy) {
    throw new Error("RPC services are not healthy and HARNESS_SKIP_BOOT=1 was set.");
  }

  const run = await rpc("runWorkflow", { type, prompt, requestedBy: "codex-skill", targetProject });
  await appendJournal(run);
  await writeWorkflowOutput(run);
  console.log(JSON.stringify({ id: run.id, status: run.status, stage: run.stage, title: run.title }, null, 2));
  process.exitCode = run.status === "passed" ? 0 : 1;
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown workflow script failure";
  await appendFile(join(root, "docs", "agent-journal.md"), `\n## Workflow Script Failure\n\n- At: ${new Date().toISOString()}\n- Type: ${type}\n- Prompt: ${prompt}\n- Error: ${message}\n`);
  console.error(message);
  process.exitCode = 1;
} finally {
  if (child) {
    child.kill("SIGTERM");
  }
}

async function startServices() {
  const stream = createWriteStream(serviceLog, { flags: "a" });
  stream.write(`\n# pnpm dev:services ${new Date().toISOString()} offset=${portOffset}\n`);
  const proc = spawn("pnpm", ["dev:services"], {
    cwd: root,
    env: { ...process.env, HARNESS_ROOT: root },
    stdio: ["ignore", "pipe", "pipe"]
  });
  proc.stdout.pipe(stream);
  proc.stderr.pipe(stream);
  proc.on("exit", (code) => {
    stream.write(`\n# dev:services exited with ${code}\n`);
    stream.end();
  });
  return proc;
}

async function waitForServices(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await allHealthy(1000)) {
      return;
    }
    await sleep(750);
  }
  throw new Error(`Services did not become healthy within ${timeoutMs}ms. See ${serviceLog}`);
}

async function allHealthy(timeoutMs) {
  const checks = await Promise.all(
    services.map(async ([, url]) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        return response.ok;
      } catch {
        return false;
      }
    })
  );
  return checks.every(Boolean);
}

async function rpc(method, params) {
  const response = await fetch(`${orchestratorUrl}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: `script_${Date.now()}`, method, params })
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? `RPC ${method} failed`);
  }
  return body.result;
}

async function appendJournal(run) {
  const entry = [
    "",
    `## Run ${run.id}`,
    "",
    `- At: ${new Date().toISOString()}`,
    `- Type: ${run.type}`,
    `- Prompt: ${run.prompt}`,
    `- Target project: ${run.targetProject}`,
    `- Result: ${run.status} at ${run.stage}`,
    `- Tests: ${run.tests?.passed ? "passed" : "not passed"} with score ${run.tests?.score ?? "n/a"}`,
    `- Deployment: ${run.deployment?.status ?? "not run"}`,
    `- MR Summary: docs/generated-mr-summary.md`
  ].join("\n");
  await appendFile(join(root, "docs", "agent-journal.md"), `${entry}\n`);

  const testEntry = [
    "",
    `## Workflow Validation ${run.id}`,
    "",
    `- Command: pnpm workflow:${run.type} "${run.prompt}"`,
    `- Target project: ${run.targetProject}`,
    `- Result: ${run.tests?.passed ? "passed" : "failed or skipped"}`,
    `- Attempts: ${run.attempts}/${run.maxAttempts}`,
    `- Log summary: ${(run.tests?.rawLog ?? "No test log").split("\n").join(" | ")}`,
    `- Fix actions: ${run.events.filter((event) => event.stage === "fixing").map((event) => event.message).join("; ") || "none"}`
  ].join("\n");
  await appendFile(join(root, "docs", "test-log.md"), `${testEntry}\n`);
}

async function writeWorkflowOutput(run) {
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, `${run.id}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  if (run.mrSummary) {
    await writeFile(join(root, "docs", "generated-mr-summary.md"), `${run.mrSummary}\n`, "utf8");
  }
  if (run.releaseNotes) {
    await writeFile(join(root, "docs", "release-notes.md"), `${run.releaseNotes}\n`, "utf8");
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
