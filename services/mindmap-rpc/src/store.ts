import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createId,
  type MindMapFileDocument,
  type MindMapFileSummary,
  type MindMapNodeSearchInput,
  type MindMapNodeSearchResult,
  type MindMapOperationInput,
  type MindMapOperationRecord,
  type MindMapSaveInput,
  type MindMapSyncInput,
  type MindMapSyncResult,
  type StoredMindNode
} from "@harness/shared";

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

interface NodeSearchRow {
  map_id: string;
  map_title: string;
  map_version: number;
  node_id: string;
  node_title: string;
  notes: string;
  tags_json: string;
  status: StoredMindNode["status"];
  updated_at: string;
}

interface OperationRow {
  id: string;
  map_id: string;
  version: number;
  client_id: string;
  type: MindMapOperationRecord["type"];
  payload_json: string;
  created_at: string;
}

export function defaultMindMapDatabasePath(root = process.env.HARNESS_ROOT ?? process.cwd()): string {
  const workspaceRoot = findWorkspaceRoot(root);
  if (process.env.MINDMAP_DB_PATH) {
    return isAbsolute(process.env.MINDMAP_DB_PATH) ? process.env.MINDMAP_DB_PATH : join(workspaceRoot, process.env.MINDMAP_DB_PATH);
  }
  return join(workspaceRoot, ".harness", "mindmap", "mindmaps.sqlite");
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

  searchNodes(input: MindMapNodeSearchInput): MindMapNodeSearchResult[] {
    const query = input.query.trim().toLowerCase();
    if (!query) {
      return [];
    }
    const limit = Math.max(1, Math.min(50, Math.round(input.limit ?? 12)));
    const status = input.status === "seed" || input.status === "exploring" || input.status === "committed" ? input.status : "all";
    const pattern = `%${escapeLike(query)}%`;
    const prefixPattern = `${escapeLike(query)}%`;
    const rows = this.db
      .prepare(
        `SELECT maps.id AS map_id,
                maps.title AS map_title,
                maps.version AS map_version,
                nodes.id AS node_id,
                nodes.title AS node_title,
                nodes.notes,
                nodes.tags_json,
                nodes.status,
                nodes.updated_at
           FROM nodes
           JOIN maps ON maps.id = nodes.map_id
          WHERE (
                lower(nodes.title) LIKE ? ESCAPE '\\'
             OR lower(nodes.notes) LIKE ? ESCAPE '\\'
             OR lower(nodes.tags_json) LIKE ? ESCAPE '\\'
             OR lower(maps.title) LIKE ? ESCAPE '\\'
          )
            AND (? = 'all' OR nodes.status = ?)
          ORDER BY
            CASE
              WHEN lower(nodes.title) = ? THEN 0
              WHEN lower(nodes.title) LIKE ? ESCAPE '\\' THEN 1
              WHEN lower(maps.title) LIKE ? ESCAPE '\\' THEN 2
              ELSE 3
            END,
            maps.updated_at DESC,
            nodes.updated_at DESC,
            nodes.title ASC
          LIMIT ?`
      )
      .all(pattern, pattern, pattern, pattern, status, status, query, prefixPattern, prefixPattern, limit) as unknown as NodeSearchRow[];

    return rows.map((row) => ({
      mapId: row.map_id,
      mapTitle: row.map_title,
      mapVersion: row.map_version,
      nodeId: row.node_id,
      nodeTitle: row.node_title,
      status: normalizeStatus(row.status),
      tags: readTags(row.tags_json),
      notesSnippet: createSnippet(row.notes, query),
      updatedAt: row.updated_at
    }));
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

  syncMap(input: MindMapSyncInput): MindMapSyncResult {
    const mapId = syncMapId(input);
    const existing = this.getMap(mapId);
    if (!existing) {
      throw new Error(`Mind map file not found: ${mapId}`);
    }
    if (input.sinceVersion > existing.version) {
      throw new Error(`Mind map version conflict: server is ${existing.version}, client is ${input.sinceVersion}`);
    }

    if (input.operations.length === 0) {
      return {
        mapId,
        document: existing,
        operations: this.listOperationsSince(mapId, input.sinceVersion)
      };
    }

    let version = existing.version;
    const at = new Date().toISOString();
    this.transaction(() => {
      for (const operation of input.operations) {
        version += 1;
        this.applyOperation(mapId, operation, at);
        this.recordOperation(mapId, version, input.clientId, operation, at);
      }
      const selectedId = this.safeSelectedIdFromDatabase(mapId, this.currentSelectedId(mapId));
      this.db.prepare("UPDATE maps SET selected_id = ?, version = ?, updated_at = ? WHERE id = ?").run(selectedId, version, at, mapId);
    });

    const document = this.getMap(mapId);
    if (!document) {
      throw new Error(`Synced map ${mapId} could not be read.`);
    }
    return {
      mapId,
      document,
      operations: this.listOperationsSince(mapId, input.sinceVersion)
    };
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

      CREATE TABLE IF NOT EXISTS operations (
        map_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (map_id, version),
        FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS nodes_map_parent_idx ON nodes(map_id, parent_id);
      CREATE INDEX IF NOT EXISTS maps_updated_idx ON maps(updated_at DESC);
      CREATE INDEX IF NOT EXISTS operations_map_version_idx ON operations(map_id, version);
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

  private applyOperation(mapId: string, operation: MindMapOperationInput, at: string): void {
    switch (operation.type) {
      case "upsert-node": {
        const node = normalizeNodes([operation.node], at)[0];
        const parentId = operation.node.parentId && this.nodeExists(mapId, operation.node.parentId) ? operation.node.parentId : undefined;
        this.db
          .prepare(
            `INSERT INTO nodes (map_id, id, title, notes, tags_json, status, x, y, parent_id, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(map_id, id) DO UPDATE SET
               title = excluded.title,
               notes = excluded.notes,
               tags_json = excluded.tags_json,
               status = excluded.status,
               x = excluded.x,
               y = excluded.y,
               parent_id = excluded.parent_id,
               updated_at = excluded.updated_at`
          )
          .run(mapId, node.id, node.title, node.notes, JSON.stringify(node.tags), node.status, node.x, node.y, parentId ?? null, node.updatedAt);
        break;
      }
      case "delete-node":
        this.db.prepare("UPDATE nodes SET parent_id = NULL WHERE map_id = ? AND parent_id = ?").run(mapId, operation.nodeId);
        this.db.prepare("DELETE FROM nodes WHERE map_id = ? AND id = ?").run(mapId, operation.nodeId);
        break;
      case "select-node":
        this.db.prepare("UPDATE maps SET selected_id = ? WHERE id = ?").run(operation.selectedId, mapId);
        break;
      case "rename-map":
        this.db.prepare("UPDATE maps SET title = ? WHERE id = ?").run(normalizeTitle(operation.title), mapId);
        break;
      default:
        break;
    }
  }

  private recordOperation(mapId: string, version: number, clientId: string, operation: MindMapOperationInput, at: string): void {
    this.db
      .prepare("INSERT INTO operations (map_id, version, id, client_id, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(mapId, version, createId("op"), clientId || "anonymous-client", operation.type, JSON.stringify(operation), at);
  }

  private listOperationsSince(mapId: string, sinceVersion: number): MindMapOperationRecord[] {
    const rows = this.db
      .prepare("SELECT id, map_id, version, client_id, type, payload_json, created_at FROM operations WHERE map_id = ? AND version > ? ORDER BY version ASC")
      .all(mapId, sinceVersion) as unknown as OperationRow[];

    return rows.map((row) => ({
      id: row.id,
      mapId: row.map_id,
      version: row.version,
      clientId: row.client_id,
      type: row.type,
      payload: readOperationPayload(row.payload_json),
      createdAt: row.created_at
    }));
  }

  private safeSelectedIdFromDatabase(mapId: string, selectedId: string): string {
    const row = this.db.prepare("SELECT id FROM nodes WHERE map_id = ? AND id = ?").get(mapId, selectedId) as { id: string } | undefined;
    if (row) {
      return selectedId;
    }
    const fallback = this.db.prepare("SELECT id FROM nodes WHERE map_id = ? ORDER BY y ASC, title ASC LIMIT 1").get(mapId) as { id: string } | undefined;
    return fallback?.id ?? "";
  }

  private nodeExists(mapId: string, nodeId: string): boolean {
    const row = this.db.prepare("SELECT id FROM nodes WHERE map_id = ? AND id = ?").get(mapId, nodeId) as { id: string } | undefined;
    return Boolean(row);
  }

  private currentSelectedId(mapId: string): string {
    const row = this.db.prepare("SELECT selected_id FROM maps WHERE id = ?").get(mapId) as { selected_id: string } | undefined;
    return row?.selected_id ?? "";
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
  return Number.isFinite(value) ? Math.max(0, Math.min(100000, Math.round(value))) : 0;
}

function readTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function readOperationPayload(value: string): MindMapOperationInput {
  try {
    const parsed = JSON.parse(value) as MindMapOperationInput;
    if (parsed.type === "upsert-node" || parsed.type === "delete-node" || parsed.type === "select-node" || parsed.type === "rename-map") {
      return parsed;
    }
  } catch {
    // Fall through to a harmless operation shape for corrupted historical rows.
  }
  return { type: "rename-map", title: "Unknown operation" };
}

function syncMapId(input: MindMapSyncInput): string {
  return input.mapId ?? input.id ?? "";
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function createSnippet(notes: string, query: string): string {
  const normalized = notes.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  const lower = normalized.toLowerCase();
  const index = lower.indexOf(query);
  const start = index > 24 ? index - 24 : 0;
  const snippet = normalized.slice(start, start + 96);
  return `${start > 0 ? "... " : ""}${snippet}${start + 96 < normalized.length ? " ..." : ""}`;
}

function findWorkspaceRoot(start: string): string {
  let current = start;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return start;
}
