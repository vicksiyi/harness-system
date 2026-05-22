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

function normalizeTitle(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  return normalized || "Untitled idea";
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function clampCoordinate(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1400, Math.round(value)));
}
