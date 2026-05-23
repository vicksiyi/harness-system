import { describe, expect, it } from "vitest";
import {
  buildOutline,
  buildCommandPalette,
  buildMiniMap,
  buildRelationshipInsight,
  buildHistorySyncOperations,
  collapsedDescendantCount,
  autoLayoutNodes,
  collectTags,
  createExportArtifact,
  createCanvasViewport,
  createSnapshot,
  completionScore,
  createChildNode,
  createEmptyHistory,
  createHistoryFrame,
  createNode,
  exportMapAsMarkdown,
  exportMapAsJson,
  filterCommands,
  filterMapFiles,
  filterNodes,
  getAncestors,
  getChildren,
  visibleNodesByCollapse,
  moveNode,
  panCanvasViewport,
  pushHistory,
  recentActivity,
  parseMindMapJson,
  redoHistory,
  restoreSnapshot,
  resolveEditorShortcut,
  summarizeMap,
  suggestFocusQueue,
  undoHistory,
  updateNode,
  zoomCanvasViewport
} from "./domain.js";

const nodes = [
  createNode({
    id: "root",
    title: " Launch plan ",
    notes: "Coordinate the product launch",
    tags: ["Launch", "strategy"],
    status: "exploring",
    x: 100,
    y: 100,
    updatedAt: "2026-05-23T02:00:00.000Z"
  }),
  createNode({
    id: "research",
    title: "Research signals",
    notes: "Interview notes and market scans",
    tags: ["research"],
    parentId: "root",
    status: "committed",
    x: 320,
    y: 40,
    updatedAt: "2026-05-23T01:00:00.000Z"
  }),
  createNode({
    id: "story",
    title: "Narrative options",
    notes: "",
    tags: ["launch", "writing"],
    parentId: "root",
    status: "seed",
    x: 320,
    y: 180,
    updatedAt: "2026-05-23T00:30:00.000Z"
  })
];

