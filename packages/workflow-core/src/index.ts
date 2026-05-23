import {
  addEvent,
  addLog,
  createId,
  nowIso,
  titleFromPrompt,
  type DeploymentResult,
  type HarnessTaskCase,
  type HarnessTaskFile,
  type HarnessTaskStepId,
  type HarnessTaskStepStatus,
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
    targetProject: input.targetProject ?? "apps/mindmap-editor",
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
  addEvent(run, "created", `Created ${input.type} workflow`, "info", {
    requestedBy: input.requestedBy ?? "codex",
    targetProject: run.targetProject
  });
  addLog(run, "workflow-core", "Workflow run initialized", "info", { type: input.type, targetProject: run.targetProject });
  return run;
}

export function createHarnessTaskFile(run: WorkflowRun): HarnessTaskFile {
  const taskJson = `.harness/tasks/${run.id}.json`;
  return {
    schemaVersion: 1,
    taskId: run.id,
    runId: run.id,
    type: run.type,
    title: run.title,
    prompt: run.prompt,
    targetProject: run.targetProject,
    status: run.status,
    currentStepId: "intake",
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    flow: {
      name: `${run.type} development loop`,
      description: "Stable local execution flow used by Codex Skills to avoid drifting across steps.",
      steps: defaultTaskFlow(run.type)
    },
    acceptanceCriteria: [],
    testCases: [],
    artifacts: {
      runJson: `.harness/runs/${run.id}.json`,
      taskJson,
      mrSummary: "docs/generated-mr-summary.md",
      releaseNotes: "docs/release-notes.md",
      testLog: "docs/test-log.md",
      agentJournal: "docs/agent-journal.md"
    },
    decisions: [
      "Use the task JSON as the stable execution contract before running or editing code.",
      "Keep Harness orchestration and target product changes isolated unless the task explicitly changes Harness."
    ],
    blockers: []
  };
}

export function defaultTaskFlow(type: WorkflowInput["type"]): HarnessTaskFile["flow"]["steps"] {
  const implementationNote =
    type === "bugfix"
      ? "Reproduce or preserve the failure signature before changing behavior."
      : type === "polish"
        ? "Keep the product tool-focused and verify the user-facing improvement."
        : "Implement the smallest coherent change that satisfies acceptance criteria.";

  return [
    taskStep("intake", "Task Intake", "Capture prompt, target project, task type, audit files, and expected artifacts.", "orchestrator-rpc", [], [
      "WorkflowInput",
      "AGENTS.md index"
    ], [".harness/runs/<run-id>.json", ".harness/tasks/<run-id>.json"], ["pnpm workflow:<type> \"<prompt>\""], [
      "Task file exists before later steps run."
    ]),
    taskStep("requirement-analysis", "Requirement Analysis", "Convert natural language into scope, risks, files, and acceptance criteria.", "requirements-rpc", ["intake"], [
      "WorkflowInput",
      "target AGENTS.md"
    ], ["RequirementAnalysis", "acceptanceCriteria[]"], [], [
      "Acceptance criteria are concrete and verifiable."
    ]),
    taskStep("test-case-generation", "Test Case Generation", "Turn acceptance criteria and risk areas into a local validation matrix.", "workflow-core", ["requirement-analysis"], [
      "RequirementAnalysis",
      "risk list"
    ], ["testCases[]"], [], [
      "At least unit, integration/E2E or quality, and deployment checks are considered."
    ]),
    taskStep("implementation-planning", "Implementation Planning", "Produce patch plan, touched files, sequencing, and rollback notes.", "coding-rpc", ["test-case-generation"], [
      "RequirementAnalysis",
      "testCases[]"
    ], ["PatchPlan", "changeSummary[]"], [], [
      "Plan references module AGENTS.md and avoids unrelated refactors."
    ]),
    taskStep("coding", "Coding", implementationNote, "Codex Agent", ["implementation-planning"], [
      "PatchPlan",
      "testCases[]"
    ], ["code diff", "updated tests", "docs updates"], [], [
      "Focused tests are added or updated before risky behavior changes."
    ]),
    taskStep("automated-testing", "Automated Testing", "Run deterministic checks and parse failures into actionable repair advice.", "testing-rpc", ["coding"], [
      "code diff",
      "testCases[]"
    ], ["TestResult", "ParsedFailure[]"], ["pnpm typecheck", "pnpm test", "pnpm target:build", "pnpm target:browser"], [
      "Failures include reason, evidence, and suggestedFix."
    ]),
    taskStep("quality-validation", "Quality Validation", "Use screenshot, accessibility, console, network, and agent-browser checks selected for this task.", "Codex Agent", ["automated-testing"], [
      "TestResult",
      "changed user flows",
      "harness-quality Skill"
    ], ["quality evidence", "screenshot paths", "network/console notes"], ["pnpm quality:agent-browser:doctor", "agent-browser commands chosen by the Agent"], [
      "Validation plan is task-specific, not a hard-coded path.",
      "Any visual or E2E failure is fixed and rerun."
    ]),
    taskStep("mr-summary", "MR Summary", "Generate human-readable summary, risk, rollback, validation, and follow-up notes.", "workflow-core", ["quality-validation"], [
      "WorkflowRun",
      "HarnessTaskFile"
    ], ["docs/generated-mr-summary.md", "docs/release-notes.md"], ["pnpm mr:summary"], [
      "Summary references actual validation evidence."
    ]),
    taskStep("deployment", "Deployment", "Run or record Docker Compose deployment and health checks.", "deploy-rpc", ["mr-summary"], [
      "release notes",
      "deployment target"
    ], ["DeploymentResult"], ["docker compose up --build", "pnpm health"], [
      "Failed deployment includes rollback suggestion."
    ]),
    taskStep("execution-record", "Execution Record", "Persist final run, task flow, test log, journal, and blocker state.", "orchestrator-rpc", ["deployment"], [
      "WorkflowRun",
      "HarnessTaskFile",
      "DeploymentResult"
    ], [".harness/runs/<run-id>.json", ".harness/tasks/<run-id>.json", "docs/test-log.md", "docs/agent-journal.md"], [], [
      "Task JSON and run JSON agree on final status."
    ])
  ];
}

