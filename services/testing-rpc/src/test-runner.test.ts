import { describe, expect, it } from "vitest";
import type { BrowserQualityResult } from "@harness/shared";
import { runHarnessValidation } from "./test-runner.js";

const passingBrowserQuality: BrowserQualityResult = {
  passed: true,
  command: "pnpm target:browser",
  targetProject: "apps/mindmap-editor",
  targetUrl: "http://localhost:5175",
  startedServer: false,
  checks: [
    { name: "main product heading", ok: true, detail: "visible" },
    { name: "accessible control names", ok: true, detail: "all named" }
  ],
  rawLog: "browser-quality: passed: main product heading\nbrowser-quality: passed: accessible control names"
};

describe("runHarnessValidation", () => {
  it("includes target app and browser validation in passing logs", async () => {
    const result = await runHarnessValidation(
      {
        prompt: "增加脑图关联视图",
        targetProject: "apps/mindmap-editor",
        attempt: 1
      },
      { browserQualityRunner: async () => passingBrowserQuality }
    );

    expect(result.passed).toBe(true);
    expect(result.command).toBe("pnpm typecheck && pnpm test && pnpm target:build && pnpm target:browser");
    expect(result.rawLog).toContain("apps/mindmap-editor");
    expect(result.rawLog).toContain("target app tests passed");
    expect(result.rawLog).toContain("browser-quality: passed");
    expect(result.browserQuality?.passed).toBe(true);
    expect(result.suggestions[0]).toContain("apps/mindmap-editor");
  });

  it("keeps retry demonstration for log parser prompts", async () => {
    const result = await runHarnessValidation({
      prompt: "测试服务日志解析失败",
      targetProject: "apps/mindmap-editor",
      attempt: 1
    });

    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.reason)).toContain("Log parser failed");
  });

  it("passes after retry attempt with browser quality", async () => {
    const result = await runHarnessValidation(
      {
        prompt: "测试服务日志解析失败",
        targetProject: "apps/mindmap-editor",
        attempt: 2
      },
      { browserQualityRunner: async () => passingBrowserQuality }
    );

    expect(result.passed).toBe(true);
    expect(result.rawLog).toContain("target build passed");
  });

  it("turns browser quality failures into actionable validation failures", async () => {
    const result = await runHarnessValidation(
      {
        prompt: "优化脑图编辑器可访问性",
        targetProject: "apps/mindmap-editor",
        attempt: 1
      },
      {
        browserQualityRunner: async () => ({
          ...passingBrowserQuality,
          passed: false,
          checks: [{ name: "accessible control names", ok: false, detail: "missing name on #query" }],
          rawLog: "browser-quality: failed: accessible control names - missing name on #query"
        })
      }
    );

    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.reason)).toContain("Accessibility validation failed");
    expect(result.suggestions.join(" ")).toContain("rerun");
  });
});
