/// <reference types="vite/client" />

import "./style.css";
import {
  buildOutline,
  collectTags,
  createChildNode,
  createNode,
  createSnapshot,
  exportMapAsMarkdown,
  filterNodes,
  getAncestors,
  getChildren,
  recentActivity,
  restoreSnapshot,
  suggestFocusQueue,
  summarizeMap,
  updateNode,
  type IdeaStatus,
  type MindMapSnapshot,
  type MindNode
} from "./domain.js";

interface EditorState {
  nodes: MindNode[];
  selectedId: string;
  query: string;
  tag: string;
  status: IdeaStatus | "all";
  snapshots: MindMapSnapshot[];
}

const storageKeys = {
  map: "mindmap-studio-state-v1",
  snapshots: "mindmap-studio-snapshots-v1"
};

const state: EditorState = initialState();

function seedNodes(): MindNode[] {
  return [
    createNode({
      id: "idea-launch",
      title: "Launch plan",
      notes: "Coordinate positioning, channels, and launch sequencing.",
      tags: ["launch", "strategy"],
      status: "exploring",
      x: 80,
      y: 150,
      updatedAt: "2026-05-23T02:00:00.000Z"
    }),
    createNode({
      id: "idea-research",
      title: "Research signals",
      notes: "Summarize interviews, competitor notes, and audience questions.",
      tags: ["research"],
      status: "committed",
      parentId: "idea-launch",
      x: 350,
      y: 70,
      updatedAt: "2026-05-23T01:00:00.000Z"
    }),
    createNode({
      id: "idea-narrative",
      title: "Narrative options",
      notes: "Draft three possible story arcs.",
      tags: ["writing", "launch"],
      status: "seed",
      parentId: "idea-launch",
      x: 350,
      y: 240,
      updatedAt: "2026-05-23T00:30:00.000Z"
    })
  ];
}

function initialState(): EditorState {
  const saved = loadSavedMap();
  return {
    nodes: saved?.nodes ?? seedNodes(),
    selectedId: saved?.selectedId ?? "idea-launch",
    query: "",
    tag: "all",
    status: "all",
    snapshots: loadSnapshots()
  };
}

function selectedNode(): MindNode {
  return state.nodes.find((node) => node.id === state.selectedId) ?? state.nodes[0];
}

function commit(nodes: MindNode[], selectedId = state.selectedId): void {
  state.nodes = nodes;
  state.selectedId = nodes.some((node) => node.id === selectedId) ? selectedId : nodes[0]?.id ?? "";
  persistMap();
  render();
}

function addRootIdea(): void {
  const id = `idea-${Date.now().toString(36)}`;
  const node = createNode({
    id,
    title: "Untitled idea",
    x: 100,
    y: 420,
    tags: ["new"]
  });
  commit([node, ...state.nodes], id);
}

function addChildIdea(): void {
  const parent = selectedNode();
  const id = `idea-${Date.now().toString(36)}`;
  const child = createChildNode(parent, getChildren(state.nodes, parent.id).length + 1, id);
  commit([child, ...state.nodes], id);
}

function patchSelected(patch: Partial<Omit<MindNode, "id">>): void {
  commit(state.nodes.map((node) => (node.id === state.selectedId ? updateNode(node, patch) : node)));
}

function setSelected(id: string): void {
  state.selectedId = id;
  persistMap();
  render();
}

function saveSnapshot(): void {
  const snapshot = createSnapshot({
    nodes: state.nodes,
    selectedId: state.selectedId,
    label: `Checkpoint ${state.snapshots.length + 1}`
  });
  state.snapshots = [snapshot, ...state.snapshots].slice(0, 6);
  persistSnapshots();
  render();
}

function restoreSnapshotById(id: string): void {
  const snapshot = state.snapshots.find((item) => item.id === id);
  if (!snapshot) {
    return;
  }
  const restored = restoreSnapshot(snapshot);
  commit(restored.nodes, restored.selectedId);
}

function resetMap(): void {
  commit(seedNodes(), "idea-launch");
}

function loadSavedMap(): Pick<EditorState, "nodes" | "selectedId"> | null {
  const raw = readStorage(storageKeys.map);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { nodes?: MindNode[]; selectedId?: string };
    const nodes = normalizeStoredNodes(parsed.nodes);
    if (nodes.length === 0) {
      return null;
    }
    return {
      nodes,
      selectedId: typeof parsed.selectedId === "string" && nodes.some((node) => node.id === parsed.selectedId) ? parsed.selectedId : nodes[0].id
    };
  } catch {
    return null;
  }
}

