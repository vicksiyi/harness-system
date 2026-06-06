import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { healthCheck, rpcCall } from "@harness/rpc-client";
import {
  addLog,
  asRecord,
  createRpcServer,
  servicePort,
  servicePorts,
  type CodingResult,
  type DeploymentResult,
  type HarnessTaskFile,
  type RequirementAnalysis,
  type ServiceHealth,
  type TestResult,
  type WorkflowInput,
  type WorkflowRun,
  type WorkflowType
} from "@harness/shared";
import {
  attachAnalysis,
  attachAnalysisToTask,
  attachCodingToTask,
  attachDeployment,
  attachDeploymentToTask,
  attachGitCommitToTask,
  attachGitIntegration,
  attachGitPushToTask,
  attachGitReviewToTask,
  attachMrCreateToTask,
  attachTestResult,
  attachTestsToTask,
  completeOrBlockAfterDeploy,
  createHarnessTaskFile,
  createWorkflowRun,
  decideAfterTest,
  finalizeTask,
  markTaskStep,
  summarizeRelease,
  summarizeRun,
  transition
} from "@harness/workflow-core";
import { inspectGitIntegration } from "./git-adapter.js";

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = process.env.HARNESS_ROOT ?? join(here, "../../..");
const runDir = join(rootDir, ".harness", "runs");
const taskDir = join(rootDir, ".harness", "tasks");
const gitDir = join(rootDir, ".harness", "git");
const docsDir = join(rootDir, "docs");

const serviceUrls = {
  requirements: process.env.REQUIREMENTS_RPC_URL ?? `http://localhost:${servicePort("requirements", undefined)}`,
  coding: process.env.CODING_RPC_URL ?? `http://localhost:${servicePort("coding", undefined)}`,
  testing: process.env.TESTING_RPC_URL ?? `http://localhost:${servicePort("testing", undefined)}`,
  deploy: process.env.DEPLOY_RPC_URL ?? `http://localhost:${servicePort("deploy", undefined)}`
};
const validationTimeoutMs = Number(process.env.HARNESS_VALIDATION_TIMEOUT_MS ?? 90000);

const runs = new Map<string, WorkflowRun>();
const tasks = new Map<string, HarnessTaskFile>();

function inferType(value: unknown): WorkflowType {
  return value === "bugfix" || value === "polish" || value === "requirement" ? value : "requirement";
}

function workflowInput(params: unknown): WorkflowInput {
  const record = asRecord(params);
  return {
    type: inferType(record.type),
    prompt: typeof record.prompt === "string" ? record.prompt : "Run the harness workflow.",
    requestedBy: typeof record.requestedBy === "string" ? record.requestedBy : "codex",
    targetProject: typeof record.targetProject === "string" ? record.targetProject : "apps/mindmap-editor"
  };
}

