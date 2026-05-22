import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createId, type MindMapFileDocument, type MindMapFileSummary, type MindMapSaveInput, type StoredMindNode } from "@harness/shared";

interface CreateMapInput {
  title: string;
  selectedId: string;
  nodes: StoredMindNode[];
}

interface MapRow {
  id: string;
  title: string;
  selected_id: string;
  node_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

interface NodeRow {
  id: string;
  title: string;
  notes: string;
  tags_json: string;
  status: StoredMindNode["status"];
  x: number;
  y: number;
  parent_id: string | null;
  updated_at: string;
}

export function defaultMindMapDatabasePath(root = process.env.HARNESS_ROOT ?? process.cwd()): string {
  return process.env.MINDMAP_DB_PATH ?? join(root, ".harness", "mindmap", "mindmaps.sqlite");
}

export class MindMapStore {
  private readonly db: DatabaseSync;

  constructor(databasePath = defaultMindMapDatabasePath()) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  listMaps(): MindMapFileSummary[] {
    const rows = this.db
      .prepare(
        `SELECT maps.id,
                maps.title,
                maps.selected_id,
                maps.version,
                maps.created_at,
                maps.updated_at,
                COUNT(nodes.id) AS node_count
           FROM maps
           LEFT JOIN nodes ON nodes.map_id = maps.id
          GROUP BY maps.id
          ORDER BY maps.updated_at DESC, maps.title ASC`
      )
      .all() as unknown as MapRow[];

    return rows.map(summaryFromRow);
  }

  getMap(id: string): MindMapFileDocument | null {
    const row = this.db
      .prepare(
        `SELECT maps.id,
                maps.title,
                maps.selected_id,
                maps.version,
                maps.created_at,
                maps.updated_at,
                COUNT(nodes.id) AS node_count
           FROM maps
           LEFT JOIN nodes ON nodes.map_id = maps.id
          WHERE maps.id = ?
          GROUP BY maps.id`
      )
      .get(id) as unknown as MapRow | undefined;

    if (!row) {
      return null;
    }

    return {
      ...summaryFromRow(row),
      nodes: this.readNodes(id)
    };
  }

  createMap(input: CreateMapInput): MindMapFileDocument {
    const at = new Date().toISOString();
    const id = createId("map");
    const nodes = normalizeNodes(input.nodes, at);
    const selectedId = safeSelectedId(nodes, input.selectedId);
    const title = normalizeTitle(input.title);

    this.transaction(() => {
      this.db
        .prepare("INSERT INTO maps (id, title, selected_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, title, selectedId, 1, at, at);
      this.writeNodes(id, nodes);
    });

    const created = this.getMap(id);
    if (!created) {
      throw new Error(`Created map ${id} could not be read.`);
    }
    return created;
  }

  saveMap(input: MindMapSaveInput): MindMapFileDocument {
    const existing = this.getMap(input.id);
    if (!existing) {
      throw new Error(`Mind map file not found: ${input.id}`);
    }
    if (input.baseVersion !== undefined && input.baseVersion !== existing.version) {
      throw new Error(`Mind map version conflict: expected ${existing.version}, received ${input.baseVersion}`);
    }

    const at = new Date().toISOString();
    const nodes = normalizeNodes(input.nodes, at);
    const selectedId = safeSelectedId(nodes, input.selectedId);

    this.transaction(() => {
      this.db
        .prepare("UPDATE maps SET title = ?, selected_id = ?, version = ?, updated_at = ? WHERE id = ?")
        .run(normalizeTitle(input.title), selectedId, existing.version + 1, at, input.id);
      this.db.prepare("DELETE FROM nodes WHERE map_id = ?").run(input.id);
      this.writeNodes(input.id, nodes);
    });

    const saved = this.getMap(input.id);
    if (!saved) {
      throw new Error(`Saved map ${input.id} could not be read.`);
    }
    return saved;
  }

  deleteMap(id: string): boolean {
    const result = this.db.prepare("DELETE FROM maps WHERE id = ?").run(id);
    return result.changes > 0;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS maps (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        selected_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nodes (
        map_id TEXT NOT NULL,
        id TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        status TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        parent_id TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (map_id, id),
        FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS nodes_map_parent_idx ON nodes(map_id, parent_id);
      CREATE INDEX IF NOT EXISTS maps_updated_idx ON maps(updated_at DESC);
    `);
  }

  private readNodes(mapId: string): StoredMindNode[] {
    const rows = this.db
      .prepare("SELECT id, title, notes, tags_json, status, x, y, parent_id, updated_at FROM nodes WHERE map_id = ? ORDER BY parent_id IS NOT NULL, y ASC, title ASC")
      .all(mapId) as unknown as NodeRow[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      notes: row.notes,
      tags: readTags(row.tags_json),
      status: normalizeStatus(row.status),
      x: row.x,
      y: row.y,
      parentId: row.parent_id ?? undefined,
      updatedAt: row.updated_at
    }));
  }

  private writeNodes(mapId: string, nodes: StoredMindNode[]): void {
    const statement = this.db.prepare(
      `INSERT INTO nodes (map_id, id, title, notes, tags_json, status, x, y, parent_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const node of nodes) {
      statement.run(
        mapId,
        node.id,
        node.title,
        node.notes,
        JSON.stringify(node.tags),
        node.status,
        node.x,
        node.y,
        node.parentId ?? null,
        node.updatedAt
      );
    }
  }

  private transaction(work: () => void): void {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      work();
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }
}

function summaryFromRow(row: MapRow): MindMapFileSummary {
  return {
    id: row.id,
    title: row.title,
    selectedId: row.selected_id,
    nodeCount: row.node_count,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeNodes(nodes: StoredMindNode[], at: string): StoredMindNode[] {
  const ids = new Set(nodes.map((node) => node.id).filter(Boolean));
  const normalized = nodes.map((node, index) => ({
    id: node.id || createId("node"),
    title: normalizeTitle(node.title),
    notes: node.notes?.trim() ?? "",
    tags: [...new Set((node.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    status: normalizeStatus(node.status),
    x: clampCoordinate(node.x),
    y: clampCoordinate(node.y),
    parentId: node.parentId && ids.has(node.parentId) ? node.parentId : undefined,
    updatedAt: node.updatedAt || at
  }));

  if (normalized.length > 0) {
    return normalized;
  }

  return [
    {
      id: createId("node"),
      title: "Untitled map",
      notes: "",
      tags: [],
      status: "seed",
      x: 80,
      y: 120,
      updatedAt: at
    }
  ];
}

function safeSelectedId(nodes: StoredMindNode[], selectedId: string): string {
  return nodes.some((node) => node.id === selectedId) ? selectedId : nodes[0]?.id ?? "";
}

function normalizeTitle(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  return normalized || "Untitled map";
}

function normalizeStatus(status: unknown): StoredMindNode["status"] {
  return status === "exploring" || status === "committed" || status === "seed" ? status : "seed";
}

function clampCoordinate(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1400, Math.round(value))) : 0;
}

function readTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
