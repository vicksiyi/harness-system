import {
  createId,
  type AcceptanceCriterion,
  type RequirementAnalysis,
  type WorkflowType
} from "@harness/shared";

export function inferRequirementType(value: unknown): WorkflowType {
  return value === "bugfix" || value === "polish" || value === "requirement" ? value : "requirement";
}

export function normalizePrompt(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "Improve the harness workflow.";
}

export function normalizeTargetProject(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "apps/card-editor";
}

export function criteriaFor(type: WorkflowType, prompt: string): AcceptanceCriterion[] {
  const base = [
    {
      id: createId("ac"),
      statement: "Workflow run is persisted with current status, timeline, logs, tests, deployment, target project, and MR summary.",
      verification: "Inspect .harness/runs/<run-id>.json and docs/generated-mr-summary.md."
    },
    {
      id: createId("ac"),
      statement: "The implementation has an automated validation path.",
      verification: "Run pnpm verify and inspect docs/test-log.md."
    }
  ];

  if (type === "bugfix") {
    return [
      {
        id: createId("ac"),
        statement: "The reported failure has a reproducible log signature.",
        verification: "Run testing-rpc parseLogs against the failure log."
      },
      {
        id: createId("ac"),
        statement: "Regression coverage protects the fixed behavior.",
        verification: "Run the focused Vitest suite for log parsing and workflow retry decisions."
      },
      ...base
    ];
  }

  if (type === "polish") {
    return [
      {
        id: createId("ac"),
        statement: "The improvement makes repeated target-app editing faster without adding marketing content.",
        verification: "Build the target app and review the editing surface."
      },
      ...base
    ];
  }

  return [
    {
      id: createId("ac"),
      statement: `The requested capability is represented as a concrete workflow artifact: ${prompt.slice(0, 96)}`,
      verification: "Run the requirement workflow through orchestrator-rpc."
    },
    ...base
  ];
}

export function analyzeRequirement(input: { type?: unknown; prompt?: unknown; targetProject?: unknown }): RequirementAnalysis {
  const type = inferRequirementType(input.type);
  const prompt = normalizePrompt(input.prompt);
  const targetProject = normalizeTargetProject(input.targetProject);
  const titlePrefix = type === "bugfix" ? "Fix" : type === "polish" ? "Polish" : "Implement";

  return {
    taskType: type,
    targetProject,
    title: `${titlePrefix}: ${prompt.replace(/\s+/g, " ").slice(0, 64)}`,
    scope: [
      `Modify the isolated target project at ${targetProject}.`,
      "Keep Harness orchestration code unchanged unless the task explicitly asks for Harness behavior.",
      "Expose product changes through the target project UI and tests.",
      "Refresh generated MR summary, release notes, and execution records."
    ],
    risks: [
      "Local Docker or port conflicts can block deployment validation.",
      "A simulated Agent action may not reflect every real coding failure mode.",
      "In-memory service state is reset when orchestrator-rpc restarts; persisted JSON run files are the audit source."
    ],
    acceptanceCriteria: criteriaFor(type, prompt),
    recommendedFiles: [
      `${targetProject}/AGENTS.md`,
      `${targetProject}/src/domain.ts`,
      `${targetProject}/src/domain.test.ts`,
      `${targetProject}/src/main.ts`,
      `${targetProject}/src/style.css`,
      "docs/generated-mr-summary.md"
    ]
  };
}
