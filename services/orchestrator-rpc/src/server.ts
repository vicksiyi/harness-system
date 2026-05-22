import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { healthCheck, rpcCall } from "@harness/rpc-client";
import {
  addLog,
  asRecord,
  createRpcServer,
  servicePorts,
  type CodingResult,
  type DeploymentResult,
  type RequirementAnalysis,
  type ServiceHealth,
  type TestResult,
  type WorkflowInput,
  type WorkflowRun,
  type WorkflowType
} from "@harness/shared";
import {
  attachAnalysis,
  attachDeployment,
  attachTestResult,
  completeOrBlockAfterDeploy,
  createWorkflowRun,
  decideAfterTest,
  summarizeRelease,
  summarizeRun,
  transition
} from "@harness/workflow-core";

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = process.env.HARNESS_ROOT ?? join(here, "../../..");
const runDir = join(rootDir, ".harness", "runs");
const docsDir = join(rootDir, "docs");

const serviceUrls = {
  requirements: process.env.REQUIREMENTS_RPC_URL ?? `http://localhost:${servicePorts.requirements}`,
  coding: process.env.CODING_RPC_URL ?? `http://localhost:${servicePorts.coding}`,
  testing: process.env.TESTING_RPC_URL ?? `http://localhost:${servicePorts.testing}`,
  deploy: process.env.DEPLOY_RPC_URL ?? `http://localhost:${servicePorts.deploy}`
};

const runs = new Map<string, WorkflowRun>();

function inferType(value: unknown): WorkflowType {
  return value === "bugfix" || value === "polish" || value === "requirement" ? value : "requirement";
}

function workflowInput(params: unknown): WorkflowInput {
  const record = asRecord(params);
  return {
    type: inferType(record.type),
    prompt: typeof record.prompt === "string" ? record.prompt : "Run the harness workflow.",
    requestedBy: typeof record.requestedBy === "string" ? record.requestedBy : "codex",
    targetProject: typeof record.targetProject === "string" ? record.targetProject : "apps/card-editor"
  };
}

