import {
  addEvent,
  addLog,
  createId,
  nowIso,
  titleFromPrompt,
  type DeploymentResult,
  type RequirementAnalysis,
  type TestResult,
  type WorkflowInput,
  type WorkflowRun,
  type WorkflowStage,
  type WorkflowStatus
} from "@harness/shared";

export const terminalStages = new Set<WorkflowStage>(["completed", "blocked", "failed"]);

export const allowedTransitions: Record<WorkflowStage, WorkflowStage[]> = {
  created: ["analyzing", "failed"],
  analyzing: ["planning", "blocked", "failed"],
  planning: ["coding", "blocked", "failed"],
  coding: ["testing", "blocked", "failed"],
  testing: ["fixing", "summarizing", "blocked", "failed"],
  fixing: ["retesting", "blocked", "failed"],
  retesting: ["fixing", "summarizing", "blocked", "failed"],
  summarizing: ["deploying", "blocked", "failed"],
  deploying: ["completed", "blocked", "failed"],
  completed: [],
  blocked: [],
  failed: []
};

export interface TransitionOptions {
  message?: string;
  status?: WorkflowStatus;
  data?: unknown;
}

export function createWorkflowRun(input: WorkflowInput): WorkflowRun {
  const at = nowIso();
  const run: WorkflowRun = {
    id: createId("run"),
    type: input.type,
    title: titleFromPrompt(input.type, input.prompt),
    prompt: input.prompt,
    stage: "created",
    status: "queued",
    attempts: 0,
    maxAttempts: 2,
    createdAt: at,
    updatedAt: at,
    events: [],
    logs: []
  };
  addEvent(run, "created", `Created ${input.type} workflow`, "info", { requestedBy: input.requestedBy ?? "codex" });
  addLog(run, "workflow-core", "Workflow run initialized", "info", { type: input.type });
  return run;
}

export function transition(run: WorkflowRun, next: WorkflowStage, options: TransitionOptions = {}): WorkflowRun {
  const allowed = allowedTransitions[run.stage] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid workflow transition from ${run.stage} to ${next}`);
  }

  run.stage = next;
  run.status = options.status ?? statusForStage(next);
  addEvent(run, next, options.message ?? `Transitioned to ${next}`, eventLevelForStage(next), options.data);
  addLog(run, "workflow-core", `Stage changed to ${next}`, eventLevelForStage(next));
  return run;
}

export function attachAnalysis(run: WorkflowRun, analysis: RequirementAnalysis): WorkflowRun {
  run.analysis = analysis;
  run.title = analysis.title;
  addEvent(run, run.stage, "Requirement analysis attached", "info", {
    acceptanceCriteria: analysis.acceptanceCriteria.length,
    riskCount: analysis.risks.length
  });
  return run;
}

export function attachTestResult(run: WorkflowRun, result: TestResult): WorkflowRun {
  run.tests = result;
  run.attempts = result.attempts;
  addEvent(run, run.stage, result.passed ? "Tests passed" : "Tests failed", result.passed ? "info" : "warn", {
    score: result.score,
    failures: result.failures
  });
  return run;
}

export function decideAfterTest(run: WorkflowRun): WorkflowStage {
  if (!run.tests) {
    return "blocked";
  }

  if (run.tests.passed) {
    return "summarizing";
  }

  return run.attempts < run.maxAttempts ? "fixing" : "blocked";
}

export function attachDeployment(run: WorkflowRun, deployment: DeploymentResult): WorkflowRun {
  run.deployment = deployment;
  addEvent(run, run.stage, `Deployment ${deployment.status}`, deployment.status === "healthy" ? "info" : "warn", deployment);
  return run;
}

export function completeOrBlockAfterDeploy(run: WorkflowRun): WorkflowStage {
  if (run.deployment?.status === "healthy") {
    return "completed";
  }
  run.blocker = run.deployment?.rollbackSuggestion ?? "Deployment health checks did not pass.";
  return "blocked";
}

export function statusForStage(stage: WorkflowStage): WorkflowStatus {
  if (stage === "completed") return "passed";
  if (stage === "blocked") return "blocked";
  if (stage === "failed") return "failed";
  if (stage === "created") return "queued";
  return "running";
}

export function eventLevelForStage(stage: WorkflowStage) {
  if (stage === "blocked" || stage === "failed") return "error" as const;
  return "info" as const;
}

export function scoreRun(run: WorkflowRun): number {
  const stageScore: Record<WorkflowStage, number> = {
    created: 5,
    analyzing: 15,
    planning: 25,
    coding: 40,
    testing: 55,
    fixing: 50,
    retesting: 65,
    summarizing: 75,
    deploying: 90,
    completed: 100,
    blocked: Math.max(30, run.tests?.score ?? 35),
    failed: 0
  };
  return stageScore[run.stage];
}

export function summarizeRun(run: WorkflowRun): string {
  const tests = run.tests
    ? `Tests: ${run.tests.passed ? "passed" : "failed"} via \`${run.tests.command}\` with score ${run.tests.score}.`
    : "Tests: not run.";
  const deploy = run.deployment ? `Deployment: ${run.deployment.status} on ${run.deployment.target}.` : "Deployment: not run.";
  return [
    `# MR Summary: ${run.title}`,
    "",
    `Type: ${run.type}`,
    `Status: ${run.status}`,
    `Stage: ${run.stage}`,
    "",
    "## Background",
    run.prompt,
    "",
    "## Scope",
    ...(run.analysis?.scope.map((item) => `- ${item}`) ?? ["- Scope analysis not available."]),
    "",
    "## Changes",
    ...(run.coding?.changeSummary.map((item) => `- ${item}`) ?? ["- Change summary not available."]),
    "",
    "## Validation",
    `- ${tests}`,
    `- ${deploy}`,
    "",
    "## Risks",
    ...(run.analysis?.risks.map((risk) => `- ${risk}`) ?? ["- No risks recorded."]),
    "",
    "## Rollback",
    "- Revert the feature branch or disable the generated workflow route from the orchestrator.",
    "",
    "## Follow-ups",
    "- Review run logs and acceptance criteria before merging."
  ].join("\n");
}

export function summarizeRelease(run: WorkflowRun): string {
  return [
    `# Release Notes: ${run.title}`,
    "",
    `- Workflow type: ${run.type}`,
    `- Result: ${run.status}`,
    `- Score: ${scoreRun(run)}`,
    `- Deployment: ${run.deployment?.status ?? "not run"}`,
    "",
    "## Operator Notes",
    "- Run `pnpm health` after deployment.",
    "- Inspect `.harness/runs` for the full JSON execution record."
  ].join("\n");
}

