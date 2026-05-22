import {
  asRecord,
  createRpcServer,
  servicePort,
  type CodingResult,
  type RequirementAnalysis,
  type ServiceHealth,
  type WorkflowType
} from "@harness/shared";

function toAnalysis(value: unknown): RequirementAnalysis | undefined {
  return value && typeof value === "object" ? (value as RequirementAnalysis) : undefined;
}

function inferType(value: unknown): WorkflowType {
  return value === "bugfix" || value === "polish" || value === "requirement" ? value : "requirement";
}

function planAndPatch(params: unknown): CodingResult {
  const record = asRecord(params);
  const analysis = toAnalysis(record.analysis);
  const type = inferType(record.type);
  const prompt = typeof record.prompt === "string" ? record.prompt : analysis?.title ?? "Harness task";
  const targetProject = typeof record.targetProject === "string" ? record.targetProject : analysis?.targetProject ?? "apps/mindmap-editor";

  const files = analysis?.recommendedFiles ?? [
    `${targetProject}/src/domain.ts`,
    `${targetProject}/src/domain.test.ts`,
    `${targetProject}/src/main.ts`
  ];

  const modeSummary = {
    requirement: "Extend the workflow surface and keep it observable end to end.",
    bugfix: "Patch the failing behavior, preserve a failure signature, and add regression coverage.",
    polish: "Improve operator ergonomics while keeping the console dense and task-oriented."
  } satisfies Record<WorkflowType, string>;

  return {
    patchPlan: {
      summary: `${modeSummary[type]} Target: ${targetProject}. Prompt: ${prompt}`,
      files,
      steps: [
        `Read ${targetProject}/AGENTS.md before editing the target project.`,
        "Implement the smallest coherent product change inside the target project first.",
        "Run focused target tests, then pnpm verify.",
        "Update docs/agent-journal.md, docs/test-log.md, and generated MR notes."
      ]
    },
    changeSummary: [
      `Generated a ${type} patch plan for ${targetProject}.`,
      "Recorded expected files, verification path, and operator-facing summary.",
      "Returned test suggestions for the testing-rpc retry loop."
    ],
    testSuggestions: [
      "pnpm typecheck",
      "pnpm test",
      "pnpm target:test",
      "pnpm target:build",
      "pnpm health"
    ]
  };
}

createRpcServer({
  serviceName: "coding-rpc",
  port: servicePort("coding"),
  methods: {
    planAndPatch
  },
  health: (): ServiceHealth => ({
    service: "coding-rpc",
    status: "ok",
    at: new Date().toISOString(),
    details: { methods: ["planAndPatch"] }
  })
});
