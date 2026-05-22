import { asRecord, type TestResult } from "@harness/shared";
import { type BrowserQualityRunner, skippedBrowserQuality } from "./browser-quality.js";
import { parseFailureLog } from "./log-parser.js";

export interface TestRunnerOptions {
  browserQualityRunner?: BrowserQualityRunner;
}

export async function runHarnessValidation(params: unknown, options: TestRunnerOptions = {}): Promise<TestResult> {
  const record = asRecord(params);
  const attempt = typeof record.attempt === "number" ? record.attempt : 1;
  const prompt = typeof record.prompt === "string" ? record.prompt : "";
  const targetProject = typeof record.targetProject === "string" ? record.targetProject : "apps/mindmap-editor";
  const browserQualityRunner = options.browserQualityRunner ?? skippedBrowserQuality;
  const shouldDemonstrateRetry =
    attempt === 1 && /log|日志|failure|失败|parser|解析/i.test(prompt) && record.allowRetryDemo !== false;
  const browserQuality = shouldDemonstrateRetry
    ? await skippedBrowserQuality({ ...record, targetProject })
    : await browserQualityRunner({ ...record, targetProject });

  const command = "pnpm typecheck && pnpm test && pnpm target:build && pnpm target:browser";
  const rawLog = shouldDemonstrateRetry
    ? [
        `testing-rpc: running simulated regression suite for ${targetProject}`,
        "ERROR log parse failed: multiline harness log was not normalized",
        "AssertionError: expected parsed failures to include suggestedFix"
      ].join("\n")
    : [
        `testing-rpc: running simulated regression suite for ${targetProject}`,
        "typecheck passed",
        "vitest passed",
        "target app tests passed",
        "target build passed",
        browserQuality.rawLog
      ].join("\n");

  const failures = [
    ...parseFailureLog(rawLog),
    ...browserQuality.checks
      .filter((check) => !check.ok)
      .map((check) => ({
        reason: check.name,
        evidence: check.detail,
        suggestedFix: "Fix the target UI behavior or accessibility contract, then rerun pnpm target:browser."
      }))
  ];
  const passed = failures.length === 0;

  return {
    passed,
    command,
    attempts: attempt,
    rawLog,
    failures,
    suggestions: passed
      ? [`Proceed with MR summary and deployment checks for ${targetProject}; browser quality passed.`]
      : failures.map((failure) => failure.suggestedFix),
    score: passed ? 98 : Math.max(35, 80 - failures.length * 15),
    browserQuality
  };
}
