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

