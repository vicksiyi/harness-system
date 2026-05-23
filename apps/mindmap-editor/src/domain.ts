export type IdeaStatus = "seed" | "exploring" | "committed";

export interface MindNode {
  id: string;
  title: string;
  notes: string;
  tags: string[];
  status: IdeaStatus;
  x: number;
  y: number;
  parentId?: string;
  updatedAt: string;
}

export interface MapFilter {
  query?: string;
  tag?: string;
  status?: IdeaStatus | "all";
}

export interface MapSummary {
  total: number;
  roots: number;
  leaves: number;
  tags: string[];
  byStatus: Record<IdeaStatus, number>;
  completion: number;
}

export interface FocusSuggestion {
  nodeId: string;
  title: string;
  reason: string;
  priority: number;
}

export interface OutlineItem {
  id: string;
  title: string;
  depth: number;
  status: IdeaStatus;
}

export interface MindMapSnapshot {
  id: string;
  label: string;
  createdAt: string;
  selectedId: string;
  nodes: MindNode[];
}

export interface MindMapHistoryFrame {
  label: string;
  createdAt: string;
  selectedId: string;
  nodes: MindNode[];
}

export interface MindMapHistory {
  past: MindMapHistoryFrame[];
  future: MindMapHistoryFrame[];
}