async function persistRun(run: WorkflowRun): Promise<void> {
  await mkdir(runDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(runDir, `${run.id}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await writeFile(join(docsDir, "generated-mr-summary.md"), `${run.mrSummary ?? summarizeRun(run)}\n`, "utf8");
  await writeFile(join(docsDir, "release-notes.md"), `${run.releaseNotes ?? summarizeRelease(run)}\n`, "utf8");
}

async function createWorkflow(params: unknown): Promise<WorkflowRun> {
  const run = createWorkflowRun(workflowInput(params));
  runs.set(run.id, run);
  await persistRun(run);
  return run;
}

async function runWorkflow(params: unknown): Promise<WorkflowRun> {
  const record = asRecord(params);
  const run =
    typeof record.runId === "string" && runs.has(record.runId)
      ? (runs.get(record.runId) as WorkflowRun)
      : await createWorkflow(params);

  try {
    transition(run, "analyzing", { message: "Analyzing natural-language task" });
    const analysis = await rpcCall<{ type: WorkflowType; prompt: string; targetProject: string }, RequirementAnalysis>(
      serviceUrls.requirements,
      "analyze",
      { type: run.type, prompt: run.prompt, targetProject: run.targetProject }
    );
    attachAnalysis(run, analysis);
    addLog(run, "requirements-rpc", "Structured requirement analysis completed", "info", analysis);

    transition(run, "planning", { message: "Planning implementation and validation path" });
    transition(run, "coding", { message: "Requesting simulated coding patch plan" });
    const coding = await rpcCall<unknown, CodingResult>(serviceUrls.coding, "planAndPatch", {
      runId: run.id,
      type: run.type,
      prompt: run.prompt,
      targetProject: run.targetProject,
      analysis
    });
    run.coding = coding;
    addLog(run, "coding-rpc", "Patch plan and change summary produced", "info", coding.patchPlan);

    transition(run, "testing", { message: "Running validation loop" });
    let testResult = await rpcCall<unknown, TestResult>(serviceUrls.testing, "runTests", {
      runId: run.id,
      type: run.type,
      prompt: run.prompt,
      targetProject: run.targetProject,
      attempt: 1
    });
    attachTestResult(run, testResult);
    addLog(run, "testing-rpc", testResult.passed ? "Initial validation passed" : "Initial validation failed", testResult.passed ? "info" : "warn", {
      failures: testResult.failures,
      suggestions: testResult.suggestions
    });

    let next = decideAfterTest(run);
    while (next === "fixing") {
      transition(run, "fixing", { message: "Applying automated fix suggestion", data: testResult.failures });
      addLog(run, "coding-rpc", "Applied simulated fix from testing-rpc suggestion", "info", {
        suggestions: testResult.suggestions
      });
      transition(run, "retesting", { message: "Rerunning validation after fix" });
      testResult = await rpcCall<unknown, TestResult>(serviceUrls.testing, "runTests", {
        runId: run.id,
        type: run.type,
        prompt: run.prompt,
        targetProject: run.targetProject,
        attempt: run.attempts + 1
      });
      attachTestResult(run, testResult);
      addLog(run, "testing-rpc", testResult.passed ? "Regression validation passed" : "Regression validation failed", testResult.passed ? "info" : "warn", {
        failures: testResult.failures,
        suggestions: testResult.suggestions
      });
      next = decideAfterTest(run);
    }

    if (next === "blocked") {
      run.blocker = testResult.failures.map((failure) => failure.reason).join(", ") || "Validation did not pass.";
      transition(run, "blocked", { message: "Workflow blocked by validation failure", data: testResult.failures });
      await persistRun(run);
      return run;
    }

    transition(run, "summarizing", { message: "Generating MR summary and release notes" });
    run.mrSummary = summarizeRun(run);
    run.releaseNotes = summarizeRelease(run);
    await persistRun(run);

    transition(run, "deploying", { message: "Recording Docker Compose deployment check" });
    const deployment = await rpcCall<unknown, DeploymentResult>(serviceUrls.deploy, "deploy", {
      runId: run.id,
      target: "docker-compose-local"
    });
    attachDeployment(run, deployment);
    transition(run, completeOrBlockAfterDeploy(run), {
      message: deployment.status === "healthy" ? "Workflow completed successfully" : "Workflow blocked by deployment health"
    });
    run.mrSummary = summarizeRun(run);
    run.releaseNotes = summarizeRelease(run);
    await persistRun(run);
    return run;
  } catch (error) {
    run.blocker = error instanceof Error ? error.message : "Unknown orchestration failure";
    addLog(run, "orchestrator-rpc", run.blocker, "error");
    if (run.stage !== "failed" && run.stage !== "blocked" && run.stage !== "completed") {
      transition(run, "failed", { message: "Workflow failed during orchestration", data: { error: run.blocker } });
    }
    await persistRun(run);
    return run;
  }
}

async function listWorkflows(): Promise<WorkflowRun[]> {
  return [...runs.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function getWorkflow(params: unknown): Promise<WorkflowRun | null> {
  const record = asRecord(params);
  if (typeof record.runId !== "string") {
    return null;
  }
  if (runs.has(record.runId)) {
    return runs.get(record.runId) ?? null;
  }
  try {
    const raw = await readFile(join(runDir, `${record.runId}.json`), "utf8");
    const run = JSON.parse(raw) as WorkflowRun;
    runs.set(run.id, run);
    return run;
  } catch {
    return null;
  }
}

async function dependencyHealth() {
  const entries = await Promise.all(
    Object.entries(serviceUrls).map(async ([name, url]) => ({
      name,
      url,
      health: await healthCheck(url)
    }))
  );
  return entries;
}

async function serviceHealth() {
  return [
    {
      name: "orchestrator",
      url: `http://localhost:${process.env.PORT ?? servicePorts.orchestrator}`,
      health: {
        service: "orchestrator-rpc",
        status: "ok" as const,
        at: new Date().toISOString(),
        details: { runCount: runs.size }
      }
    },
    ...(await dependencyHealth())
  ];
}

createRpcServer({
  serviceName: "orchestrator-rpc",
  port: Number(process.env.PORT ?? servicePorts.orchestrator),
  methods: {
    createWorkflow,
    runWorkflow,
    listWorkflows,
    getWorkflow,
    serviceHealth
  },
  health: async (): Promise<ServiceHealth> => ({
    service: "orchestrator-rpc",
    status: "ok",
    at: new Date().toISOString(),
    details: {
      runCount: runs.size,
      dependencies: await dependencyHealth()
    }
  })
});
