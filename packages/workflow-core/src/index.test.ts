import { describe, expect, it } from "vitest";
import type { TestResult } from "@harness/shared";
import {
  attachDeployment,
  attachTestResult,
  completeOrBlockAfterDeploy,
  createWorkflowRun,
  decideAfterTest,
  scoreRun,
  summarizeRun,
  transition
} from "./index.js";

function passingTest(attempts = 1): TestResult {
  return {
    passed: true,
    command: "pnpm test",
    attempts,
    rawLog: "passed",
    failures: [],
    suggestions: ["continue"],
    score: 96
  };
}

function failingTest(attempts = 1): TestResult {
  return {
    passed: false,
    command: "pnpm test",
    attempts,
    rawLog: "AssertionError: expected true",
    failures: [
      {
        reason: "Test assertion failed",
        evidence: "AssertionError: expected true",
        suggestedFix: "Update implementation."
      }
    ],
    suggestions: ["Update implementation."],
    score: 55
  };
}

describe("workflow-core", () => {
  it("creates a queued workflow run with audit events and logs", () => {
    const run = createWorkflowRun({ type: "requirement", prompt: "增加详情页" });

    expect(run.stage).toBe("created");
    expect(run.status).toBe("queued");
    expect(run.events).toHaveLength(1);
    expect(run.logs[0]?.service).toBe("workflow-core");
  });

  it("enforces allowed stage transitions", () => {
    const run = createWorkflowRun({ type: "bugfix", prompt: "日志解析失败" });

    expect(() => transition(run, "coding")).toThrow(/Invalid workflow transition/);
    transition(run, "analyzing");
    transition(run, "planning");
    transition(run, "coding");

    expect(run.stage).toBe("coding");
    expect(run.status).toBe("running");
  });

  it("routes failed tests into fixing while retry budget remains", () => {
    const run = createWorkflowRun({ type: "bugfix", prompt: "log parse failed" });
    attachTestResult(run, failingTest(1));

    expect(decideAfterTest(run)).toBe("fixing");
  });

  it("blocks after retry budget is exhausted", () => {
    const run = createWorkflowRun({ type: "bugfix", prompt: "log parse failed" });
    attachTestResult(run, failingTest(2));

    expect(decideAfterTest(run)).toBe("blocked");
  });

  it("moves from passed tests to summarizing", () => {
    const run = createWorkflowRun({ type: "polish", prompt: "优化状态展示" });
    attachTestResult(run, passingTest());

    expect(decideAfterTest(run)).toBe("summarizing");
  });

  it("completes when deployment is healthy and includes MR sections", () => {
    const run = createWorkflowRun({ type: "requirement", prompt: "增加运行详情页" });
    attachDeployment(run, {
      status: "healthy",
      target: "docker-compose-local",
      healthChecks: [{ name: "web", ok: true, detail: "ok" }]
    });

    expect(completeOrBlockAfterDeploy(run)).toBe("completed");
    expect(scoreRun(run)).toBeGreaterThan(0);
    expect(summarizeRun(run)).toContain("## Validation");
  });

  it("includes browser quality in MR validation summaries", () => {
    const run = createWorkflowRun({ type: "polish", prompt: "优化可访问性" });
    attachTestResult(run, {
      ...passingTest(),
      browserQuality: {
        passed: true,
        command: "pnpm target:browser",
        targetProject: "apps/mindmap-editor",
        targetUrl: "http://localhost:5175",
        startedServer: false,
        checks: [{ name: "accessible control names", ok: true, detail: "all named" }],
        rawLog: "browser-quality: passed"
      }
    });

    expect(summarizeRun(run)).toContain("Browser quality: passed");
  });
});