function loadSnapshots(): MindMapSnapshot[] {
  const raw = readStorage(storageKeys.snapshots);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as MindMapSnapshot[];
    return Array.isArray(parsed)
      ? parsed
          .map((snapshot) =>
            createSnapshot({
              id: snapshot.id,
              label: snapshot.label,
              createdAt: snapshot.createdAt,
              selectedId: snapshot.selectedId,
              nodes: normalizeStoredNodes(snapshot.nodes)
            })
          )
          .filter((snapshot) => snapshot.nodes.length > 0)
          .slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

function normalizeStoredNodes(value: unknown): MindNode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is MindNode => Boolean(item && typeof item === "object" && "id" in item && "title" in item))
    .map((node) =>
      createNode({
        id: String(node.id),
        title: String(node.title),
        notes: typeof node.notes === "string" ? node.notes : "",
        tags: Array.isArray(node.tags) ? node.tags.map(String) : [],
        status: node.status === "exploring" || node.status === "committed" || node.status === "seed" ? node.status : "seed",
        x: Number(node.x),
        y: Number(node.y),
        parentId: typeof node.parentId === "string" ? node.parentId : undefined,
        updatedAt: typeof node.updatedAt === "string" ? node.updatedAt : undefined
      })
    );
}

function persistMap(): void {
  writeStorage(
    storageKeys.map,
    JSON.stringify({
      nodes: state.nodes,
      selectedId: state.selectedId
    })
  );
}

