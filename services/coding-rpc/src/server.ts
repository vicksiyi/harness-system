import {
  asRecord,
  createRpcServer,
  servicePorts,
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

  const files = analysis?.recommendedFiles ?? [
    "packages/workflow-core/src/index.ts",
    "services/orchestrator-rpc/src/server.ts",
    "apps/web/src/main.ts"
  ];

  const modeSummary = {
    requirement: "Extend the workflow surface and keep it observable end to end.",
    bugfix: "Patch the failing behavior, preserve a failure signature, and add regression coverage.",
    polish: "Improve operator ergonomics while keeping the console dense and task-oriented."
  } satisfies Record<WorkflowType, string>;

  return {
    patchPlan: {
      summary: `${modeSummary[type]} Prompt: ${prompt}`,
      files,
      steps: [
        "Read the nearest AGENTS.md before editing a module.",
        "Implement the smallest coherent change across workflow-core, RPC, and web surfaces.",
        "Run focused tests, then pnpm verify.",
        "Update docs/agent-journal.md, docs/test-log.md, and generated MR notes."
      ]
    },
    changeSummary: [
      `Generated a ${type} patch plan from structured requirement analysis.`,
      "Recorded expected files, verification path, and operator-facing summary.",
      "Returned test suggestions for the testing-rpc retry loop."
    ],
    testSuggestions: [
      "pnpm typecheck",
      "pnpm test",
      "pnpm --filter @harness/web build",
      "pnpm health"
    ]
  };
}

createRpcServer({
  serviceName: "coding-rpc",
  port: Number(process.env.PORT ?? servicePorts.coding),
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

