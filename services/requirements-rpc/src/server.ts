import {
  asRecord,
  createId,
  createRpcServer,
  servicePorts,
  type AcceptanceCriterion,
  type RequirementAnalysis,
  type ServiceHealth,
  type WorkflowType
} from "@harness/shared";

function inferType(value: unknown): WorkflowType {
  return value === "bugfix" || value === "polish" || value === "requirement" ? value : "requirement";
}

function promptText(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "Improve the harness workflow.";
}

function criteriaFor(type: WorkflowType, prompt: string): AcceptanceCriterion[] {
  const base = [
    {
      id: createId("ac"),
      statement: "Workflow run is visible in the console with current status, timeline, logs, tests, deployment, and MR summary.",
      verification: "Open the web console and inspect the latest run detail view."
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
        statement: "The improvement makes repeated operator review faster without adding marketing content.",
        verification: "Build the web console and review the task surface."
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

function analyze(params: unknown): RequirementAnalysis {
  const record = asRecord(params);
  const type = inferType(record.type);
  const prompt = promptText(record.prompt);
  const titlePrefix = type === "bugfix" ? "Fix" : type === "polish" ? "Polish" : "Implement";

  return {
    taskType: type,
    title: `${titlePrefix}: ${prompt.replace(/\s+/g, " ").slice(0, 64)}`,
    scope: [
      "Update workflow orchestration and run records where needed.",
      "Expose the result in the web console and RPC API.",
      "Refresh generated MR summary and release notes.",
      "Verify through unit, RPC, frontend build, and deployment checks."
    ],
    risks: [
      "Local Docker or port conflicts can block deployment validation.",
      "A simulated Agent action may not reflect every real coding failure mode.",
      "In-memory service state is reset when orchestrator-rpc restarts; persisted JSON run files are the audit source."
    ],
    acceptanceCriteria: criteriaFor(type, prompt),
    recommendedFiles: [
      "packages/workflow-core/src/index.ts",
      "services/orchestrator-rpc/src/server.ts",
      "services/testing-rpc/src/server.ts",
      "apps/web/src/main.ts",
      "docs/generated-mr-summary.md"
    ]
  };
}

createRpcServer({
  serviceName: "requirements-rpc",
  port: Number(process.env.PORT ?? servicePorts.requirements),
  methods: {
    analyze,
    templates: () => ({
      requirement: "需求 -> 拆解 -> 编码 -> 测试 -> 部署 -> MR Summary",
      bugfix: "复现 -> 日志 -> 根因 -> 修复 -> 回归 -> MR Summary",
      polish: "影响面 -> UI/DX 改进 -> 构建 -> 检查 -> 改进记录"
    })
  },
  health: (): ServiceHealth => ({
    service: "requirements-rpc",
    status: "ok",
    at: new Date().toISOString(),
    details: { methods: ["analyze", "templates"] }
  })
});