function taskStep(
  id: HarnessTaskStepId,
  title: string,
  purpose: string,
  owner: string,
  dependsOn: HarnessTaskStepId[],
  inputs: string[],
  outputs: string[],
  commands: string[],
  qualityGates: string[]
): HarnessTaskFile["flow"]["steps"][number] {
  return {
    id,
    title,
    purpose,
    owner,
    status: "pending",
    dependsOn,
    inputs,
    outputs,
    commands,
    qualityGates,
    evidence: [],
    notes: []
  };
}

export function updateTaskFromRun(task: HarnessTaskFile, run: WorkflowRun): HarnessTaskFile {
  task.title = run.title;
  task.status = run.status;
  task.updatedAt = run.updatedAt;
  if (run.blocker && !task.blockers.includes(run.blocker)) {
    task.blockers.push(run.blocker);
  }
  return task;
}

export function markTaskStep(
  task: HarnessTaskFile,
  stepId: HarnessTaskStepId,
  status: HarnessTaskStepStatus,
  options: { at?: string; evidence?: string[]; notes?: string[] } = {}
): HarnessTaskFile {
  const step = task.flow.steps.find((item) => item.id === stepId);
  if (!step) {
    throw new Error(`Unknown task flow step: ${stepId}`);
  }
  const at = options.at ?? nowIso();
  step.status = status;
  step.startedAt = step.startedAt ?? at;
  if (status === "passed" || status === "failed" || status === "blocked" || status === "skipped") {
    step.completedAt = at;
  }
  step.evidence = appendUnique(step.evidence, options.evidence ?? []);
  step.notes = appendUnique(step.notes, options.notes ?? []);
  task.currentStepId = stepId;
  task.updatedAt = at;
  return task;
}

export function attachAnalysisToTask(task: HarnessTaskFile, analysis: RequirementAnalysis): HarnessTaskFile {
  task.acceptanceCriteria = analysis.acceptanceCriteria;
  task.testCases = generateTaskCases(analysis);
  markTaskStep(task, "requirement-analysis", "passed", {
    evidence: [`${analysis.acceptanceCriteria.length} acceptance criteria`, `${analysis.risks.length} risks`],
    notes: analysis.scope
  });
  markTaskStep(task, "test-case-generation", "passed", {
    evidence: task.testCases.map((testCase) => `${testCase.id}: ${testCase.title}`),
    notes: ["Generated from acceptance criteria and fixed Harness quality flow."]
  });
  return task;
}

export function attachCodingToTask(task: HarnessTaskFile, files: string[], steps: string[]): HarnessTaskFile {
  markTaskStep(task, "implementation-planning", "passed", {
    evidence: files,
    notes: steps
  });
  markTaskStep(task, "coding", "passed", {
    evidence: files,
    notes: ["Coding phase completed or simulated by coding-rpc; real Codex edits must still be reflected in git diff."]
  });
  return task;
}

