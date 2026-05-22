import {
  asRecord,
  createRpcServer,
  servicePorts,
  type ServiceHealth,
  type TestResult
} from "@harness/shared";
import { parseFailureLog } from "./log-parser.js";

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
    command: "pnpm typecheck && pnpm test && pnpm target:build",
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
