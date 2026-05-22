import type { ParsedFailure } from "@harness/shared";

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
    } else if (
      (normalized.includes("browser-quality: failed") || normalized.includes("browser quality failed")) &&
      (normalized.includes("accessible control") || normalized.includes("accessibility"))
    ) {
      failures.push({
        reason: "Accessibility validation failed",
        evidence: line,
        suggestedFix: "Add accessible names or semantic roles and rerun the browser quality check."
      });
    } else if (normalized.includes("browser-quality: failed") || normalized.includes("browser quality failed")) {
      failures.push({
        reason: "Browser quality failed",
        evidence: line,
        suggestedFix: "Run pnpm target:browser, inspect the screenshot artifact, then fix the UI or accessibility regression."
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
