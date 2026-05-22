import { describe, expect, it } from "vitest";
import {
  buildOutline,
  buildCommandPalette,
  autoLayoutNodes,
  collectTags,
  createSnapshot,
  completionScore,
  createChildNode,
  createEmptyHistory,
  createHistoryFrame,
  createNode,
  exportMapAsMarkdown,
  exportMapAsJson,
  filterCommands,
  filterNodes,
  getAncestors,
  getChildren,
  moveNode,
  pushHistory,
  recentActivity,
  parseMindMapJson,
  redoHistory,
  restoreSnapshot,
  summarizeMap,
  suggestFocusQueue,
  undoHistory,
  updateNode
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
    expect(updated.x).toBe(1400);
    expect(updated.y).toBe(0);
  });

  it("moves a node with coordinate clamping", () => {
    const moved = moveNode(nodes, "root", { x: 80, y: -250 }, "2026-05-23T07:00:00.000Z");
    const root = moved.find((node) => node.id === "root");
    const sibling = moved.find((node) => node.id === "research");

    expect(root).toMatchObject({ x: 180, y: 0, updatedAt: "2026-05-23T07:00:00.000Z" });
    expect(sibling).toMatchObject({ x: 320, y: 40, updatedAt: "2026-05-23T01:00:00.000Z" });
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
  });
});
