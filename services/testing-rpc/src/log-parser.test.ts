import { describe, expect, it } from "vitest";
import { parseFailureLog } from "./log-parser.js";

describe("parseFailureLog", () => {
  it("returns no failures for empty or passing logs", () => {
    expect(parseFailureLog("")).toEqual([]);
    expect(parseFailureLog("typecheck passed\nvitest passed")).toEqual([]);
  });

  it("classifies port conflicts", () => {
    const failures = parseFailureLog("Error: listen EADDRINUSE: address already in use :::4100");

    expect(failures[0]?.reason).toBe("Port conflict");
    expect(failures[0]?.suggestedFix).toContain("PORT");
  });

  it("classifies dependency outages", () => {
    const failures = parseFailureLog("FetchError: ECONNREFUSED 127.0.0.1:4101");

    expect(failures[0]?.reason).toBe("Dependency unavailable");
  });

  it("classifies assertion failures", () => {
    const failures = parseFailureLog("AssertionError: expected parsed failures to include suggestedFix");

    expect(failures[0]?.reason).toBe("Test assertion failed");
  });

  it("classifies English and Chinese log parser failures", () => {
    const english = parseFailureLog("ERROR log parse failed: multiline log was not normalized");
    const chinese = parseFailureLog("测试服务日志解析失败：无法识别多行日志");

    expect(english[0]?.reason).toBe("Log parser failed");
    expect(chinese[0]?.reason).toBe("Log parser failed");
  });

  it("classifies browser and accessibility quality failures", () => {
    const browser = parseFailureLog("browser-quality: failed: mobile layout overflow - 390px viewport overflowed");
    const accessibility = parseFailureLog("browser-quality: failed: accessible control names - missing name on #query");

    expect(browser[0]?.reason).toBe("Browser quality failed");
    expect(accessibility.map((failure) => failure.reason)).toContain("Accessibility validation failed");
  });

  it("classifies agent-browser E2E failures", () => {
    const failures = parseFailureLog("agent-browser-e2e: failed: agent-browser rpc network health - no RPC POST requests captured");

    expect(failures[0]?.reason).toBe("Agent-browser E2E failed");
    expect(failures[0]?.suggestedFix).toContain("harness-quality");
  });

  it("keeps unknown errors actionable", () => {
    const failures = parseFailureLog("Fatal error: something new happened");

    expect(failures[0]?.reason).toBe("Unclassified failure");
    expect(failures[0]?.suggestedFix).toContain("Inspect");
  });
});