async function persistRun(run: WorkflowRun): Promise<void> {
  await mkdir(runDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(runDir, `${run.id}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  if (run.git) {
    await mkdir(gitDir, { recursive: true });
    await writeFile(join(gitDir, `${run.id}.json`), `${JSON.stringify(run.git, null, 2)}\n`, "utf8");
  }
  await writeFile(join(docsDir, "generated-mr-summary.md"), `${run.mrSummary ?? summarizeRun(run)}\n`, "utf8");
  await writeFile(join(docsDir, "release-notes.md"), `${run.releaseNotes ?? summarizeRelease(run)}\n`, "utf8");
}

async function persistTask(task: HarnessTaskFile): Promise<void> {
  await mkdir(taskDir, { recursive: true });
  await writeFile(join(taskDir, `${task.runId}.json`), `${JSON.stringify(task, null, 2)}\n`, "utf8");
}

async function persistWorkflowState(run: WorkflowRun, task: HarnessTaskFile): Promise<void> {
  await persistRun(run);
  await persistTask(task);
}

async function createWorkflow(params: unknown): Promise<WorkflowRun> {
  const run = createWorkflowRun(workflowInput(params));
  const task = createHarnessTaskFile(run);
  markTaskStep(task, "intake", "passed", {
    evidence: [task.artifacts.runJson, task.artifacts.taskJson],
    notes: [`Prompt: ${run.prompt}`, `Target: ${run.targetProject}`]
  });
  runs.set(run.id, run);
  tasks.set(run.id, task);
  await persistWorkflowState(run, task);
  return run;
}

async function runWorkflow(params: unknown): Promise<WorkflowRun> {
  const record = asRecord(params);
  const run =
    typeof record.runId === "string" && runs.has(record.runId)
      ? (runs.get(record.runId) as WorkflowRun)
      : await createWorkflow(params);
  const task = await getOrCreateTask(run);

  try {
    transition(run, "analyzing", { message: "Analyzing natural-language task" });
    markTaskStep(task, "requirement-analysis", "in_progress", {
      notes: ["Calling requirements-rpc analyze."]
    });
    await persistWorkflowState(run, task);
    const analysis = await rpcCall<{ type: WorkflowType; prompt: string; targetProject: string }, RequirementAnalysis>(
      serviceUrls.requirements,
      "analyze",
      { type: run.type, prompt: run.prompt, targetProject: run.targetProject }
    );
    attachAnalysis(run, analysis);
    attachAnalysisToTask(task, analysis);
    addLog(run, "requirements-rpc", "Structured requirement analysis completed", "info", analysis);
    await persistWorkflowState(run, task);

    transition(run, "planning", { message: "Planning implementation and validation path" });
    markTaskStep(task, "implementation-planning", "in_progress", {
      notes: ["Calling coding-rpc planAndPatch."]
    });
    await persistWorkflowState(run, task);
    transition(run, "coding", { message: "Requesting simulated coding patch plan" });
    const coding = await rpcCall<unknown, CodingResult>(serviceUrls.coding, "planAndPatch", {
      runId: run.id,
      type: run.type,
      prompt: run.prompt,
      targetProject: run.targetProject,
      analysis
    });
    run.coding = coding;
    attachCodingToTask(task, coding.patchPlan.files, coding.patchPlan.steps);
    addLog(run, "coding-rpc", "Patch plan and change summary produced", "info", coding.patchPlan);
    await persistWorkflowState(run, task);

    transition(run, "testing", { message: "Running validation loop" });
    markTaskStep(task, "automated-testing", "in_progress", {
      evidence: coding.testSuggestions,
      notes: ["Calling testing-rpc runTests."]
    });
    await persistWorkflowState(run, task);
    let testResult = await rpcCall<unknown, TestResult>(serviceUrls.testing, "runTests", {
      runId: run.id,
      type: run.type,
      prompt: run.prompt,
      targetProject: run.targetProject,
      attempt: 1
    }, validationTimeoutMs);
    attachTestResult(run, testResult);
    attachTestsToTask(task, testResult);
    addLog(run, "testing-rpc", testResult.passed ? "Initial validation passed" : "Initial validation failed", testResult.passed ? "info" : "warn", {
      failures: testResult.failures,
      suggestions: testResult.suggestions
    });
    await persistWorkflowState(run, task);

    let next = decideAfterTest(run);
    while (next === "fixing") {
      transition(run, "fixing", { message: "Applying automated fix suggestion", data: testResult.failures });
      markTaskStep(task, "coding", "in_progress", {
        evidence: testResult.failures.map((failure) => failure.evidence),
        notes: testResult.suggestions
      });
      addLog(run, "coding-rpc", "Applied simulated fix from testing-rpc suggestion", "info", {
        suggestions: testResult.suggestions
      });
      transition(run, "retesting", { message: "Rerunning validation after fix" });
      markTaskStep(task, "automated-testing", "in_progress", {
        evidence: [`retry attempt ${run.attempts + 1}`],
        notes: ["Rerunning testing-rpc after simulated fix."]
      });
      await persistWorkflowState(run, task);
      testResult = await rpcCall<unknown, TestResult>(serviceUrls.testing, "runTests", {
        runId: run.id,
        type: run.type,
        prompt: run.prompt,
        targetProject: run.targetProject,
        attempt: run.attempts + 1
      }, validationTimeoutMs);
      attachTestResult(run, testResult);
      attachTestsToTask(task, testResult);
      addLog(run, "testing-rpc", testResult.passed ? "Regression validation passed" : "Regression validation failed", testResult.passed ? "info" : "warn", {
        failures: testResult.failures,
        suggestions: testResult.suggestions
      });
      await persistWorkflowState(run, task);
      next = decideAfterTest(run);
    }

    if (next === "blocked") {
      run.blocker = testResult.failures.map((failure) => failure.reason).join(", ") || "Validation did not pass.";
      transition(run, "blocked", { message: "Workflow blocked by validation failure", data: testResult.failures });
      markTaskStep(task, "automated-testing", "blocked", {
        evidence: testResult.failures.map((failure) => failure.evidence),
        notes: testResult.suggestions
      });
      finalizeTask(task, run);
      await persistWorkflowState(run, task);
      return run;
    }

    transition(run, "reviewing", { message: "Reviewing git changes and commit boundary" });
    markTaskStep(task, "git-change-review", "in_progress", {
      notes: ["Inspecting branch, remote, status, and changed files."]
    });
    await persistWorkflowState(run, task);
    const git = await inspectGitIntegration(run, rootDir);
    attachGitIntegration(run, git);
    attachGitReviewToTask(task, git.review);
    await persistWorkflowState(run, task);

    transition(run, "committing", { message: "Recording git commit handoff" });
    attachGitCommitToTask(task, git.commit);
    addLog(run, "orchestrator-rpc", "Git commit step recorded for Codex Skill execution", git.commit.status === "failed" ? "error" : "info", git.commit);
    await persistWorkflowState(run, task);

    transition(run, "pushing", { message: "Recording git push handoff" });
    attachGitPushToTask(task, git.push);
    addLog(run, "orchestrator-rpc", "Git push step recorded for Codex Skill execution", git.push.status === "failed" ? "error" : "info", git.push);
    await persistWorkflowState(run, task);

    transition(run, "summarizing", { message: "Generating MR summary and release notes" });
    run.mrSummary = summarizeRun(run);
    run.releaseNotes = summarizeRelease(run);
    markTaskStep(task, "mr-summary", "passed", {
      evidence: [task.artifacts.mrSummary, task.artifacts.releaseNotes],
      notes: ["Generated summary before deployment."]
    });
    await persistWorkflowState(run, task);

    transition(run, "creating-mr", { message: "Recording MR creation handoff" });
    attachMrCreateToTask(task, git.mr);
    addLog(run, "orchestrator-rpc", "MR creation step recorded for Codex Skill execution", git.mr.status === "failed" ? "error" : "info", git.mr);
    await persistWorkflowState(run, task);

    transition(run, "deploying", { message: "Recording Docker Compose deployment check" });
    markTaskStep(task, "deployment", "in_progress", {
      notes: ["Calling deploy-rpc deploy."]
    });
    await persistWorkflowState(run, task);
    const deployment = await rpcCall<unknown, DeploymentResult>(serviceUrls.deploy, "deploy", {
      runId: run.id,
      target: "docker-compose-local"
    });
    attachDeployment(run, deployment);
    attachDeploymentToTask(task, deployment);
    transition(run, completeOrBlockAfterDeploy(run), {
      message: deployment.status === "healthy" ? "Workflow completed successfully" : "Workflow blocked by deployment health"
    });
    run.mrSummary = summarizeRun(run);
    run.releaseNotes = summarizeRelease(run);
    finalizeTask(task, run);
    await persistWorkflowState(run, task);
    return run;
  } catch (error) {
    run.blocker = error instanceof Error ? error.message : "Unknown orchestration failure";
    addLog(run, "orchestrator-rpc", run.blocker, "error");
    if (run.stage !== "failed" && run.stage !== "blocked" && run.stage !== "completed") {
      transition(run, "failed", { message: "Workflow failed during orchestration", data: { error: run.blocker } });
    }
    task.blockers.push(run.blocker);
    finalizeTask(task, run);
    await persistWorkflowState(run, task);
    return run;
  }
}

async function getOrCreateTask(run: WorkflowRun): Promise<HarnessTaskFile> {
  if (tasks.has(run.id)) {
    return tasks.get(run.id) as HarnessTaskFile;
  }
  try {
    const raw = await readFile(join(taskDir, `${run.id}.json`), "utf8");
    const task = JSON.parse(raw) as HarnessTaskFile;
    tasks.set(run.id, task);
    return task;
  } catch {
    const task = createHarnessTaskFile(run);
    tasks.set(run.id, task);
    await persistTask(task);
    return task;
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
      url: `http://localhost:${servicePort("orchestrator")}`,
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
  port: servicePort("orchestrator"),
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
