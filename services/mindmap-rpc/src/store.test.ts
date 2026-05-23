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

  it("applies diff operations and returns changes since a client version", () => {
    const created = store.createMap({ title: "Collaborative", selectedId: "root", nodes });
    const result = store.syncMap({
      id: created.id,
      clientId: "client-a",
      sinceVersion: created.version,
      operations: [
        {
          type: "upsert-node",
          node: {
            id: "new-node",
            title: "Synced branch",
            notes: "Created through a diff operation",
            tags: ["sync"],
            status: "exploring",
            parentId: "root",
            x: 520,
            y: 220,
            updatedAt: "2026-05-23T10:20:00.000Z"
          }
        },
        {
          type: "select-node",
          selectedId: "new-node"
        }
      ]
    });

    expect(result.document.version).toBe(created.version + 2);
    expect(result.document.selectedId).toBe("new-node");
    expect(result.document.nodes.find((node) => node.id === "new-node")).toMatchObject({
      title: "Synced branch",
      parentId: "root"
    });
    expect(result.operations.map((operation) => operation.type)).toEqual(["upsert-node", "select-node"]);

    const pulled = store.syncMap({
      id: created.id,
      clientId: "client-b",
      sinceVersion: created.version,
      operations: []
    });

    expect(pulled.operations).toHaveLength(2);
    expect(pulled.operations[0]).toMatchObject({ clientId: "client-a", version: created.version + 1 });
    expect(pulled.document.nodes.find((node) => node.id === "new-node")?.title).toBe("Synced branch");
  });

  it("allows a manual file save after diff sync without stale version coupling", () => {
    const created = store.createMap({ title: "Manual save", selectedId: "root", nodes });
    const synced = store.syncMap({
      id: created.id,
      clientId: "client-a",
      sinceVersion: created.version,
      operations: [
        {
          type: "rename-map",
          title: "Manual save via diff"
        }
      ]
    });

    const saved = store.saveMap({
      id: created.id,
      title: "Manual save via button",
      selectedId: synced.document.selectedId,
      nodes: synced.document.nodes
    });

    expect(saved).toMatchObject({
      id: created.id,
      title: "Manual save via button",
      version: synced.document.version + 1
    });
  });

  it("merges stale-base operations from multiple clients by ordered diff log", () => {
    const created = store.createMap({ title: "Concurrent", selectedId: "root", nodes });
    const clientA = store.syncMap({
      id: created.id,
      clientId: "client-a",
      sinceVersion: created.version,
      operations: [
        {
          type: "rename-map",
          title: "Renamed by A"
        }
      ]
    });

    const clientB = store.syncMap({
      id: created.id,
      clientId: "client-b",
      sinceVersion: created.version,
      operations: [
        {
          type: "upsert-node",
          node: {
            id: "client-b-node",
            title: "Client B branch",
            notes: "Submitted from a stale base version",
            tags: ["sync", "client-b"],
            status: "exploring",
            parentId: "root",
            x: 560,
            y: 260,
            updatedAt: "2026-05-23T10:40:00.000Z"
          }
        },
        {
          type: "select-node",
          selectedId: "client-b-node"
        }
      ]
    });

    expect(clientB.document).toMatchObject({
      title: "Renamed by A",
      selectedId: "client-b-node",
      version: created.version + 3
    });
    expect(clientB.operations.map((operation) => `${operation.clientId}:${operation.type}`)).toEqual([
      "client-a:rename-map",
      "client-b:upsert-node",
      "client-b:select-node"
    ]);

    const clientAPull = store.syncMap({
      id: created.id,
      clientId: "client-a",
      sinceVersion: clientA.document.version,
      operations: []
    });

    expect(clientAPull.operations.map((operation) => operation.clientId)).toEqual(["client-b", "client-b"]);
    expect(clientAPull.document.nodes.find((node) => node.id === "client-b-node")).toMatchObject({
      parentId: "root",
      title: "Client B branch"
    });
  });

  it("deletes files and keeps missing reads explicit", () => {
    const created = store.createMap({ title: "Temporary", selectedId: "root", nodes });

    expect(store.deleteMap(created.id)).toBe(true);
    expect(store.getMap(created.id)).toBeNull();
    expect(store.deleteMap(created.id)).toBe(false);
  });
});