export interface ActivityItem {
  nodeId: string;
  title: string;
  status: IdeaStatus;
  updatedAt: string;
  summary: string;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export type ExportFormat = "json" | "markdown";

export interface ExportArtifact {
  content: string;
  fileName: string;
  mimeType: string;
}

export interface MindMapImportPreview {
  total: number;
  roots: number;
  tags: string[];
  selectedTitle: string;
}

export type MindMapImportResult =
  | {
      ok: true;
      nodes: MindNode[];
      selectedId: string;
      preview: MindMapImportPreview;
    }
  | {
      ok: false;
      error: string;
    };

export type CommandCategory = "create" | "navigate" | "preserve" | "view";

export interface CommandDefinition {
  id: string;
  title: string;
  description: string;
  shortcut: string;
  category: CommandCategory;
  keywords: string[];
  disabled?: boolean;
}

export function createNode(input: {
  id: string;
  title: string;
  notes?: string;
  tags?: string[];
  status?: IdeaStatus;
  x?: number;
  y?: number;
  parentId?: string;
  updatedAt?: string;
}): MindNode {
  return {
    id: input.id,
    title: normalizeTitle(input.title),
    notes: input.notes?.trim() ?? "",
    tags: normalizeTags(input.tags ?? []),
    status: input.status ?? "seed",
    x: clampCoordinate(input.x ?? 120),
    y: clampCoordinate(input.y ?? 120),
    parentId: input.parentId,
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function updateNode(node: MindNode, patch: Partial<Omit<MindNode, "id">>): MindNode {
  return {
    ...node,
    ...patch,
    title: patch.title === undefined ? node.title : normalizeTitle(patch.title),
    notes: patch.notes === undefined ? node.notes : patch.notes.trim(),
    tags: patch.tags === undefined ? node.tags : normalizeTags(patch.tags),
    x: patch.x === undefined ? node.x : clampCoordinate(patch.x),
    y: patch.y === undefined ? node.y : clampCoordinate(patch.y),
    updatedAt: patch.updatedAt ?? new Date().toISOString()
  };
}

export function moveNode(nodes: MindNode[], nodeId: string, delta: { x: number; y: number }, at = new Date().toISOString()): MindNode[] {
  return nodes.map((node) =>
    node.id === nodeId
      ? updateNode(node, {
          x: node.x + delta.x,
          y: node.y + delta.y,
          updatedAt: at
        })
      : node
  );
}

export function createChildNode(parent: MindNode, siblingCount: number, id: string, at = new Date().toISOString()): MindNode {
  return createNode({
    id,
    title: "New branch",
    notes: "",
    tags: parent.tags,
    status: "seed",
    parentId: parent.id,
    x: parent.x + 220,
    y: parent.y + siblingCount * 96 - 48,
    updatedAt: at
  });
}

export function filterNodes(nodes: MindNode[], filter: MapFilter): MindNode[] {
  const query = filter.query?.trim().toLowerCase();
  return sortNodes(
    nodes.filter((node) => {
      const matchesQuery = !query || `${node.title} ${node.notes} ${node.tags.join(" ")}`.toLowerCase().includes(query);
      const matchesTag = !filter.tag || filter.tag === "all" || node.tags.includes(filter.tag);
      const matchesStatus = !filter.status || filter.status === "all" || node.status === filter.status;
      return matchesQuery && matchesTag && matchesStatus;
    })
  );
}

export function sortNodes(nodes: MindNode[]): MindNode[] {
  return [...nodes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
}

export function collectTags(nodes: MindNode[]): string[] {
  return [...new Set(nodes.flatMap((node) => node.tags))].sort((a, b) => a.localeCompare(b));
}

export function getChildren(nodes: MindNode[], nodeId: string): MindNode[] {
  return nodes.filter((node) => node.parentId === nodeId).sort((a, b) => a.y - b.y || a.title.localeCompare(b.title));
}

export function getAncestors(nodes: MindNode[], nodeId: string): MindNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ancestors: MindNode[] = [];
  let current = byId.get(nodeId);

  while (current?.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) {
      break;
    }
    ancestors.unshift(parent);
    current = parent;
  }

  return ancestors;
}

export function summarizeMap(nodes: MindNode[]): MapSummary {
  const leaves = nodes.filter((node) => getChildren(nodes, node.id).length === 0).length;
  return {
    total: nodes.length,
    roots: nodes.filter((node) => !node.parentId).length,
    leaves,
    tags: collectTags(nodes),
    byStatus: {
      seed: nodes.filter((node) => node.status === "seed").length,
      exploring: nodes.filter((node) => node.status === "exploring").length,
      committed: nodes.filter((node) => node.status === "committed").length
    },
    completion: completionScore(nodes)
  };
}

export function completionScore(nodes: MindNode[]): number {
  if (nodes.length === 0) {
    return 0;
  }
  const weights: Record<IdeaStatus, number> = {
    seed: 0.2,
    exploring: 0.62,
    committed: 1
  };
  const total = nodes.reduce((sum, node) => sum + weights[node.status], 0);
  return Math.round((total / nodes.length) * 100);
}

export function buildOutline(nodes: MindNode[]): OutlineItem[] {
  const roots = nodes.filter((node) => !node.parentId).sort((a, b) => a.y - b.y || a.title.localeCompare(b.title));
  return roots.flatMap((node) => outlineBranch(nodes, node, 0));
}

export function autoLayoutNodes(nodes: MindNode[], options: { startX?: number; startY?: number; columnGap?: number; rowGap?: number } = {}): MindNode[] {
  const startX = options.startX ?? 80;
  const startY = options.startY ?? 120;
  const columnGap = options.columnGap ?? 220;
  const rowGap = options.rowGap ?? 112;
  const depthById = new Map(buildOutline(nodes).map((item) => [item.id, item.depth]));
  const orderedIds = buildOutline(nodes).map((item) => item.id);
  const orderById = new Map(orderedIds.map((id, index) => [id, index]));

  return nodes.map((node) => ({
    ...node,
    x: startX + (depthById.get(node.id) ?? 0) * columnGap,
    y: startY + (orderById.get(node.id) ?? 0) * rowGap
  }));
}

export function suggestFocusQueue(nodes: MindNode[], limit = 5): FocusSuggestion[] {
  const statusPriority: Record<IdeaStatus, number> = {
    seed: 50,
    exploring: 32,
    committed: 0
  };

  return nodes
    .map((node) => {
      const childCount = getChildren(nodes, node.id).length;
      const noteBonus = node.notes.length < 24 ? 10 : 0;
      const priority = statusPriority[node.status] + childCount * 6 + noteBonus;
      const reason =
        node.status === "seed"
          ? "Needs a first pass"
          : node.status === "exploring"
            ? "Ready to converge"
            : childCount > 0
              ? "Committed hub with active branches"
              : "Reference idea";
      return { nodeId: node.id, title: node.title, reason, priority };
    })
    .filter((item) => item.priority > 0)
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function exportMapAsMarkdown(nodes: MindNode[]): string {
  if (nodes.length === 0) {
    return "# Mind Map Export\n\nNo ideas yet.\n";
  }

  const summary = summarizeMap(nodes);
  const header = [
    "# Mind Map Export",
    "",
    `- Ideas: ${summary.total}`,
    `- Roots: ${summary.roots}`,
    `- Leaves: ${summary.leaves}`,
    `- Completion: ${summary.completion}`,
    ""
  ];

  const outline = buildOutline(nodes).flatMap((item) => [
    `${"  ".repeat(item.depth)}- ${item.title} (${item.status})`,
    ...nodeNotes(nodes, item.id, item.depth + 1)
  ]);

  return [...header, ...outline, ""].join("\n");
}

export function exportMapAsJson(nodes: MindNode[], selectedId: string, exportedAt = new Date().toISOString()): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt,
      selectedId: nodes.some((node) => node.id === selectedId) ? selectedId : nodes[0]?.id ?? "",
      nodes: nodes.map((node) => ({ ...node, tags: [...node.tags] }))
    },
    null,
    2
  );
}

