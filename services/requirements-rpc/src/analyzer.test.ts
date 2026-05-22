import { describe, expect, it } from "vitest";
import { analyzeRequirement, inferRequirementType, normalizePrompt, normalizeTargetProject } from "./analyzer.js";

describe("requirements analyzer", () => {
  it("defaults unknown workflow types to requirement", () => {
    expect(inferRequirementType("other")).toBe("requirement");
  });

  it("normalizes empty prompts", () => {
    expect(normalizePrompt("   ")).toBe("Improve the harness workflow.");
  });

  it("defaults target work to the isolated mind map editor project", () => {
    expect(normalizeTargetProject(undefined)).toBe("apps/mindmap-editor");
  });

  it("creates requirement acceptance criteria and recommended files", () => {
    const analysis = analyzeRequirement({ type: "requirement", prompt: "增加运行详情页" });

    expect(analysis.taskType).toBe("requirement");
    expect(analysis.targetProject).toBe("apps/mindmap-editor");
    expect(analysis.title).toContain("Implement:");
    expect(analysis.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);
    expect(analysis.recommendedFiles).toContain("apps/mindmap-editor/src/main.ts");
  });

  it("creates bugfix-specific reproducibility criteria", () => {
    const analysis = analyzeRequirement({ type: "bugfix", prompt: "日志解析失败" });

    expect(analysis.title).toContain("Fix:");
    expect(analysis.acceptanceCriteria.some((criterion) => criterion.statement.includes("reproducible log signature"))).toBe(true);
  });

  it("creates polish-specific operator criteria", () => {
    const analysis = analyzeRequirement({ type: "polish", prompt: "优化任务状态展示" });

    expect(analysis.title).toContain("Polish:");
    expect(analysis.acceptanceCriteria.some((criterion) => criterion.statement.includes("target product editing"))).toBe(true);
  });
});
