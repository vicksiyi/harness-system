import { describe, expect, it } from "vitest";
import type { TestResult } from "@harness/shared";
import {
  attachAnalysisToTask,
  attachDeployment,
  attachDeploymentToTask,
  attachTestResult,
  attachTestsToTask,
  completeOrBlockAfterDeploy,
  createHarnessTaskFile,
  createWorkflowRun,
  decideAfterTest,
  finalizeTask,
  markTaskStep,
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

function passingBrowserTest(): TestResult {
  return {
    ...passingTest(),
    command: "pnpm typecheck && pnpm test && pnpm target:build && pnpm target:browser",
    browserQuality: {
      passed: true,
      command: "node harness-worktree/scripts/browser-quality-check.mjs --url http://localhost:5175",
      targetProject: "apps/mindmap-editor",
      targetUrl: "http://localhost:5175",
      startedServer: false,
      screenshotPath: ".harness/browser/quality.png",
      checks: [{ name: "same-browser peer receives undo diff", ok: true, detail: "synced" }],
      rawLog: "browser-quality: passed"
    }
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

  it("creates a stable task json flow for skill-guided execution", () => {
    const run = createWorkflowRun({ type: "requirement", prompt: "增加质量验证 Skill" });
    const task = createHarnessTaskFile(run);

    expect(task.schemaVersion).toBe(1);
    expect(task.runId).toBe(run.id);
    expect(task.artifacts.taskJson).toBe(`.harness/tasks/${run.id}.json`);
    expect(task.flow.steps.map((step) => step.id)).toEqual([
      "intake",
      "requirement-analysis",
      "test-case-generation",
      "implementation-planning",
      "coding",
      "automated-testing",
      "quality-validation",
      "mr-summary",
      "deployment",
      "execution-record"
    ]);
    expect(task.flow.steps.find((step) => step.id === "quality-validation")?.qualityGates.join(" ")).toContain("hard-coded path");
  });

  it("attaches analysis as acceptance criteria and generated test cases", () => {
    const run = createWorkflowRun({ type: "bugfix", prompt: "保存失败" });
    const task = createHarnessTaskFile(run);

    attachAnalysisToTask(task, {
      taskType: "bugfix",
      targetProject: "apps/mindmap-editor",
      title: "Fix save failure",
      scope: ["Fix save path"],
      risks: ["RPC can be offline"],
      acceptanceCriteria: [
        {
          id: "ac_1",
          statement: "Save succeeds for a database-backed map.",
          verification: "Run pnpm target:browser"
        }
      ],
      recommendedFiles: ["apps/mindmap-editor/src/main.ts"]
    });

    expect(task.acceptanceCriteria).toHaveLength(1);
    expect(task.testCases.some((testCase) => testCase.type === "quality")).toBe(true);
    expect(task.flow.steps.find((step) => step.id === "requirement-analysis")?.status).toBe("passed");
    expect(task.flow.steps.find((step) => step.id === "test-case-generation")?.status).toBe("passed");
  });

  it("updates task flow through tests, deployment, and final record", () => {
    const run = createWorkflowRun({ type: "polish", prompt: "优化验证流程" });
    const task = createHarnessTaskFile(run);
    attachAnalysisToTask(task, {
      taskType: "polish",
      targetProject: "apps/mindmap-editor",
      title: "Polish verification flow",
      scope: ["Improve validation"],
      risks: ["Task evidence can drift"],
      acceptanceCriteria: [
        {
          id: "ac_1",
          statement: "The task records final validation evidence.",
          verification: "Run pnpm test"
        }
      ],
      recommendedFiles: ["packages/workflow-core/src/index.ts"]
    });

    markTaskStep(task, "intake", "passed", { evidence: ["created"] });
    attachTestsToTask(task, passingTest());
    expect(task.flow.steps.find((step) => step.id === "automated-testing")?.status).toBe("passed");

    attachDeploymentToTask(task, {
      status: "healthy",
      target: "docker-compose-local",
      healthChecks: [{ name: "orchestrator", ok: true, detail: "ok" }]
    });
    expect(task.flow.steps.find((step) => step.id === "deployment")?.status).toBe("passed");
    expect(task.testCases.find((testCase) => testCase.type === "deployment")?.status).toBe("passed");

    transition(run, "analyzing");
    transition(run, "planning");
    transition(run, "coding");
    transition(run, "testing");
    attachTestResult(run, passingTest());
    transition(run, "summarizing");
    run.mrSummary = summarizeRun(run);
    transition(run, "deploying");
    attachDeployment(run, {
      status: "healthy",
      target: "docker-compose-local",
      healthChecks: [{ name: "orchestrator", ok: true, detail: "ok" }]
    });
    transition(run, completeOrBlockAfterDeploy(run));
    finalizeTask(task, run);

    expect(task.status).toBe("passed");
    expect(task.currentStepId).toBe("execution-record");
    expect(task.flow.steps.find((step) => step.id === "execution-record")?.evidence).toContain(task.artifacts.taskJson);
  });

  it("writes concrete test case statuses after automated and browser quality checks", () => {
    const run = createWorkflowRun({ type: "bugfix", prompt: "修复 undo redo 协同" });
    const task = createHarnessTaskFile(run);
    attachAnalysisToTask(task, {
      taskType: "bugfix",
      targetProject: "apps/mindmap-editor",
      title: "Fix undo redo sync",
      scope: ["History replay sync"],
      risks: ["Peers can miss history changes"],
      acceptanceCriteria: [
        {
          id: "ac_1",
          statement: "Undo and redo are synchronized to peers.",
          verification: "Run pnpm target:browser"
        }
      ],
      recommendedFiles: ["apps/mindmap-editor/src/main.ts"]
    });

    attachTestsToTask(task, passingBrowserTest());

    expect(task.testCases.filter((testCase) => testCase.type !== "deployment").every((testCase) => testCase.status === "passed")).toBe(true);
    expect(task.testCases.find((testCase) => testCase.type === "quality")?.evidence).toContain(".harness/browser/quality.png");
  });
});