export function createExportArtifact(input: {
  format: ExportFormat;
  nodes: MindNode[];
  selectedId: string;
  title?: string;
  exportedAt?: string;
}): ExportArtifact {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const date = /^\d{4}-\d{2}-\d{2}/.exec(exportedAt)?.[0] ?? "export";
  const baseName = fileNameSlug(input.title ?? "mind-map");

  if (input.format === "markdown") {
    return {
      content: exportMapAsMarkdown(input.nodes),
      fileName: `${baseName}-${date}.md`,
      mimeType: "text/markdown;charset=utf-8"
    };
  }

  return {
    content: exportMapAsJson(input.nodes, input.selectedId, exportedAt),
    fileName: `${baseName}-${date}.json`,
    mimeType: "application/json;charset=utf-8"
  };
}

export function parseMindMapJson(value: string): MindMapImportResult {
  const raw = value.trim();
  if (!raw) {
    return { ok: false, error: "Import JSON is empty." };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidateNodes = Array.isArray(parsed) ? readRecordArray(parsed) : readObjectArray(parsed, "nodes");
    if (candidateNodes.length === 0) {
      return { ok: false, error: "Import JSON must include at least one node." };
    }

    const ids = new Set<string>();
    for (const item of candidateNodes) {
      const id = readString(item, "id");
      if (!id) {
        return { ok: false, error: "Every imported node needs an id." };
      }
      if (ids.has(id)) {
        return { ok: false, error: `Duplicate node id: ${id}.` };
      }
      ids.add(id);
    }

    const nodes = candidateNodes.map((item) =>
      createNode({
        id: readString(item, "id"),
        title: readString(item, "title") || "Untitled idea",
        notes: readString(item, "notes"),
        tags: readStringArray(item, "tags"),
        status: readStatus(item),
        x: readNumber(item, "x"),
        y: readNumber(item, "y"),
        parentId: ids.has(readString(item, "parentId")) ? readString(item, "parentId") : undefined,
        updatedAt: readString(item, "updatedAt") || undefined
      })
    );
    const selectedId = readString(parsed, "selectedId");
    const safeSelectedId = nodes.some((node) => node.id === selectedId) ? selectedId : nodes[0].id;
    const selectedNode = nodes.find((node) => node.id === safeSelectedId) ?? nodes[0];

    return {
      ok: true,
      nodes,
      selectedId: safeSelectedId,
      preview: {
        total: nodes.length,
        roots: nodes.filter((node) => !node.parentId).length,
        tags: collectTags(nodes),
        selectedTitle: selectedNode.title
      }
    };
  } catch {
    return { ok: false, error: "Import JSON could not be parsed." };
  }
}

export function createSnapshot(input: {
  nodes: MindNode[];
  selectedId: string;
  label?: string;
  id?: string;
  createdAt?: string;
}): MindMapSnapshot {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    id: input.id ?? `snapshot-${Date.parse(createdAt) || Date.now()}`,
    label: normalizeTitle(input.label ?? `Snapshot ${createdAt.slice(0, 16).replace("T", " ")}`),
    createdAt,
    selectedId: input.nodes.some((node) => node.id === input.selectedId) ? input.selectedId : input.nodes[0]?.id ?? "",
    nodes: input.nodes.map((node) => ({ ...node, tags: [...node.tags] }))
  };
}

export function restoreSnapshot(snapshot: MindMapSnapshot): { nodes: MindNode[]; selectedId: string } {
  const nodes = snapshot.nodes.map((node) =>
    createNode({
      ...node,
      tags: [...node.tags],
      updatedAt: node.updatedAt
    })
  );
  return {
    nodes,
    selectedId: nodes.some((node) => node.id === snapshot.selectedId) ? snapshot.selectedId : nodes[0]?.id ?? ""
  };
}

