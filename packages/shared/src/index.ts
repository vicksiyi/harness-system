import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export type WorkflowType = "requirement" | "bugfix" | "polish";

export type WorkflowStage =
  | "created"
  | "analyzing"
  | "planning"
  | "coding"
  | "testing"
  | "fixing"
  | "retesting"
  | "summarizing"
  | "deploying"
  | "completed"
  | "blocked"
  | "failed";

export type WorkflowStatus = "queued" | "running" | "passed" | "failed" | "blocked";
export type HarnessEventLevel = "info" | "warn" | "error";

export interface HarnessEvent {
  id: string;
  runId: string;
  at: string;
  stage: WorkflowStage;
  level: HarnessEventLevel;
  message: string;
  data?: unknown;
}

export interface HarnessLogEntry {
  id: string;
  runId: string;
  at: string;
  service: string;
  level: HarnessEventLevel;
  message: string;
  data?: unknown;
}

export interface WorkflowInput {
  type: WorkflowType;
  prompt: string;
  requestedBy?: string;
  targetProject?: string;
}

export interface AcceptanceCriterion {
  id: string;
  statement: string;
  verification: string;
}

export interface RequirementAnalysis {
  taskType: WorkflowType;
  targetProject: string;
  title: string;
  scope: string[];
  risks: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  recommendedFiles: string[];
}

export interface PatchPlan {
  summary: string;
  files: string[];
  steps: string[];
}

export interface CodingResult {
  patchPlan: PatchPlan;
  changeSummary: string[];
  testSuggestions: string[];
}

export interface ParsedFailure {
  reason: string;
  evidence: string;
  suggestedFix: string;
}

export interface TestResult {
  passed: boolean;
  command: string;
  attempts: number;
  rawLog: string;
  failures: ParsedFailure[];
  suggestions: string[];
  score: number;
}

export interface DeploymentResult {
  status: "healthy" | "failed" | "skipped";
  target: string;
  healthChecks: Array<{ name: string; ok: boolean; detail: string }>;
  rollbackSuggestion?: string;
}

export interface WorkflowRun {
  id: string;
  type: WorkflowType;
  targetProject: string;
  title: string;
  prompt: string;
  stage: WorkflowStage;
  status: WorkflowStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  analysis?: RequirementAnalysis;
  coding?: CodingResult;
  tests?: TestResult;
  deployment?: DeploymentResult;
  events: HarnessEvent[];
  logs: HarnessLogEntry[];
  mrSummary?: string;
  releaseNotes?: string;
  blocker?: string;
}

export interface RpcRequest<T = unknown> {
  id?: string;
  method: string;
  params?: T;
}

export interface RpcResponse<T = unknown> {
  id?: string;
  result?: T;
  error?: {
    code: string;
    message: string;
    data?: unknown;
  };
}

export interface ServiceHealth {
  service: string;
  status: "ok" | "degraded" | "down";
  at: string;
  details?: Record<string, unknown>;
}

export type RpcMethod = (params: unknown, context: RpcContext) => Promise<unknown> | unknown;

export interface RpcContext {
  serviceName: string;
  request: IncomingMessage;
}

export interface RpcServerOptions {
  serviceName: string;
  port: number;
  methods: Record<string, RpcMethod>;
  health?: () => Promise<ServiceHealth> | ServiceHealth;
}

export const servicePorts = {
  orchestrator: 4100,
  requirements: 4101,
  coding: 4102,
  testing: 4103,
  deploy: 4104,
  cardEditor: 5175
} as const;

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${suffix}`;
}

export function titleFromPrompt(type: WorkflowType, prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  const fallback = {
    requirement: "Requirement workflow",
    bugfix: "Bugfix workflow",
    polish: "Polish workflow"
  } satisfies Record<WorkflowType, string>;
  return normalized.length > 0 ? normalized.slice(0, 72) : fallback[type];
}

export function addEvent(
  run: WorkflowRun,
  stage: WorkflowStage,
  message: string,
  level: HarnessEventLevel = "info",
  data?: unknown
): HarnessEvent {
  const event: HarnessEvent = {
    id: createId("evt"),
    runId: run.id,
    at: nowIso(),
    stage,
    level,
    message,
    data
  };
  run.events.push(event);
  run.updatedAt = event.at;
  return event;
}

export function addLog(
  run: WorkflowRun,
  service: string,
  message: string,
  level: HarnessEventLevel = "info",
  data?: unknown
): HarnessLogEntry {
  const entry: HarnessLogEntry = {
    id: createId("log"),
    runId: run.id,
    at: nowIso(),
    service,
    level,
    message,
    data
  };
  run.logs.push(entry);
  run.updatedAt = entry.at;
  return entry;
}

export function jsonResponse(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(body, null, 2));
}

export async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}

export function createRpcServer(options: RpcServerOptions) {
  const server = createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      jsonResponse(response, 204, {});
      return;
    }

    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && url.pathname === "/health") {
        const health =
          options.health?.() ??
          ({
            service: options.serviceName,
            status: "ok",
            at: nowIso()
          } satisfies ServiceHealth);
        jsonResponse(response, 200, await health);
        return;
      }

      if (request.method !== "POST" || url.pathname !== "/rpc") {
        jsonResponse(response, 404, {
          error: { code: "not_found", message: "Use GET /health or POST /rpc." }
        });
        return;
      }

      const rpcRequest = await readJsonBody<RpcRequest>(request);
      const method = options.methods[rpcRequest.method];
      if (!method) {
        jsonResponse(response, 404, {
          id: rpcRequest.id,
          error: { code: "method_not_found", message: `Unknown method ${rpcRequest.method}` }
        } satisfies RpcResponse);
        return;
      }

      const result = await method(rpcRequest.params, { serviceName: options.serviceName, request });
      jsonResponse(response, 200, { id: rpcRequest.id, result } satisfies RpcResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown RPC error";
      jsonResponse(response, 500, {
        error: { code: "internal_error", message }
      } satisfies RpcResponse);
    }
  });

  server.listen(options.port, () => {
    console.log(`${options.serviceName} listening on http://localhost:${options.port}`);
  });

  return server;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
