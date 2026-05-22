import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StoredMindNode } from "@harness/shared";
import { MindMapStore } from "./store.js";

const nodes: StoredMindNode[] = [
  {
    id: "root",
    title: "Product map",
    notes: "Root notes",
    tags: ["product"],
    status: "exploring",
    x: 80,
    y: 120,
    updatedAt: "2026-05-23T10:00:00.000Z"
  },
  {
    id: "child",
    title: "Backend slice",
    notes: "RPC and database",
    tags: ["backend", "rpc"],
    status: "seed",
    parentId: "root",
    x: 320,
    y: 160,
    updatedAt: "2026-05-23T10:01:00.000Z"
  }
];

let store: MindMapStore;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "mindmap-rpc-"));
  store = new MindMapStore(join(dir, "mindmaps.sqlite"));
});

afterEach(() => {
  store.close();
});

describe("MindMapStore", () => {
  it("creates lists and reads SQLite-backed mind map files", () => {
    const created = store.createMap({
      title: "  Launch workspace  ",
      selectedId: "child",
      nodes
    });

    expect(created).toMatchObject({
      title: "Launch workspace",
      selectedId: "child",
      nodeCount: 2,
      version: 1
    });
    expect(created.nodes[1]).toMatchObject({ id: "child", parentId: "root", tags: ["backend", "rpc"] });
    expect(store.listMaps()).toEqual([
      expect.objectContaining({
        id: created.id,
        title: "Launch workspace",
        nodeCount: 2,
        version: 1
      })
    ]);
    expect(store.getMap(created.id)?.nodes).toHaveLength(2);
  });

  it("updates files with optimistic version checks", () => {
    const created = store.createMap({ title: "Versioned", selectedId: "root", nodes });
    const saved = store.saveMap({
      id: created.id,
      title: "Versioned v2",
      selectedId: "root",
      baseVersion: created.version,
      nodes: [
        {
          ...nodes[0],
          title: "Product map v2",
          updatedAt: "2026-05-23T10:10:00.000Z"
        }
      ]
    });

    expect(saved).toMatchObject({
      id: created.id,
      title: "Versioned v2",
      nodeCount: 1,
      version: 2
    });
    expect(saved.nodes[0].title).toBe("Product map v2");
    expect(() =>
      store.saveMap({
        id: created.id,
        title: "Stale write",
        selectedId: "root",
        baseVersion: 1,
        nodes
      })
    ).toThrow(/version conflict/i);
  });

  it("deletes files and keeps missing reads explicit", () => {
    const created = store.createMap({ title: "Temporary", selectedId: "root", nodes });

    expect(store.deleteMap(created.id)).toBe(true);
    expect(store.getMap(created.id)).toBeNull();
    expect(store.deleteMap(created.id)).toBe(false);
  });
});