export function recentActivity(nodes: MindNode[], limit = 6): ActivityItem[] {
  return sortNodes(nodes)
    .slice(0, limit)
    .map((node) => ({
      nodeId: node.id,
      title: node.title,
      status: node.status,
      updatedAt: node.updatedAt,
      summary: node.notes || `${getChildren(nodes, node.id).length} child ideas`
    }));
}

export function createEmptyHistory(): MindMapHistory {
  return { past: [], future: [] };
}

export function createHistoryFrame(input: {
  nodes: MindNode[];
  selectedId: string;
  label: string;
  createdAt?: string;
}): MindMapHistoryFrame {
  return cloneHistoryFrame({
    label: normalizeTitle(input.label),
    createdAt: input.createdAt ?? new Date().toISOString(),
    selectedId: input.nodes.some((node) => node.id === input.selectedId) ? input.selectedId : input.nodes[0]?.id ?? "",
    nodes: input.nodes
  });
}

export function pushHistory(history: MindMapHistory, frame: MindMapHistoryFrame, limit = 24): MindMapHistory {
  if (history.past[0] && historyFramesEqual(history.past[0], frame)) {
    return {
      past: history.past.map(cloneHistoryFrame),
      future: []
    };
  }

  return {
    past: [cloneHistoryFrame(frame), ...history.past.map(cloneHistoryFrame)].slice(0, limit),
    future: []
  };
}

export function undoHistory(history: MindMapHistory, current: MindMapHistoryFrame, limit = 24): { history: MindMapHistory; frame: MindMapHistoryFrame } | null {
  const [previous, ...past] = history.past;
  if (!previous) {
    return null;
  }

  return {
    frame: cloneHistoryFrame(previous),
    history: {
      past: past.map(cloneHistoryFrame),
      future: [cloneHistoryFrame(current), ...history.future.map(cloneHistoryFrame)].slice(0, limit)
    }
  };
}

export function redoHistory(history: MindMapHistory, current: MindMapHistoryFrame, limit = 24): { history: MindMapHistory; frame: MindMapHistoryFrame } | null {
  const [next, ...future] = history.future;
  if (!next) {
    return null;
  }

  return {
    frame: cloneHistoryFrame(next),
    history: {
      past: [cloneHistoryFrame(current), ...history.past.map(cloneHistoryFrame)].slice(0, limit),
      future: future.map(cloneHistoryFrame)
    }
  };
}

export function createCanvasViewport(input: Partial<CanvasViewport> = {}): CanvasViewport {
  return {
    x: clampViewportOffset(input.x ?? 0),
    y: clampViewportOffset(input.y ?? 0),
    zoom: clampViewportZoom(input.zoom ?? 1)
  };
}

export function panCanvasViewport(viewport: CanvasViewport, delta: { x: number; y: number }): CanvasViewport {
  return createCanvasViewport({
    x: viewport.x + delta.x,
    y: viewport.y + delta.y,
    zoom: viewport.zoom
  });
}

export function zoomCanvasViewport(viewport: CanvasViewport, delta: number): CanvasViewport {
  return createCanvasViewport({
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom + delta
  });
}

export function buildCommandPalette(input: { hasSnapshots: boolean; hasSelection: boolean; canUndo?: boolean; canRedo?: boolean }): CommandDefinition[] {
  return [
    command("add-root", "Add root idea", "Create a new top-level idea", "R", "create", ["new", "root", "idea"]),
    command("add-child", "Add child idea", "Create a child branch under the selected idea", "C", "create", ["new", "child", "branch"], !input.hasSelection),
    command("undo-edit", "Undo map edit", "Roll back the latest map change", "Cmd+Z", "preserve", ["history", "undo", "rollback"], !input.canUndo),
    command("redo-edit", "Redo map edit", "Replay the latest reverted map change", "Shift+Cmd+Z", "preserve", ["history", "redo", "forward"], !input.canRedo),
    command("save-snapshot", "Save snapshot", "Capture the current map state", "S", "preserve", ["checkpoint", "backup", "save"]),
    command(
      "restore-latest",
      "Restore latest snapshot",
      "Roll the map back to the newest saved snapshot",
      "Shift+R",
      "preserve",
      ["checkpoint", "snapshot", "restore"],
      !input.hasSnapshots
    ),
    command("focus-search", "Focus search", "Move cursor to idea search", "/", "navigate", ["find", "filter", "query"]),
    command("auto-layout", "Auto layout map", "Arrange ideas into readable hierarchy lanes", "L", "view", ["layout", "arrange", "map"]),
    command("export-markdown", "Copy markdown export", "Select the generated Markdown outline", "M", "view", ["markdown", "copy", "outline"]),
    command("export-json", "Refresh JSON export", "Regenerate the portable map JSON", "J", "view", ["json", "backup", "portable"]),
    command("focus-import", "Focus JSON import", "Move cursor to the import JSON field", "I", "navigate", ["json", "import", "restore"])
  ];
}

