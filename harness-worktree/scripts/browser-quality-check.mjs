#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const args = parseArgs(process.argv.slice(2));
const runId = args["run-id"] ?? `browser_${Date.now().toString(36)}`;
const targetProject = args.target ?? process.env.HARNESS_TARGET_PROJECT ?? "apps/mindmap-editor";
const targetUrl = args.url ?? process.env.HARNESS_BROWSER_TARGET_URL ?? "http://localhost:5175";
const artifactDir = resolve(root, ".harness", "browser");
const checks = [];
const rawLog = [];

let devServer;
let browser;

try {
  await mkdir(artifactDir, { recursive: true });
  const availability = await ensureTargetAvailable(targetUrl);
  devServer = availability.devServer;
  record("target reachable", true, `${targetProject} served at ${targetUrl}`);

  const executablePath = findChromiumExecutable();
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await visible(page.getByRole("heading", { name: "Mind Map Studio" }), "main product heading");
  await visible(page.getByRole("heading", { name: "Map Canvas" }), "map canvas section");
  await visible(page.getByRole("heading", { name: "Outline" }), "outline section");
  await visible(page.getByRole("heading", { name: "Focus Queue" }), "focus queue section");
  await visible(page.getByRole("heading", { name: "Markdown Export" }), "markdown export section");

  await page.getByLabel("Search ideas").fill("Narrative");
  await visible(page.getByRole("button", { name: /Narrative options/ }).first(), "search filters idea rows");
  await page.getByLabel("Search ideas").fill("");

  await page.getByRole("button", { name: /Launch plan/ }).first().click();
  await page.getByRole("button", { name: "Add child idea" }).click();
  await visible(page.getByRole("button", { name: /New branch/ }).first(), "new child idea appears");

  await page.getByLabel("Idea title").fill("Browser verified branch");
  await visible(page.getByRole("button", { name: /Browser verified branch/ }).first(), "title edit updates live UI");

  await page.getByRole("button", { name: "Save snapshot" }).click();
  await visible(page.getByRole("heading", { name: "Snapshots" }), "snapshots section");
  await visible(page.getByRole("button", { name: "Restore latest snapshot" }), "snapshot restore action appears");
  await page.getByLabel("Idea title").fill("Temporary browser title");
  await visible(page.getByRole("button", { name: /Temporary browser title/ }).first(), "temporary title appears before restore");
  await page.getByRole("button", { name: "Restore latest snapshot" }).click();
  await visible(page.getByRole("button", { name: /Browser verified branch/ }).first(), "snapshot restores prior title");
  await visible(page.getByRole("heading", { name: "Recent Activity" }), "recent activity section");

  await page.keyboard.press("Control+K");
  await visible(page.getByRole("dialog", { name: "Command palette" }), "command palette opens from keyboard");
  await page.getByLabel("Search commands").fill("child");
  await visible(page.getByRole("button", { name: /Add child idea/ }).first(), "command palette filters commands");
  await page.keyboard.press("Enter");
  await visible(page.getByRole("button", { name: /New branch/ }).first(), "command palette executes command");
  await page.keyboard.press("Control+K");
  await page.getByLabel("Search commands").fill("/");
  await page.keyboard.press("Enter");
  const searchFocused = await page.getByLabel("Search ideas").evaluate((element) => document.activeElement === element);
  record("command focuses search", searchFocused, searchFocused ? "slash command moved focus to search" : "search input was not focused");

  const launchNode = page.locator('.map-node[data-node-id="idea-launch"]').first();
  const beforeDrag = await launchNode.evaluate((node) => {
    if (!(node instanceof HTMLElement)) {
      return { x: 0, y: 0 };
    }
    return {
      x: Number.parseFloat(node.style.left),
      y: Number.parseFloat(node.style.top)
    };
  });
  const launchBox = await launchNode.boundingBox();
  if (!launchBox) {
    record("node drag updates position", false, "launch node had no bounding box");
  } else {
    await page.mouse.move(launchBox.x + launchBox.width / 2, launchBox.y + launchBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(launchBox.x + launchBox.width / 2 + 64, launchBox.y + launchBox.height / 2 + 32, { steps: 8 });
    await page.mouse.up();
    const dragApplied = await launchNode.evaluate(
      (node, before) =>
        node instanceof HTMLElement &&
        Number.parseFloat(node.style.left) > before.x + 40 &&
        Number.parseFloat(node.style.top) > before.y + 20,
      beforeDrag
    );
    record("node drag updates position", dragApplied, "dragging a map node updates persisted node coordinates");
  }

  await page.getByRole("button", { name: "Auto layout map" }).click();
  const layoutApplied = await page.evaluate(() => {
    const root = document.querySelector('.map-node[data-node-id="idea-launch"]');
    const research = document.querySelector('.map-node[data-node-id="idea-research"]');
    return (
      root instanceof HTMLElement &&
      research instanceof HTMLElement &&
      Number.parseFloat(root.style.left) === 80 &&
      Number.parseFloat(research.style.left) === 300
    );
  });
  record("auto layout action", layoutApplied, "layout action positions hierarchy lanes");

  const desktopMapNodesVisible = await page.evaluate(() => {
    const canvas = document.querySelector(".canvas-grid");
    const nodes = Array.from(document.querySelectorAll(".map-node"));
    if (!canvas || nodes.length === 0) {
      return false;
    }
    const canvasRect = canvas.getBoundingClientRect();
    return nodes.every((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= canvasRect.left - 1 && rect.right <= canvasRect.right + 1;
    });
  });
  record("desktop map nodes visible", desktopMapNodesVisible, "all desktop map nodes fit inside the visible canvas after layout");

  const connectorsPainted = await page.evaluate(() => {
    const canvas = document.querySelector("#connector-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return false;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }
    const connectorCount = Number(canvas.dataset.connectorCount ?? 0);
    if (connectorCount === 0) {
      return false;
    }
    const children = Array.from(document.querySelectorAll(".map-node")).filter((node) => node instanceof HTMLElement && node.dataset.parentId);
    if (children.length !== connectorCount) {
      return false;
    }

    function hasPaintNear(x, y) {
      const radius = 2;
      const left = Math.max(0, Math.round(x) - radius);
      const top = Math.max(0, Math.round(y) - radius);
      const size = radius * 2 + 1;
      const data = context.getImageData(left, top, size, size).data;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] > 0) {
          return true;
        }
      }
      return false;
    }

    return children.every((child) => {
      if (!(child instanceof HTMLElement)) {
        return false;
      }
      const parentId = child.dataset.parentId;
      const parent = parentId ? document.querySelector(`.map-node[data-node-id="${parentId}"]`) : null;
      if (!(parent instanceof HTMLElement)) {
        return false;
      }
      const parentX = Number.parseFloat(parent.style.left);
      const parentY = Number.parseFloat(parent.style.top);
      const childX = Number.parseFloat(child.style.left);
      const childY = Number.parseFloat(child.style.top);
      const parentIsLeft = parentX <= childX;
      const start = { x: parentIsLeft ? parentX + 170 : parentX, y: parentY + 37 };
      const end = { x: parentIsLeft ? childX : childX + 170, y: childY + 37 };
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      return hasPaintNear(start.x, start.y) && hasPaintNear(mid.x, mid.y) && hasPaintNear(end.x, end.y);
    });
  });
  record("desktop canvas connectors", connectorsPainted, "canvas connector pixels attach to parent and child node edges");
  const connectorScreenshotPath = join(artifactDir, `${runId}-desktop-connectors-mindmap-editor.png`);
  await page.screenshot({ path: connectorScreenshotPath, fullPage: true });
  record("desktop connector screenshot", true, connectorScreenshotPath);

  const importPayload = JSON.stringify({
    selectedId: "import-browser-root",
    nodes: [
      {
        id: "import-browser-root",
        title: "Imported from browser",
        notes: "Visual import smoke test",
        tags: ["import", "browser"],
        status: "exploring",
        x: 90,
        y: 130,
        updatedAt: "2026-05-23T09:30:00.000Z"
      }
    ]
  });
  await page.getByLabel("JSON import input").fill(importPayload);
  await visible(page.getByText("1 ideas · 1 roots"), "json import preview appears");
  await page.getByRole("button", { name: "Apply JSON import" }).click();
  await visible(page.getByRole("button", { name: /Imported from browser/ }).first(), "json import applies to map");

  const unlabeledControls = await page.locator("button,input,select,textarea").evaluateAll((controls) =>
    controls
      .map((control) => {
        const labels = "labels" in control && control.labels ? Array.from(control.labels).map((label) => label.textContent?.trim() ?? "") : [];
        const name =
          control.getAttribute("aria-label") ??
          control.getAttribute("title") ??
          labels.find(Boolean) ??
          control.textContent?.trim() ??
          "";
        return { tag: control.tagName.toLowerCase(), id: control.id, name };
      })
      .filter((control) => control.name.length === 0)
  );
  record(
    "accessible control names",
    unlabeledControls.length === 0,
    unlabeledControls.length === 0 ? "all interactive controls expose a name" : JSON.stringify(unlabeledControls)
  );

  const desktopHasNoHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  record("desktop layout overflow", desktopHasNoHorizontalOverflow, "1440px viewport has no horizontal overflow");
  const desktopScreenshotPath = join(artifactDir, `${runId}-desktop-mindmap-editor.png`);
  await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
  record("desktop visual screenshot", true, desktopScreenshotPath);

  await page.setViewportSize({ width: 390, height: 900 });
  const mobileHasNoHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  record("mobile layout overflow", mobileHasNoHorizontalOverflow, "390px viewport has no horizontal overflow");
  const mobileMapNodesVisible = await page.evaluate(() => {
    const canvas = document.querySelector(".canvas-grid");
    const nodes = Array.from(document.querySelectorAll(".map-node"));
    if (!canvas || nodes.length === 0) {
      return false;
    }
    const canvasRect = canvas.getBoundingClientRect();
    return nodes.every((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= canvasRect.left - 1 && rect.right <= canvasRect.right + 1;
    });
  });
  record("mobile map nodes visible", mobileMapNodesVisible, "all mobile map nodes fit inside the visible canvas");

  const screenshotPath = join(artifactDir, `${runId}-mobile-mindmap-editor.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  record("mobile visual screenshot", true, screenshotPath);

  const passed = checks.every((check) => check.ok);
  const result = finish(passed, screenshotPath, availability.started);
  await writeFile(join(artifactDir, `${runId}-quality.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!passed) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown browser quality failure";
  record("browser quality failed", false, message);
  const result = finish(false, undefined, Boolean(devServer), message);
  await mkdir(artifactDir, { recursive: true });
  await writeFile(join(artifactDir, `${runId}-quality.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
  if (devServer) {
    devServer.kill("SIGTERM");
  }
}

async function visible(locator, name) {
  await locator.first().waitFor({ state: "visible", timeout: 7000 });
  record(name, true, "visible through role or accessible locator");
}

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  rawLog.push(`browser-quality: ${ok ? "passed" : "failed"}: ${name} - ${detail}`);
}

function finish(passed, screenshotPath, startedServer, failure) {
  return {
    passed,
    command: `node harness-worktree/scripts/browser-quality-check.mjs --url ${targetUrl}`,
    targetProject,
    targetUrl,
    startedServer,
    screenshotPath,
    screenshots: {
      mobile: screenshotPath,
      desktop: checks.find((check) => check.name === "desktop visual screenshot")?.detail
    },
    checks,
    rawLog: rawLog.join("\n"),
    failure
  };
}

async function ensureTargetAvailable(url) {
  if (await isReachable(url)) {
    return { started: false };
  }

  const host = new URL(url).hostname;
  const canStartLocalServer = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host);
  if (!canStartLocalServer || args["no-start"] === "1") {
    throw new Error(`Target app is not reachable at ${url}`);
  }

  const logPath = join(artifactDir, `${runId}-target-dev.log`);
  const stream = createWriteStream(logPath, { flags: "a" });
  const port = new URL(url).port || "5175";
  const proc = spawn("pnpm", ["--filter", "@target/mindmap-editor", "dev", "--", "--port", port], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  proc.stdout.pipe(stream);
  proc.stderr.pipe(stream);

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await isReachable(url)) {
      return { started: true, devServer: proc };
    }
    await sleep(500);
  }

  proc.kill("SIGTERM");
  throw new Error(`Target app did not become reachable at ${url}; see ${logPath}`);
}

async function isReachable(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

function findChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  ].filter(Boolean);

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("No Chromium-compatible executable found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH or install Chromium/Chrome.");
  }
  return found;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const key = item.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "1";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