export function attachTestsToTask(task: HarnessTaskFile, result: TestResult): HarnessTaskFile {
  const status = result.passed ? "passed" : "failed";
  task.testCases = task.testCases.map((testCase) => {
    if (testCase.type === "deployment") {
      return testCase;
    }
    if (testCase.type === "quality") {
      if (!result.browserQuality) {
        return testCase;
      }
      return {
        ...testCase,
        status: result.browserQuality.passed ? "passed" : "failed",
        evidence: appendUnique(testCase.evidence, [result.browserQuality.command, result.browserQuality.screenshotPath ?? "no screenshot path"])
      };
    }
    return {
      ...testCase,
      status,
      evidence: appendUnique(testCase.evidence, [result.command, ...result.failures.map((failure) => failure.reason)])
    };
  });
  markTaskStep(task, "automated-testing", status, {
    evidence: [result.command, `score=${result.score}`, ...result.failures.map((failure) => failure.reason)],
    notes: result.suggestions
  });
  markTaskStep(task, "quality-validation", result.browserQuality?.passed === false ? "failed" : result.passed ? "passed" : "pending", {
    evidence: result.browserQuality ? [result.browserQuality.command, result.browserQuality.screenshotPath ?? "no screenshot path"] : [],
    notes: result.browserQuality ? ["Deterministic browser quality completed; task-specific agent-browser validation is selected by harness-quality Skill when needed."] : []
  });
  return task;
}

export function attachDeploymentToTask(task: HarnessTaskFile, deployment: DeploymentResult): HarnessTaskFile {
  const evidence = deployment.healthChecks.map((check) => `${check.name}: ${check.ok ? "ok" : "failed"} - ${check.detail}`);
  const status = deployment.status === "healthy" ? "passed" : "blocked";
  task.testCases = task.testCases.map((testCase) =>
    testCase.type === "deployment"
      ? {
          ...testCase,
          status,
          evidence: appendUnique(testCase.evidence, evidence)
        }
      : testCase
  );
  markTaskStep(task, "deployment", status, {
    evidence,
    notes: deployment.rollbackSuggestion ? [deployment.rollbackSuggestion] : []
  });
  return task;
}

export function finalizeTask(task: HarnessTaskFile, run: WorkflowRun): HarnessTaskFile {
  updateTaskFromRun(task, run);
  markTaskStep(task, "mr-summary", run.mrSummary ? "passed" : "pending", {
    evidence: run.mrSummary ? [task.artifacts.mrSummary, task.artifacts.releaseNotes] : [],
    notes: ["MR Summary and Release Notes generated from current WorkflowRun."]
  });
  markTaskStep(task, "execution-record", run.status === "passed" ? "passed" : run.status === "blocked" ? "blocked" : run.status === "failed" ? "failed" : "in_progress", {
    evidence: [task.artifacts.runJson, task.artifacts.taskJson, task.artifacts.testLog, task.artifacts.agentJournal],
    notes: [`Final run status: ${run.status}`]
  });
  return task;
}

export function generateTaskCases(analysis: RequirementAnalysis): HarnessTaskCase[] {
  const acceptanceCases = analysis.acceptanceCriteria.map((criterion, index) => ({
    id: createId("tc"),
    title: `Acceptance ${index + 1}: ${criterion.statement.slice(0, 72)}`,
    type: index === 0 ? "integration" as const : "unit" as const,
    verifies: criterion.statement,
    command: criterion.verification.startsWith("Run ") ? criterion.verification.replace(/^Run /, "") : "pnpm test",
    status: "pending" as const,
    evidence: []
  }));
  return [
    ...acceptanceCases,
    {
      id: createId("tc"),
      title: "Task-specific quality validation",
      type: "quality",
      verifies: "User-visible behavior, screenshot, accessibility snapshot, console, page errors, and network health match this task's risk profile.",
      command: "Use harness-quality Skill and selected agent-browser commands",
      status: "pending",
      evidence: []
    },
    {
      id: createId("tc"),
      title: "Deployment health",
      type: "deployment",
      verifies: "Docker Compose or local deployment health checks are recorded.",
      command: "pnpm health",
      status: "pending",
      evidence: []
    }
  ];
}

function appendUnique<T>(target: T[], values: T[]): T[] {
  return [...target, ...values.filter((value) => !target.includes(value))];
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
  const browser = run.tests?.browserQuality
    ? `Browser quality: ${run.tests.browserQuality.passed ? "passed" : "failed"} on ${run.tests.browserQuality.targetUrl}.`
    : "Browser quality: not run.";
  const deploy = run.deployment ? `Deployment: ${run.deployment.status} on ${run.deployment.target}.` : "Deployment: not run.";
  return [
    `# MR Summary: ${run.title}`,
    "",
    `Type: ${run.type}`,
    `Target Project: ${run.targetProject}`,
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
    `- ${browser}`,
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
    `- Target project: ${run.targetProject}`,
    `- Result: ${run.status}`,
    `- Score: ${scoreRun(run)}`,
    `- Deployment: ${run.deployment?.status ?? "not run"}`,
    "",
    "## Operator Notes",
    "- Run `pnpm health` after deployment.",
    "- Inspect `.harness/runs` for the full JSON execution record."
  ].join("\n");
}
