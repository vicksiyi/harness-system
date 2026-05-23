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
const mindmapServiceUrl = args["mindmap-rpc-url"] ?? process.env.MINDMAP_RPC_URL ?? "http://localhost:4105";
const artifactDir = resolve(root, ".harness", "browser");
const checks = [];
const rawLog = [];

let devServer;
let mindmapRpcServer;
let browser;

try {
  await mkdir(artifactDir, { recursive: true });
  const rpcAvailability = await ensureServiceAvailable(mindmapServiceUrl, "@target/mindmap-rpc", "mindmap-rpc");
  mindmapRpcServer = rpcAvailability.devServer;
  record("mind map sync service reachable", true, `sync service served at ${mindmapServiceUrl}`);
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
  await visible(page.getByRole("heading", { name: "Collaboration" }), "collaboration sync section");
  await page.getByRole("button", { name: "Open files page" }).click();
  await visible(page.getByRole("heading", { name: "Map Files" }), "map files section");
  await visible(page.getByText(/Sync online|database|sync service/i).first(), "mind map sync status");
  await page.getByRole("button", { name: "Create map file" }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-map-file-id]").length > 0);
  record("database map file creation", true, "front-end created a database-backed map through the sync service");
  await page.getByLabel("Map file title").fill(`Browser save ${runId}`);
  await page.getByRole("button", { name: "Save map file" }).click();
  await visible(page.getByText(/Saved file to database|Saved \d+ changes/).first(), "manual save file succeeds");
  await page.getByLabel("Map file title").fill(`Browser diff ${runId}`);
  await page.getByRole("button", { name: "Save map file" }).click();
  await visible(page.getByText(/Saved \d+ changes|Saved file to database/).first(), "diff sync saves through service");
  await page.getByLabel("Search map files").fill("Browser diff");
  await visible(page.getByRole("button", { name: /Browser diff/ }).first(), "file search filters map library");
  await page.getByLabel("Sort map files").selectOption("nodes-desc");
  const fileSortApplied = await page.getByLabel("Sort map files").evaluate((element) => element instanceof HTMLSelectElement && element.value === "nodes-desc");
  record("file sort changes map library order", fileSortApplied, fileSortApplied ? "file library accepted the ideas sort mode" : "file sort mode did not update");
  await page.getByLabel("Search map files").fill("");
  await page.getByLabel("Search nodes across files").fill("launch");
  await visible(page.getByRole("button", { name: /Open Launch plan in Browser diff/ }).first(), "cross-file node search finds saved node");
  await visible(page.getByRole("heading", { name: "Export" }), "file export section");
  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download JSON export" }).click()
  ]);
  record("json file export download", /\.json$/.test(jsonDownload.suggestedFilename()), `downloaded ${jsonDownload.suggestedFilename()}`);
  const [markdownDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download markdown export" }).click()
  ]);
  record("markdown file export download", /\.md$/.test(markdownDownload.suggestedFilename()), `downloaded ${markdownDownload.suggestedFilename()}`);
  await page.getByRole("button", { name: "Open editor page" }).click();
  const peerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const peerPage = await peerContext.newPage();
  await peerPage.goto(targetUrl, { waitUntil: "networkidle" });
  await peerPage.evaluate(() => {
    window.localStorage.clear();
  });
  await peerPage.reload({ waitUntil: "networkidle" });
  await visible(peerPage.getByRole("heading", { name: "Mind Map Studio" }), "peer client product heading");
  const peerOpenedSharedMap = await peerPage
    .waitForFunction((title) => document.querySelector("[data-current-map-title]")?.textContent?.includes(title), `Browser diff ${runId}`, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  record("peer client opens shared map", peerOpenedSharedMap, peerOpenedSharedMap ? "second client opened the latest synced database file" : "second client did not open the expected shared file");
  const multiClientTitle = `Multi client ${runId}`;
  await page.getByRole("button", { name: "Open files page" }).click();
  await page.getByLabel("Map file title").fill(multiClientTitle);
  await page.getByRole("button", { name: "Save map file" }).click();
  await visible(page.getByText(/Saved \d+ changes|Saved file to database/).first(), "multi-client diff push saves");
  await page.getByRole("button", { name: "Open editor page" }).click();
  await peerPage.getByRole("button", { name: "Pull diff operations" }).click();
  const peerPulledRemoteTitle = await peerPage
    .waitForFunction((title) => document.querySelector("[data-current-map-title]")?.textContent?.includes(title), multiClientTitle, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  record("peer client pulls remote diff", peerPulledRemoteTitle, peerPulledRemoteTitle ? "second client pulled the primary client rename diff" : "second client did not receive the remote rename diff");
  await peerPage.getByLabel("Auto sync changes").check();
  const autoSyncTitle = `Auto sync ${runId}`;
  await page.getByRole("button", { name: "Open files page" }).click();
  await page.getByLabel("Map file title").fill(autoSyncTitle);
  await page.getByRole("button", { name: "Save map file" }).click();
  await visible(page.getByText(/Saved \d+ changes|Saved file to database/).first(), "auto-sync source diff saves");
  await page.getByRole("button", { name: "Open editor page" }).click();
  const peerAutoSyncedTitle = await peerPage
    .waitForFunction((title) => document.querySelector("[data-current-map-title]")?.textContent?.includes(title), autoSyncTitle, { timeout: 7000 })
    .then(() => true)
    .catch(() => false);
  record("peer client auto syncs remote diff", peerAutoSyncedTitle, peerAutoSyncedTitle ? "second client received the rename diff without manual pull" : "second client did not auto sync the remote rename diff");
  await peerContext.close();
  await visible(page.getByRole("heading", { name: "Outline" }), "outline section");
  await visible(page.getByRole("heading", { name: "Focus Queue" }), "focus queue section");

  await page.getByLabel("Search ideas").fill("Narrative");
  await visible(page.getByRole("button", { name: /Narrative options/ }).first(), "search filters idea rows");
  await page.getByLabel("Search ideas").fill("");

  await page.getByRole("button", { name: /Launch plan/ }).first().click();
  await page.keyboard.press("c");
  await visible(page.getByRole("button", { name: /New branch/ }).first(), "new child idea appears");

  await page.getByLabel("Idea title").fill("Browser verified branch");
  await visible(page.getByRole("button", { name: /Browser verified branch/ }).first(), "title edit updates live UI");
  await visible(page.getByRole("heading", { name: "Edit History" }), "edit history section");
  await page.keyboard.press("Control+Z");
  await visible(page.getByRole("button", { name: /^New branch/ }).first(), "undo restores previous node title");
  await page.keyboard.press("Control+Shift+Z");
  await visible(page.getByRole("button", { name: /Browser verified branch/ }).first(), "redo restores edited node title");
  await visible(page.getByRole("heading", { name: "Relationship Insight" }), "relationship insight section");
  const relationshipInsightTracksSelection = await page.locator(".relationship-panel").evaluate((panel) => {
    const text = panel.textContent ?? "";
    return text.includes("Children") && text.includes("Descendants") && text.includes("Siblings") && text.includes("Leaves");
  });
  record(
    "relationship insight metrics",
    relationshipInsightTracksSelection,
    relationshipInsightTracksSelection ? "selected branch relationship metrics are rendered" : "relationship metrics were missing from the inspector"
  );

  await page.keyboard.press("Control+S");
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

  const dragCandidate = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll(".canvas-grid .map-node"))
      .filter((node) => node instanceof HTMLElement)
      .map((node) => ({
        id: node.dataset.nodeId ?? "",
        x: Number.parseFloat(node.style.left),
        y: Number.parseFloat(node.style.top)
      }));
    return (
      nodes.find((node) => node.id === "idea-launch") ??
      nodes.find((node) => node.x > 40 && node.x < 1180 && node.y > 20 && node.y < 430) ??
      nodes[0] ??
      { id: "", x: 0, y: 0 }
    );
  });
  const dragNode = page.locator(`.canvas-grid .map-node[data-node-id="${dragCandidate.id}"]`).first();
  if (dragCandidate.id) {
    await dragNode.click();
  }
  await dragNode.scrollIntoViewIfNeeded();
  const beforeDrag = await dragNode.evaluate((node) => {
    if (!(node instanceof HTMLElement)) {
      return { id: "", x: 0, y: 0 };
    }
    return {
      id: node.dataset.nodeId ?? "",
      x: Number.parseFloat(node.style.left),
      y: Number.parseFloat(node.style.top)
    };
  });
  const dragBox = await dragNode.boundingBox();
  if (!dragBox || !beforeDrag.id) {
    record("node drag updates position", false, "first canvas node had no draggable bounding box");
  } else {
    const dragDelta = {
      x: beforeDrag.x > 1200 ? -72 : 72,
      y: beforeDrag.y > 430 ? -40 : 40
    };
    await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(dragBox.x + dragBox.width / 2 + dragDelta.x, dragBox.y + dragBox.height / 2 + dragDelta.y, { steps: 12 });
    await page.waitForTimeout(50);
    await page.mouse.up();
    const dragApplied = await page
      .waitForFunction(
        ({ before, delta }) => {
          const node = Array.from(document.querySelectorAll(".canvas-grid .map-node")).find(
            (element) => element instanceof HTMLElement && element.dataset.nodeId === before.id
          );
          const currentX = node instanceof HTMLElement ? Number.parseFloat(node.style.left) : before.x;
          const currentY = node instanceof HTMLElement ? Number.parseFloat(node.style.top) : before.y;
          return (
            node instanceof HTMLElement &&
            Math.sign(currentX - before.x) === Math.sign(delta.x) &&
            Math.abs(currentX - before.x) > 30 &&
            Math.sign(currentY - before.y) === Math.sign(delta.y) &&
            Math.abs(currentY - before.y) > 16
          );
        },
        { before: beforeDrag, delta: dragDelta },
        { timeout: 3000 }
      )
      .then(() => true)
      .catch(() => false);
    record("node drag updates position", dragApplied, `dragging canvas node ${beforeDrag.id} updates persisted node coordinates`);
  }

  await page.locator(".canvas-grid").click({ position: { x: 24, y: 24 } });
  await page.keyboard.press("l");
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

  await visible(page.getByRole("button", { name: "Collapse selected branch" }), "branch collapse action");
  const beforeCollapseNodeCount = await page.locator(".canvas-grid .map-node").count();
  await page.getByRole("button", { name: "Collapse selected branch" }).click();
  const branchCollapsed = await page
    .waitForFunction(
      (beforeCount) => {
        const nodeCount = document.querySelectorAll(".canvas-grid .map-node").length;
        const expandButton = Array.from(document.querySelectorAll("button")).find((button) => button.getAttribute("aria-label") === "Expand selected branch");
        return nodeCount < beforeCount && Boolean(expandButton);
      },
      beforeCollapseNodeCount,
      { timeout: 3000 }
    )
    .then(() => true)
    .catch(() => false);
  record("branch collapse hides descendants", branchCollapsed, branchCollapsed ? "collapse action hides descendant canvas nodes" : "collapse action did not hide descendants");
  await page.getByRole("button", { name: "Expand selected branch" }).click();
  const branchExpanded = await page
    .waitForFunction(
      (beforeCount) => document.querySelectorAll(".canvas-grid .map-node").length === beforeCount,
      beforeCollapseNodeCount,
      { timeout: 3000 }
    )
    .then(() => true)
    .catch(() => false);
  record("branch expand restores descendants", branchExpanded, branchExpanded ? "expand action restores descendant canvas nodes" : "expand action did not restore descendants");

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

  await visible(page.getByRole("toolbar", { name: "Canvas viewport" }), "infinite canvas viewport controls");
  await visible(page.getByLabel("Canvas mini map"), "canvas mini map appears");
  const miniMapRendered = await page.evaluate(() => {
    const miniMap = document.querySelector(".mini-map");
    const selected = document.querySelector(".mini-map-node.selected");
    const viewport = document.querySelector(".mini-map-viewport");
    if (!(miniMap instanceof HTMLElement) || !(selected instanceof HTMLElement) || !(viewport instanceof HTMLElement)) {
      return false;
    }
    return miniMap.getBoundingClientRect().width >= 120 && selected.getBoundingClientRect().width > 0 && viewport.getBoundingClientRect().width > 0;
  });
  record("canvas mini map renders model", miniMapRendered, "mini map shows selected node marker and viewport frame");
  await page.getByRole("button", { name: "Pan canvas right" }).click();
  await page.getByRole("button", { name: "Pan canvas down" }).click();
  await page.locator(".canvas-grid").click({ position: { x: 24, y: 24 } });
  await page.keyboard.press("Control+=");
  const viewportChanged = await page.evaluate(() => {
    const canvas = document.querySelector(".canvas-grid");
    return (
      canvas?.getAttribute("data-pan-x") === "180" &&
      canvas?.getAttribute("data-pan-y") === "140" &&
      Number(canvas?.getAttribute("data-zoom")) > 1
    );
  });
  record("infinite canvas viewport transform", viewportChanged, "pan controls and keyboard zoom update canvas viewport state");
  const viewportScreenshotPath = join(artifactDir, `${runId}-desktop-viewport-mindmap-editor.png`);
  await page.screenshot({ path: viewportScreenshotPath, fullPage: true });
  record("desktop viewport screenshot", true, viewportScreenshotPath);
  await page.keyboard.press("Control+0");
  const viewportReset = await page.evaluate(() => {
    const canvas = document.querySelector(".canvas-grid");
    return canvas?.getAttribute("data-pan-x") === "0" && canvas?.getAttribute("data-pan-y") === "0" && canvas?.getAttribute("data-zoom") === "1";
  });
  record("infinite canvas reset", viewportReset, "reset restores origin pan and 100% zoom");

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
  const importFilePath = join(artifactDir, `${runId}-import.json`);
  await writeFile(importFilePath, importPayload, "utf8");
  await page.getByRole("button", { name: "Open files page" }).click();
  await page.getByLabel("Import JSON file").setInputFiles(importFilePath);
  await visible(page.getByText("1 ideas · 1 roots"), "json file import preview appears");
  await page.getByRole("button", { name: "Apply JSON import" }).click();
  await page.getByRole("button", { name: "Open editor page" }).click();
  await visible(page.getByRole("button", { name: /Imported from browser/ }).first(), "json import applies to map");
  await page.getByRole("button", { name: "Push diff operations" }).click();
  await visible(page.getByText(/Saved \d+ changes|Saved file to database/).first(), "import diff sync saves through service");
  const diffQueueDrained = await page
    .waitForFunction(() => {
      const status = document.querySelector(".collaboration-panel .remote-status")?.textContent ?? "";
      return /\b0 pending ops\b/.test(status);
    }, null, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  record("diff queue drains after import", diffQueueDrained, diffQueueDrained ? "pending diff operations synced before screenshots" : "pending diff operations remained before screenshots");

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
  const result = finish(passed, screenshotPath, availability.started || rpcAvailability.started);
  await writeFile(join(artifactDir, `${runId}-quality.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!passed) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown browser quality failure";
  record("browser quality failed", false, message);
  const result = finish(false, undefined, Boolean(devServer) || Boolean(mindmapRpcServer), message);
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
  if (mindmapRpcServer) {
    mindmapRpcServer.kill("SIGTERM");
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
  const port = new URL(url).port || "5175";
  return ensureServiceAvailable(url, "@target/mindmap-editor", "target-dev", ["--", "--port", port]);
}

async function ensureServiceAvailable(url, filter, label, extraArgs = []) {
  if (await isReachable(url)) {
    return { started: false };
  }

  const host = new URL(url).hostname;
  const canStartLocalServer = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host);
  if (!canStartLocalServer || args["no-start"] === "1") {
    throw new Error(`${label} is not reachable at ${url}`);
  }

  const logPath = join(artifactDir, `${runId}-${label}.log`);
  const stream = createWriteStream(logPath, { flags: "a" });
  const proc = spawn("pnpm", ["--filter", filter, "dev", ...extraArgs], {
    cwd: root,
    env: {
      ...process.env,
      VITE_MINDMAP_RPC_URL: process.env.VITE_MINDMAP_RPC_URL ?? mindmapServiceUrl
    },
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
  throw new Error(`${label} did not become reachable at ${url}; see ${logPath}`);
}

async function isReachable(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      return true;
    }
    const healthResponse = await fetch(`${url.replace(/\/$/, "")}/health`);
    return healthResponse.ok;
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