export function filterCommands(commands: CommandDefinition[], query: string): CommandDefinition[] {
  const needle = query.trim().toLowerCase();
  const scored = commands
    .map((item, index) => ({
      item,
      index,
      score: commandScore(item, needle)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.item.disabled) - Number(b.item.disabled) || a.index - b.index);

  return scored.map((entry) => entry.item);
}

function outlineBranch(nodes: MindNode[], node: MindNode, depth: number): OutlineItem[] {
  return [
    { id: node.id, title: node.title, depth, status: node.status },
    ...getChildren(nodes, node.id).flatMap((child) => outlineBranch(nodes, child, depth + 1))
  ];
}

function nodeNotes(nodes: MindNode[], nodeId: string, depth: number): string[] {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node?.notes) {
    return [];
  }
  return [`${"  ".repeat(depth)}Notes: ${node.notes}`];
}

function cloneHistoryFrame(frame: MindMapHistoryFrame): MindMapHistoryFrame {
  return {
    label: frame.label,
    createdAt: frame.createdAt,
    selectedId: frame.selectedId,
    nodes: frame.nodes.map((node) => ({ ...node, tags: [...node.tags] }))
  };
}

function historyFramesEqual(a: MindMapHistoryFrame, b: MindMapHistoryFrame): boolean {
  return (
    a.selectedId === b.selectedId &&
    a.nodes.length === b.nodes.length &&
    a.nodes.every((node, index) => {
      const other = b.nodes[index];
      return (
        Boolean(other) &&
        node.id === other.id &&
        node.title === other.title &&
        node.notes === other.notes &&
        node.status === other.status &&
        node.x === other.x &&
        node.y === other.y &&
        node.parentId === other.parentId &&
        node.updatedAt === other.updatedAt &&
        node.tags.join("\u0000") === other.tags.join("\u0000")
      );
    })
  );
}

function normalizeTitle(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  return normalized || "Untitled idea";
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function fileNameSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "mind-map";
}

function clampCoordinate(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100000, Math.round(value)));
}

function clampViewportOffset(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100000, Math.round(value)));
}

function clampViewportZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0.5, Math.min(1.8, Math.round(value * 100) / 100));
}

function readRecordArray(value: unknown[]): Record<string, unknown>[] {
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
}

function readObjectArray(value: unknown, key: string): Record<string, unknown>[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const item = (value as Record<string, unknown>)[key];
  return Array.isArray(item) ? readRecordArray(item) : [];
}

function readString(value: unknown, key: string): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : "";
}

function readNumber(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "number" ? item : undefined;
}

function readStringArray(value: unknown, key: string): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const item = (value as Record<string, unknown>)[key];
  return Array.isArray(item) ? item.map(String) : [];
}

function readStatus(value: unknown): IdeaStatus {
  const status = readString(value, "status");
  return status === "exploring" || status === "committed" || status === "seed" ? status : "seed";
}

function command(
  id: string,
  title: string,
  description: string,
  shortcut: string,
  category: CommandCategory,
  keywords: string[],
  disabled = false
): CommandDefinition {
  return {
    id,
    title,
    description,
    shortcut,
    category,
    keywords,
    disabled
  };
}

function commandScore(commandDefinition: CommandDefinition, query: string): number {
  if (!query) {
    return commandDefinition.disabled ? 70 : 100;
  }

  const title = commandDefinition.title.toLowerCase();
  if (title === query) {
    return 300;
  }
  if (title.startsWith(query)) {
    return 240;
  }
  if (title.includes(query)) {
    return 200;
  }

  const haystack = [
    commandDefinition.description,
    commandDefinition.shortcut,
    commandDefinition.category,
    ...commandDefinition.keywords
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query) ? 120 : 0;
}