describe("mind map domain", () => {
  it("normalizes nodes", () => {
    const node = createNode({ id: "n1", title: "  A   node ", tags: ["UX", "ux", " "] });

    expect(node.title).toBe("A node");
    expect(node.tags).toEqual(["ux"]);
    expect(node.status).toBe("seed");
  });

  it("updates node fields safely", () => {
    const updated = updateNode(nodes[0], {
      title: " Refined launch plan ",
      notes: "  concise notes ",
      tags: ["Go-To-Market", "launch"],
      x: 1500,
      y: Number.NaN,
      updatedAt: "2026-05-23T03:00:00.000Z"
    });

    expect(updated.title).toBe("Refined launch plan");
    expect(updated.notes).toBe("concise notes");
    expect(updated.tags).toEqual(["go-to-market", "launch"]);
    expect(updated.x).toBe(1500);
    expect(updated.y).toBe(0);
  });

  it("moves a node with coordinate clamping", () => {
    const moved = moveNode(nodes, "root", { x: 80, y: -250 }, "2026-05-23T07:00:00.000Z");
    const root = moved.find((node) => node.id === "root");
    const sibling = moved.find((node) => node.id === "research");

    expect(root).toMatchObject({ x: 180, y: 0, updatedAt: "2026-05-23T07:00:00.000Z" });
    expect(sibling).toMatchObject({ x: 320, y: 40, updatedAt: "2026-05-23T01:00:00.000Z" });
  });

  it("keeps node coordinates usable on a large canvas", () => {
    const farNode = createNode({ id: "far", title: "Far branch", x: 25_500, y: 18_200 });
    const clampedNode = createNode({ id: "edge", title: "Edge branch", x: 200_000, y: 200_000 });

    expect(farNode).toMatchObject({ x: 25500, y: 18200 });
    expect(clampedNode).toMatchObject({ x: 100000, y: 100000 });
  });

  it("creates child nodes from parent context", () => {
    const child = createChildNode(nodes[0], 2, "child", "2026-05-23T04:00:00.000Z");

    expect(child.parentId).toBe("root");
    expect(child.tags).toEqual(["launch", "strategy"]);
    expect(child.x).toBeGreaterThan(nodes[0].x);
  });

  it("filters by query tag and status", () => {
    expect(filterNodes(nodes, { query: "market" }).map((node) => node.id)).toEqual(["research"]);
    expect(filterNodes(nodes, { tag: "writing" }).map((node) => node.id)).toEqual(["story"]);
    expect(filterNodes(nodes, { status: "exploring" }).map((node) => node.id)).toEqual(["root"]);
  });

  it("collects tags and summarizes map health", () => {
    const summary = summarizeMap(nodes);

    expect(collectTags(nodes)).toEqual(["launch", "research", "strategy", "writing"]);
    expect(summary.total).toBe(3);
    expect(summary.roots).toBe(1);
    expect(summary.leaves).toBe(2);
    expect(summary.byStatus.seed).toBe(1);
    expect(summary.completion).toBe(completionScore(nodes));
  });

  it("finds children and ancestors", () => {
    expect(getChildren(nodes, "root").map((node) => node.id)).toEqual(["research", "story"]);
    expect(getAncestors(nodes, "story").map((node) => node.id)).toEqual(["root"]);
  });

  it("builds relationship insight for the selected branch", () => {
    const insight = buildRelationshipInsight(
      [
        ...nodes,
        createNode({
          id: "draft",
          title: "Launch draft",
          notes: "Shares launch context",
          tags: ["launch", "writing"],
          parentId: "story",
          status: "exploring",
          x: 520,
          y: 260
        }),
        createNode({
          id: "metrics",
          title: "Launch metrics",
          tags: ["launch", "analytics"],
          status: "committed",
          x: 120,
          y: 360
        })
      ],
      "story"
    );

    expect(insight).toMatchObject({
      selectedId: "story",
      depth: 1,
      parentTitle: "Launch plan",
      childCount: 1,
      descendantCount: 1,
      siblingCount: 1,
      leafCount: 1,
      recommendation: "Expand this branch with clearer child ideas"
    });
    expect(insight.ancestorTrail.map((item) => item.title)).toEqual(["Launch plan"]);
    expect(insight.statusMix).toEqual({ seed: 1, exploring: 1, committed: 0 });
    expect(insight.relatedByTag.map((item) => item.id)).toEqual(["metrics"]);
    expect(insight.relatedByTag[0].sharedTags).toEqual(["launch"]);
  });

  it("filters collapsed branch descendants while keeping the collapsed node visible", () => {
    const nestedNodes = [
      ...nodes,
      createNode({
        id: "draft",
        title: "Launch draft",
        parentId: "story",
        tags: ["writing"],
        x: 540,
        y: 220
      })
    ];

    expect(visibleNodesByCollapse(nestedNodes, ["story"]).map((node) => node.id)).toEqual(["root", "research", "story"]);
    expect(visibleNodesByCollapse(nestedNodes, ["root"]).map((node) => node.id)).toEqual(["root"]);
    expect(visibleNodesByCollapse(nestedNodes, ["missing"]).map((node) => node.id)).toEqual(["root", "research", "story", "draft"]);
    expect(collapsedDescendantCount(nestedNodes, "root")).toBe(3);
    expect(collapsedDescendantCount(nestedNodes, "research")).toBe(0);
  });

  it("builds a depth ordered outline", () => {
    expect(buildOutline(nodes)).toEqual([
      { id: "root", title: "Launch plan", depth: 0, status: "exploring" },
      { id: "research", title: "Research signals", depth: 1, status: "committed" },
      { id: "story", title: "Narrative options", depth: 1, status: "seed" }
    ]);
  });

  it("auto lays out nodes by hierarchy depth and outline order", () => {
    const laidOut = autoLayoutNodes(nodes, { startX: 10, startY: 20, columnGap: 100, rowGap: 50 });
    const byId = new Map(laidOut.map((node) => [node.id, node]));

    expect(byId.get("root")).toMatchObject({ x: 10, y: 20 });
    expect(byId.get("research")).toMatchObject({ x: 110, y: 70 });
    expect(byId.get("story")).toMatchObject({ x: 110, y: 120 });
    expect(byId.get("root")?.updatedAt).toBe(nodes[0].updatedAt);
  });


  it("suggests focus from status, child count, and short notes", () => {
    const focus = suggestFocusQueue(nodes);

    expect(focus[0]?.nodeId).toBe("story");
    expect(focus[0]?.reason).toBe("Needs a first pass");
    expect(focus[1]?.nodeId).toBe("root");
  });

  it("exports a markdown outline", () => {
    const markdown = exportMapAsMarkdown(nodes);

    expect(markdown).toContain("# Mind Map Export");
    expect(markdown).toContain("- Launch plan (exploring)");
    expect(markdown).toContain("  - Research signals (committed)");
    expect(markdown).toContain("Notes: Coordinate the product launch");
  });

  it("exports a portable JSON document", () => {
    const json = exportMapAsJson(nodes, "story", "2026-05-23T06:00:00.000Z");
    const parsed = JSON.parse(json) as { version: number; selectedId: string; nodes: unknown[] };

    expect(parsed.version).toBe(1);
    expect(parsed.selectedId).toBe("story");
    expect(parsed.nodes).toHaveLength(3);
    expect(json).toContain('"exportedAt": "2026-05-23T06:00:00.000Z"');
  });

  it("creates downloadable export artifacts with safe file names", () => {
    const json = createExportArtifact({
      format: "json",
      nodes,
      selectedId: "story",
      title: "Launch / Research Map!",
      exportedAt: "2026-05-23T06:00:00.000Z"
    });
    const markdown = createExportArtifact({
      format: "markdown",
      nodes,
      selectedId: "story",
      title: "  ",
      exportedAt: "not-a-date"
    });

    expect(json.fileName).toBe("launch-research-map-2026-05-23.json");
    expect(json.mimeType).toBe("application/json;charset=utf-8");
    expect(JSON.parse(json.content)).toMatchObject({ selectedId: "story" });
    expect(markdown.fileName).toBe("mind-map-export.md");
    expect(markdown.mimeType).toBe("text/markdown;charset=utf-8");
    expect(markdown.content).toContain("# Mind Map Export");
  });

  it("parses imported JSON with a preview and normalized nodes", () => {
    const json = JSON.stringify({
      selectedId: "import-child",
      nodes: [
        { id: "import-root", title: " Imported root ", tags: ["Ops"], status: "exploring", x: 10, y: 20 },
        { id: "import-child", title: "Child", tags: ["ops", "Plan"], parentId: "import-root", status: "committed" }
      ]
    });
    const result = parseMindMapJson(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.selectedId).toBe("import-child");
    expect(result.preview).toEqual({
      total: 2,
      roots: 1,
      tags: ["ops", "plan"],
      selectedTitle: "Child"
    });
    expect(result.nodes[0].title).toBe("Imported root");
  });

  it("rejects invalid imports without producing nodes", () => {
    expect(parseMindMapJson("").ok).toBe(false);
    expect(parseMindMapJson("{nope").ok).toBe(false);
    expect(parseMindMapJson(JSON.stringify({ nodes: [{ id: "dup" }, { id: "dup" }] }))).toEqual({
      ok: false,
      error: "Duplicate node id: dup."
    });
  });

  it("creates restorable snapshots without sharing mutable node arrays", () => {
    const snapshot = createSnapshot({
      nodes,
      selectedId: "story",
      label: "  Launch checkpoint  ",
      id: "snap-1",
      createdAt: "2026-05-23T05:00:00.000Z"
    });

    const restored = restoreSnapshot(snapshot);
    restored.nodes[0].tags.push("mutated");

    expect(snapshot.label).toBe("Launch checkpoint");
    expect(snapshot.selectedId).toBe("story");
    expect(restored.selectedId).toBe("story");
    expect(snapshot.nodes[0].tags).not.toContain("mutated");
  });

  it("falls back to a valid selected node when restoring snapshots", () => {
    const snapshot = createSnapshot({
      nodes,
      selectedId: "missing",
      id: "snap-2",
      createdAt: "2026-05-23T05:30:00.000Z"
    });

    expect(snapshot.selectedId).toBe("root");
    expect(restoreSnapshot(snapshot).selectedId).toBe("root");
  });

  it("summarizes recent activity by newest node update", () => {
    const activity = recentActivity(nodes, 2);

    expect(activity).toHaveLength(2);
    expect(activity[0]).toMatchObject({
      nodeId: "root",
      title: "Launch plan",
      status: "exploring"
    });
    expect(activity[1]?.summary).toBe("Interview notes and market scans");
  });

  it("tracks undo and redo history with immutable frames", () => {
    const originalNodes = nodes.map((node) => ({ ...node, tags: [...node.tags] }));
    const frame = createHistoryFrame({
      nodes: originalNodes,
      selectedId: "root",
      label: "  Before drag  ",
      createdAt: "2026-05-23T08:00:00.000Z"
    });
    const pushed = pushHistory(createEmptyHistory(), frame, 3);
    const movedNodes = moveNode(originalNodes, "root", { x: 100, y: 40 }, "2026-05-23T08:01:00.000Z");
    const current = createHistoryFrame({
      nodes: movedNodes,
      selectedId: "root",
      label: "After drag",
      createdAt: "2026-05-23T08:01:00.000Z"
    });

    originalNodes[0].tags.push("mutated");
    const undone = undoHistory(pushed, current);

    expect(pushed.past[0].label).toBe("Before drag");
    expect(pushed.past[0].nodes[0].tags).not.toContain("mutated");
    expect(undone?.frame.nodes.find((node) => node.id === "root")).toMatchObject({ x: 100, y: 100 });
    expect(undone?.history.future[0].nodes.find((node) => node.id === "root")).toMatchObject({ x: 200, y: 140 });

    const redone = undone ? redoHistory(undone.history, undone.frame) : null;
    expect(redone?.frame.nodes.find((node) => node.id === "root")).toMatchObject({ x: 200, y: 140 });
    expect(redone?.history.past[0].nodes.find((node) => node.id === "root")).toMatchObject({ x: 100, y: 100 });
  });

  it("builds collaborative sync operations for undo and redo frames", () => {
    const previousNodes = [
      ...nodes,
      createNode({
        id: "scratch",
        title: "Scratch branch",
        parentId: "root",
        x: 520,
        y: 320
      })
    ];
    const restoredNodes = [nodes[1], nodes[0], nodes[2]];
    const operations = buildHistorySyncOperations(previousNodes, restoredNodes, "story");

    expect(operations[0]).toEqual({ type: "select-node", selectedId: "story" });
    expect(operations.map((operation) => operation.type)).toEqual(["select-node", "upsert-node", "upsert-node", "upsert-node", "delete-node"]);
    expect(operations[1]).toMatchObject({ type: "upsert-node", node: { id: "root" } });
    expect(operations[2]).toMatchObject({ type: "upsert-node", node: { id: "research", parentId: "root" } });
    expect(operations.at(-1)).toEqual({ type: "delete-node", nodeId: "scratch" });
  });

  it("clamps and updates infinite canvas viewport state", () => {
    const viewport = createCanvasViewport({ x: -20, y: Number.NaN, zoom: 8 });
    const panned = panCanvasViewport(viewport, { x: 320, y: 180 });
    const zoomed = zoomCanvasViewport(panned, -1.6);
    const focalZoomed = zoomCanvasViewport(createCanvasViewport({ x: 120, y: 80, zoom: 1 }), 0.5, { x: 300, y: 160 });

    expect(viewport).toEqual({ x: 0, y: 0, zoom: 1.8 });
    expect(panned).toEqual({ x: 320, y: 180, zoom: 1.8 });
    expect(zoomed).toEqual({ x: 320, y: 180, zoom: 0.5 });
    expect(focalZoomed).toEqual({ x: 220, y: 133, zoom: 1.5 });
  });

  it("builds a mini map model from nodes and viewport", () => {
    const model = buildMiniMap(nodes, "story", createCanvasViewport({ x: 120, y: 80, zoom: 1.2 }), {
      visibleWidth: 600,
      visibleHeight: 360,
      maxWidth: 150,
      maxHeight: 90
    });

    expect(model.width).toBeLessThanOrEqual(150);
    expect(model.height).toBeLessThanOrEqual(90);
    expect(model.nodes).toHaveLength(3);
    expect(model.nodes.find((node) => node.id === "story")).toMatchObject({ selected: true });
    expect(model.viewport).toMatchObject({
      left: expect.any(Number),
      top: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number)
    });
    expect(model.viewport.width).toBeGreaterThan(8);
  });

  it("builds command palette items with contextual disabled states", () => {
    const commands = buildCommandPalette({ hasSnapshots: false, hasSelection: true, canUndo: true, canRedo: false });

    expect(commands.map((command) => command.id)).toEqual([
      "add-root",
      "add-child",
      "undo-edit",
      "redo-edit",
      "save-snapshot",
      "restore-latest",
      "focus-search",
      "auto-layout",
      "zoom-in",
      "zoom-out",
      "reset-view",
      "export-markdown",
      "export-json",
      "focus-import"
    ]);
    expect(commands.find((command) => command.id === "add-child")?.disabled).toBe(false);
    expect(commands.find((command) => command.id === "undo-edit")?.disabled).toBe(false);
    expect(commands.find((command) => command.id === "redo-edit")?.disabled).toBe(true);
    expect(commands.find((command) => command.id === "restore-latest")?.disabled).toBe(true);
  });

  it("filters command palette by title description shortcut and keyword", () => {
    const commands = buildCommandPalette({ hasSnapshots: true, hasSelection: true });

    expect(filterCommands(commands, "child").map((command) => command.id)).toEqual(["add-child"]);
    expect(filterCommands(commands, "checkpoint").map((command) => command.id)).toEqual(["save-snapshot", "restore-latest"]);
    expect(filterCommands(commands, "/").map((command) => command.id)).toEqual(["focus-search"]);
    expect(filterCommands(commands, "layout").map((command) => command.id)).toEqual(["auto-layout"]);
    expect(filterCommands(commands, "json").map((command) => command.id)).toEqual(["export-json", "focus-import"]);
    expect(filterCommands(commands, "undo").map((command) => command.id)).toEqual(["undo-edit"]);
    expect(filterCommands(commands, "zoom").map((command) => command.id)).toEqual(["zoom-in", "zoom-out", "reset-view"]);
  });

  it("resolves editor keyboard shortcuts with clear browser-safe ownership", () => {
    expect(resolveEditorShortcut({ key: "r" })).toBe("add-root");
    expect(resolveEditorShortcut({ key: "c" })).toBe("add-child");
    expect(resolveEditorShortcut({ key: "l" })).toBe("auto-layout");
    expect(resolveEditorShortcut({ key: "r", shiftKey: true })).toBe("restore-latest");
    expect(resolveEditorShortcut({ key: "z", metaKey: true })).toBe("undo-edit");
    expect(resolveEditorShortcut({ key: "z", ctrlKey: true, shiftKey: true })).toBe("redo-edit");
    expect(resolveEditorShortcut({ key: "y", ctrlKey: true })).toBe("redo-edit");
    expect(resolveEditorShortcut({ key: "s", metaKey: true })).toBe("save-snapshot");
    expect(resolveEditorShortcut({ key: "=", metaKey: true })).toBe("zoom-in");
    expect(resolveEditorShortcut({ key: "+", ctrlKey: true })).toBe("zoom-in");
    expect(resolveEditorShortcut({ key: "-", ctrlKey: true })).toBe("zoom-out");
    expect(resolveEditorShortcut({ key: "0", metaKey: true })).toBe("reset-view");
    expect(resolveEditorShortcut({ key: "k", metaKey: true, targetIsTyping: true })).toBe("open-command-palette");
  });

  it("preserves browser and text editing shortcuts instead of falling through to app commands", () => {
    expect(resolveEditorShortcut({ key: "r", metaKey: true })).toBeNull();
    expect(resolveEditorShortcut({ key: "r", ctrlKey: true })).toBeNull();
    expect(resolveEditorShortcut({ key: "c", metaKey: true })).toBeNull();
    expect(resolveEditorShortcut({ key: "l", ctrlKey: true })).toBeNull();
    expect(resolveEditorShortcut({ key: "r", targetIsTyping: true })).toBeNull();
    expect(resolveEditorShortcut({ key: "z", metaKey: true, targetIsTyping: true })).toBeNull();
    expect(resolveEditorShortcut({ key: "s", ctrlKey: true, targetIsTyping: true })).toBeNull();
    expect(resolveEditorShortcut({ key: "=", metaKey: true, targetIsTyping: true })).toBeNull();
    expect(resolveEditorShortcut({ key: "c", shiftKey: true })).toBeNull();
  });

  it("filters and sorts map files for the file workspace", () => {
    const files = [
      { id: "alpha", title: "Launch Planning", nodeCount: 3, version: 2, updatedAt: "2026-05-23T03:00:00.000Z" },
      { id: "beta", title: "Research Archive", nodeCount: 9, version: 4, updatedAt: "2026-05-23T02:00:00.000Z" },
      { id: "gamma", title: "Launch Metrics", nodeCount: 6, version: 7, updatedAt: "2026-05-23T04:00:00.000Z" }
    ];

    expect(filterMapFiles(files, "launch", "updated-desc").map((file) => file.id)).toEqual(["gamma", "alpha"]);
    expect(filterMapFiles(files, "", "title-asc").map((file) => file.id)).toEqual(["gamma", "alpha", "beta"]);
    expect(filterMapFiles(files, "", "nodes-desc").map((file) => file.id)).toEqual(["beta", "gamma", "alpha"]);
  });
});