function persistSnapshots(): void {
  writeStorage(storageKeys.snapshots, JSON.stringify(state.snapshots));
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in private windows; the editor still works in memory.
  }
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render(): void {
  const app = byId<HTMLElement>("app");
  const node = selectedNode();
  const visible = filterNodes(state.nodes, {
    query: state.query,
    tag: state.tag,
    status: state.status
  });
  const tags = collectTags(state.nodes);
  const summary = summarizeMap(state.nodes);
  const outline = buildOutline(state.nodes);
  const focusQueue = suggestFocusQueue(state.nodes);
  const activity = recentActivity(state.nodes);
  const ancestors = getAncestors(state.nodes, node.id);
  const children = getChildren(state.nodes, node.id);
  const markdown = exportMapAsMarkdown(state.nodes);
  const latestSnapshot = state.snapshots[0];

  app.innerHTML = `
    <section class="studio">
      <header class="topbar">
        <div>
          <p class="eyebrow">Thinking workspace</p>
          <h1>Mind Map Studio</h1>
        </div>
        <div class="actions">
          <button id="add-root" aria-label="Add root idea">Root</button>
          <button id="add-child" aria-label="Add child idea">Child</button>
          <button id="save-snapshot" aria-label="Save snapshot">Save</button>
          <button id="reset-map" aria-label="Reset map">Reset</button>
        </div>
      </header>

      <section class="workspace">
        <aside class="navigator">
          <div class="filters">
            <input id="query" aria-label="Search ideas" value="${escapeHtml(state.query)}" placeholder="Search ideas" />
            <select id="tag-filter" aria-label="Filter by tag">
              <option value="all">All tags</option>
              ${tags.map((tag) => `<option value="${tag}" ${state.tag === tag ? "selected" : ""}>${tag}</option>`).join("")}
            </select>
            <select id="status-filter" aria-label="Filter by status">
              ${["all", "seed", "exploring", "committed"]
                .map((status) => `<option value="${status}" ${state.status === status ? "selected" : ""}>${status}</option>`)
                .join("")}
            </select>
          </div>

          <div class="summary-grid" aria-label="Map summary">
            <div><span>Ideas</span><strong>${summary.total}</strong></div>
            <div><span>Roots</span><strong>${summary.roots}</strong></div>
            <div><span>Leaves</span><strong>${summary.leaves}</strong></div>
            <div><span>Done</span><strong>${summary.completion}</strong></div>
          </div>

          <section class="activity-panel">
            <div class="section-head">
              <h2>Recent Activity</h2>
              <span>${activity.length}</span>
            </div>
            <ol class="activity-list">
              ${activity
                .map(
                  (item) => `
                    <li>
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${item.status} · ${new Date(item.updatedAt).toLocaleString()}</span>
                    </li>
                  `
                )
                .join("")}
            </ol>
          </section>

          <div class="node-list">
            ${
              visible.length
                ? visible
                    .map(
                      (item) => `
                        <button class="node-row ${item.id === state.selectedId ? "selected" : ""}" data-node-id="${item.id}">
                          <span>${escapeHtml(item.title)}</span>
                          <small>${item.status} · ${item.tags.join(", ") || "untagged"}</small>
                        </button>
                      `
                    )
                    .join("")
                : `<p class="empty">No matching ideas.</p>`
            }
          </div>
        </aside>

        <main class="canvas-panel">
          <div class="section-head">
            <h2>Map Canvas</h2>
            <span>${outline.length} visible branches</span>
          </div>
          <div class="canvas-grid" aria-label="Idea map canvas">
            ${state.nodes
              .map((item) => {
                const parent = item.parentId ? state.nodes.find((candidate) => candidate.id === item.parentId) : undefined;
                const connector = parent
                  ? `<span class="connector" style="left:${Math.min(parent.x, item.x) + 142}px;top:${Math.min(parent.y, item.y) + 38}px;width:${Math.abs(item.x - parent.x) + 28}px"></span>`
                  : "";
                return `
                  ${connector}
                  <button class="map-node ${item.status} ${item.id === state.selectedId ? "selected" : ""}" style="left:${item.x}px;top:${item.y}px" data-node-id="${item.id}">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${item.status}</span>
                  </button>
                `;
              })
              .join("")}
          </div>

          <section class="outline-panel">
            <div class="section-head">
              <h2>Outline</h2>
              <span>${summary.tags.length} tags</span>
            </div>
            <ol class="outline-list">
              ${outline
                .map(
                  (item) => `
                    <li style="--depth:${item.depth}">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${item.status}</span>
                    </li>
                  `
                )
                .join("")}
            </ol>
          </section>
        </main>

        <aside class="inspector">
          <div class="section-head">
            <h2>Inspector</h2>
            <span>${children.length} children</span>
          </div>

          <label>
            Idea title
            <input id="title-input" aria-label="Idea title" value="${escapeHtml(node.title)}" />
          </label>

          <label>
            Idea notes
            <textarea id="notes-input" aria-label="Idea notes" rows="7">${escapeHtml(node.notes)}</textarea>
          </label>

          <div class="field-grid">
            <label>
              Tags
              <input id="tags-input" aria-label="Tags" value="${escapeHtml(node.tags.join(", "))}" />
            </label>
            <label>
              Status
              <select id="status-input" aria-label="Status">
                ${["seed", "exploring", "committed"]
                  .map((status) => `<option value="${status}" ${node.status === status ? "selected" : ""}>${status}</option>`)
                  .join("")}
              </select>
            </label>
          </div>

          <section class="context-panel">
            <h2>Branch Context</h2>
            <p>${ancestors.map((item) => escapeHtml(item.title)).join(" / ") || "Root idea"}</p>
            <div class="pill-row">${children.map((child) => `<span>${escapeHtml(child.title)}</span>`).join("") || "<span>No children yet</span>"}</div>
          </section>

          <section class="context-panel">
            <div class="section-head">
              <h2>Snapshots</h2>
              <span>${state.snapshots.length}</span>
            </div>
            ${
              latestSnapshot
                ? `<button id="restore-latest" class="wide-button" aria-label="Restore latest snapshot">Restore ${escapeHtml(latestSnapshot.label)}</button>`
                : `<p>No snapshots saved.</p>`
            }
            <div class="snapshot-list">
              ${state.snapshots
                .map(
                  (snapshot) => `
                    <button class="snapshot-row" data-snapshot-id="${snapshot.id}">
                      <strong>${escapeHtml(snapshot.label)}</strong>
                      <span>${new Date(snapshot.createdAt).toLocaleString()} · ${snapshot.nodes.length} ideas</span>
                    </button>
                  `
                )
                .join("")}
            </div>
          </section>

          <section class="context-panel">
            <div class="section-head">
              <h2>Focus Queue</h2>
              <span>${focusQueue.length}</span>
            </div>
            <ol class="focus-list">
              ${focusQueue
                .map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${item.reason} · ${item.priority}</span></li>`)
                .join("")}
            </ol>
          </section>

          <section class="context-panel">
            <div class="section-head">
              <h2>Markdown Export</h2>
              <span>${state.nodes.length} ideas</span>
            </div>
            <textarea aria-label="Markdown export preview" readonly rows="9">${escapeHtml(markdown)}</textarea>
          </section>
        </aside>
      </section>
    </section>
  `;

  byId<HTMLButtonElement>("add-root").addEventListener("click", addRootIdea);
  byId<HTMLButtonElement>("add-child").addEventListener("click", addChildIdea);
  byId<HTMLButtonElement>("save-snapshot").addEventListener("click", saveSnapshot);
  byId<HTMLButtonElement>("reset-map").addEventListener("click", resetMap);
  document.getElementById("restore-latest")?.addEventListener("click", () => {
    if (state.snapshots[0]) {
      restoreSnapshotById(state.snapshots[0].id);
    }
  });
  byId<HTMLInputElement>("query").addEventListener("input", (event) => {
    state.query = (event.target as HTMLInputElement).value;
    render();
  });
  byId<HTMLSelectElement>("tag-filter").addEventListener("change", (event) => {
    state.tag = (event.target as HTMLSelectElement).value;
    render();
  });
  byId<HTMLSelectElement>("status-filter").addEventListener("change", (event) => {
    state.status = (event.target as HTMLSelectElement).value as IdeaStatus | "all";
    render();
  });
  byId<HTMLInputElement>("title-input").addEventListener("input", (event) => {
    patchSelected({ title: (event.target as HTMLInputElement).value });
  });
  byId<HTMLTextAreaElement>("notes-input").addEventListener("input", (event) => {
    patchSelected({ notes: (event.target as HTMLTextAreaElement).value });
  });
  byId<HTMLInputElement>("tags-input").addEventListener("input", (event) => {
    patchSelected({ tags: (event.target as HTMLInputElement).value.split(",") });
  });
  byId<HTMLSelectElement>("status-input").addEventListener("change", (event) => {
    patchSelected({ status: (event.target as HTMLSelectElement).value as IdeaStatus });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-node-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.nodeId) {
        setSelected(button.dataset.nodeId);
      }
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-snapshot-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.snapshotId) {
        restoreSnapshotById(button.dataset.snapshotId);
      }
    });
  });
}

render();
