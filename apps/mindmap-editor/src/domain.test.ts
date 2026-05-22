import { describe, expect, it } from "vitest";
import {
  buildOutline,
  collectTags,
  createSnapshot,
  completionScore,
  createChildNode,
  createNode,
  exportMapAsMarkdown,
  filterNodes,
  getAncestors,
  getChildren,
  recentActivity,
  restoreSnapshot,
  summarizeMap,
  suggestFocusQueue,
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
});
