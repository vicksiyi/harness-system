import {
  asRecord,
  createRpcServer,
  servicePorts,
  type ParsedFailure,
  type ServiceHealth,
  type TestResult
} from "@harness/shared";

export function parseFailureLog(rawLog: string): ParsedFailure[] {
  const log = rawLog.trim();
  if (!log) {
    return [];
  }

  const failures: ParsedFailure[] = [];
  const lines = log.split(/\r?\n/);

  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (normalized.includes("eaddrinuse") || normalized.includes("address already in use")) {
      failures.push({
        reason: "Port conflict",
        evidence: line,
        suggestedFix: "Stop the conflicting local process or override the service PORT before restarting."
      });
    } else if (normalized.includes("connection refused") || normalized.includes("econnrefused")) {
      failures.push({
        reason: "Dependency unavailable",
        evidence: line,
        suggestedFix: "Start dependent RPC services and rerun pnpm health."
      });
    } else if (normalized.includes("assertionerror") || normalized.includes("expected")) {
      failures.push({
        reason: "Test assertion failed",
        evidence: line,
        suggestedFix: "Update implementation or expectation, then rerun the focused test."
      });
    } else if (normalized.includes("log parse failed") || normalized.includes("日志解析失败")) {
      failures.push({
        reason: "Log parser failed",
        evidence: line,
        suggestedFix: "Normalize multiline log input and add regression coverage for parser signatures."
      });
    }
  }

  if (failures.length === 0 && /(error|failed|失败)/i.test(log)) {
    failures.push({
      reason: "Unclassified failure",
      evidence: lines.find((line) => /(error|failed|失败)/i.test(line)) ?? lines[0],
      suggestedFix: "Inspect the raw log and add a parser rule if this signature should be actionable."
    });
  }

  return failures;
}

function runTests(params: unknown): TestResult {
  const record = asRecord(params);
  const attempt = typeof record.attempt === "number" ? record.attempt : 1;
  const prompt = typeof record.prompt === "string" ? record.prompt : "";
  const shouldDemonstrateRetry =
    attempt === 1 && /log|日志|failure|失败|parser|解析/i.test(prompt) && record.allowRetryDemo !== false;

  const rawLog = shouldDemonstrateRetry
    ? [
        "testing-rpc: running simulated regression suite",
        "ERROR log parse failed: multiline harness log was not normalized",
        "AssertionError: expected parsed failures to include suggestedFix"
      ].join("\n")
    : [
        "testing-rpc: running simulated regression suite",
        "typecheck passed",
        "vitest passed",
        "web build passed"
      ].join("\n");

  const failures = parseFailureLog(rawLog);
  const passed = failures.length === 0;

  return {
    passed,
    command: "pnpm typecheck && pnpm test && pnpm --filter @harness/web build",
    attempts: attempt,
    rawLog,
    failures,
    suggestions: passed
      ? ["Proceed to MR summary and deployment checks."]
      : failures.map((failure) => failure.suggestedFix),
    score: passed ? 96 : Math.max(35, 80 - failures.length * 15)
  };
}

createRpcServer({
  serviceName: "testing-rpc",
  port: Number(process.env.PORT ?? servicePorts.testing),
  methods: {
    runTests,
    parseLogs: (params) => {
      const record = asRecord(params);
      const rawLog = typeof record.rawLog === "string" ? record.rawLog : "";
      return parseFailureLog(rawLog);
    }
  },
  health: (): ServiceHealth => ({
    service: "testing-rpc",
    status: "ok",
    at: new Date().toISOString(),
    details: { methods: ["runTests", "parseLogs"] }
  })
});

