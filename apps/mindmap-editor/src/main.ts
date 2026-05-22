/// <reference types="vite/client" />

import "./style.css";
import {
  buildOutline,
  autoLayoutNodes,
  buildCommandPalette,
  collectTags,
  createChildNode,
  createEmptyHistory,
  createHistoryFrame,
  createNode,
  createSnapshot,
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
  suggestFocusQueue,
  summarizeMap,
  undoHistory,
  updateNode,
  type IdeaStatus,
  type CommandDefinition,
  type MindMapHistory,
  type MindMapImportResult,
  type MindMapSnapshot,
  type MindNode
} from "./domain.js";
import { createRemoteMap, getRemoteMap, listRemoteMaps, saveRemoteMap, syncRemoteMap } from "./rpc.js";
import type { MindMapFileDocument, MindMapFileSummary, MindMapOperationInput, StoredMindNode } from "@harness/shared";

interface EditorState {
  nodes: MindNode[];
  selectedId: string;
  query: string;
  tag: string;
  status: IdeaStatus | "all";
  snapshots: MindMapSnapshot[];
  commandPaletteOpen: boolean;
  commandQuery: string;
  importJson: string;
  importResult: MindMapImportResult | null;
  history: MindMapHistory;
  mapId: string | null;
  mapTitle: string;
  mapVersion: number;
  mapFiles: MindMapFileSummary[];
  clientId: string;
  pendingOperations: MindMapOperationInput[];
  rpcStatus: "checking" | "online" | "saving" | "saved" | "offline" | "error";
  rpcMessage: string;
}

const storageKeys = {
  map: "mindmap-studio-state-v1",
  snapshots: "mindmap-studio-snapshots-v1",
  clientId: "mindmap-studio-client-id-v1"
};

const state: EditorState = initialState();
let remoteSaveTimer: number | null = null;
let applyingRemoteMap = false;
let dragState:
  | {
      nodeId: string;
      pointerId: number;
      originPointerX: number;
      originPointerY: number;
      originNodeX: number;
      originNodeY: number;
      originNodes: MindNode[];
      hasMoved: boolean;
    }
  | null = null;

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
    snapshots: loadSnapshots(),
    commandPaletteOpen: false,
    commandQuery: "",
    importJson: "",
    importResult: null,
    history: createEmptyHistory(),
    mapId: saved?.mapId ?? null,
    mapTitle: saved?.mapTitle ?? "Launch workspace",
    mapVersion: saved?.mapVersion ?? 0,
    mapFiles: [],
    clientId: loadClientId(),
    pendingOperations: [],
    rpcStatus: "checking",
    rpcMessage: "Connecting to sync service"
  };
}

function selectedNode(): MindNode {
  return state.nodes.find((node) => node.id === state.selectedId) ?? state.nodes[0];
}

function commit(
  nodes: MindNode[],
  selectedId = state.selectedId,
  label = "Edit map",
  operations: MindMapOperationInput[] = [{ type: "select-node", selectedId }, ...upsertOperations(nodes)]
): void {
  rememberHistory(label);
  state.nodes = nodes;
  state.selectedId = nodes.some((node) => node.id === selectedId) ? selectedId : nodes[0]?.id ?? "";
  queueOperations(operations);
  persistMap();
  scheduleRemoteSave();
  render();
}

function rememberHistory(label: string, nodes = state.nodes, selectedId = state.selectedId): void {
  state.history = pushHistory(
    state.history,
    createHistoryFrame({
      nodes,
      selectedId,
      label
    })
  );
}

function editLabel(patch: Partial<Omit<MindNode, "id">>): string {
  if (patch.title !== undefined) {
    return "Edit title";
  }
  if (patch.notes !== undefined) {
    return "Edit notes";
  }
  if (patch.tags !== undefined) {
    return "Edit tags";
  }
  if (patch.status !== undefined) {
    return "Edit status";
  }
  return "Edit idea";
}

function applyHistoryFrame(frame: { nodes: MindNode[]; selectedId: string }): void {
  state.nodes = frame.nodes;
  state.selectedId = state.nodes.some((node) => node.id === frame.selectedId) ? frame.selectedId : state.nodes[0]?.id ?? "";
  persistMap();
  render();
}

function undoMapEdit(): void {
  const result = undoHistory(
    state.history,
    createHistoryFrame({
      nodes: state.nodes,
      selectedId: state.selectedId,
      label: "Before undo"
    })
  );
  if (!result) {
    return;
  }
  state.history = result.history;
  applyHistoryFrame(result.frame);
}

function redoMapEdit(): void {
  const result = redoHistory(
    state.history,
    createHistoryFrame({
      nodes: state.nodes,
      selectedId: state.selectedId,
      label: "Before redo"
    })
  );
  if (!result) {
    return;
  }
  state.history = result.history;
  applyHistoryFrame(result.frame);
}

function scheduleRemoteSave(): void {
  if (applyingRemoteMap || !state.mapId || state.pendingOperations.length === 0) {
    return;
  }
  if (remoteSaveTimer !== null) {
    window.clearTimeout(remoteSaveTimer);
  }
  remoteSaveTimer = window.setTimeout(() => {
    void syncCurrentRemoteDiff();
  }, 350);
}

function queueOperations(operations: MindMapOperationInput[]): void {
  if (operations.length === 0) {
    return;
  }
  const nextOperations = [...state.pendingOperations];
  for (const operation of operations) {
    const previous = nextOperations.at(-1);
    if (operation.type === "rename-map" && previous?.type === "rename-map") {
      nextOperations[nextOperations.length - 1] = operation;
    } else {
      nextOperations.push(operation);
    }
  }
  state.pendingOperations = nextOperations.slice(-80);
}

async function initializeRemoteLibrary(): Promise<void> {
  try {
    state.rpcStatus = "checking";
    state.rpcMessage = "Connecting to sync service";
    render();
    const files = await listRemoteMaps();
    state.mapFiles = files;
    if (state.mapId && files.some((file) => file.id === state.mapId)) {
      await openRemoteMap(state.mapId);
      return;
    }
    if (files.length > 0) {
      await openRemoteMap(files[0].id);
      return;
    }
    const created = await createRemoteMap(remoteInput());
    applyRemoteMap(created, "Created first database file");
  } catch (error) {
    state.rpcStatus = "offline";
    state.rpcMessage = error instanceof Error ? error.message : "Sync service is offline";
    render();
  }
}

async function createMapFile(): Promise<void> {
  try {
    const nodes = seedNodes();
    state.rpcStatus = "saving";
    state.rpcMessage = "Creating database file";
    render();
    const created = await createRemoteMap({
      selectedId: nodes[0]?.id ?? "",
      nodes: storedNodesFrom(nodes),
      title: nextMapTitle()
    });
    applyRemoteMap(created, "Created new database file");
  } catch (error) {
    state.rpcStatus = "error";
    state.rpcMessage = error instanceof Error ? error.message : "Could not create map file";
    render();
  }
}

async function syncCurrentRemoteDiff(successMessage?: string): Promise<void> {
  if (!state.mapId || state.pendingOperations.length === 0) {
    return;
  }
  const operations = state.pendingOperations;
  state.pendingOperations = [];
  try {
    state.rpcStatus = "saving";
    state.rpcMessage = `Syncing ${operations.length} changes`;
    render();
    const result = await syncRemoteMap({
      id: state.mapId,
      clientId: state.clientId,
      sinceVersion: state.mapVersion,
      operations
    });
    if (result.operations.some((operation) => operation.clientId !== state.clientId)) {
      applyRemoteMap(result.document, `Merged ${result.operations.length} remote operations`, true);
    } else {
      applyRemoteMetadata(result.document, successMessage ?? `Saved ${operations.length} changes`, true);
    }
  } catch (error) {
    state.pendingOperations = [...operations, ...state.pendingOperations].slice(-80);
    state.rpcStatus = "error";
    state.rpcMessage = error instanceof Error ? error.message : "Could not sync map diff";
    render();
  }
}

async function pullRemoteChanges(): Promise<void> {
  if (!state.mapId) {
    return;
  }
  try {
    state.rpcStatus = "checking";
    state.rpcMessage = "Pulling remote diff operations";
    render();
    const result = await syncRemoteMap({
      id: state.mapId,
      clientId: state.clientId,
      sinceVersion: state.mapVersion,
      operations: []
    });
    applyRemoteMap(result.document, result.operations.length ? `Pulled ${result.operations.length} remote operations` : "No remote changes");
  } catch (error) {
    state.rpcStatus = "error";
    state.rpcMessage = error instanceof Error ? error.message : "Could not pull remote changes";
    render();
  }
}

async function openRemoteMap(id: string): Promise<void> {
  try {
    state.rpcStatus = "checking";
    state.rpcMessage = "Opening database file";
    render();
    const document = await getRemoteMap(id);
    if (!document) {
      throw new Error("Mind map file was not found.");
    }
    applyRemoteMap(document, `Opened ${document.title}`);
  } catch (error) {
    state.rpcStatus = "error";
    state.rpcMessage = error instanceof Error ? error.message : "Could not open map file";
    render();
  }
}

async function saveCurrentRemoteMap(): Promise<void> {
  if (!state.mapId) {
    return;
  }
  const titleInput = document.getElementById("map-title-input");
  if (titleInput instanceof HTMLInputElement) {
    updateMapTitle(titleInput.value);
  }
  if (remoteSaveTimer !== null) {
    window.clearTimeout(remoteSaveTimer);
    remoteSaveTimer = null;
  }
  if (state.pendingOperations.length > 0) {
    await syncCurrentRemoteDiff("Saved file to database");
    return;
  }
  try {
    state.rpcStatus = "saving";
    state.rpcMessage = "Saving file";
    render();
    const saved = await saveRemoteMap({
      ...remoteInput(),
      id: state.mapId
    });
    applyRemoteMetadata(saved, "Saved file to database");
  } catch (error) {
    state.rpcStatus = "error";
    state.rpcMessage = error instanceof Error ? error.message : "Could not save map file";
    render();
  }
}

function applyRemoteMap(document: MindMapFileDocument, message: string, preservePending = false): void {
  const pendingOperations = preservePending ? state.pendingOperations : [];
  applyingRemoteMap = true;
  state.mapId = document.id;
  state.mapTitle = document.title;
  state.mapVersion = document.version;
  state.nodes = normalizeStoredNodes(document.nodes);
  state.selectedId = state.nodes.some((node) => node.id === document.selectedId) ? document.selectedId : state.nodes[0]?.id ?? "";
  state.history = createEmptyHistory();
  state.pendingOperations = pendingOperations;
  state.rpcStatus = "saved";
  state.rpcMessage = message;
  state.mapFiles = [summaryFromDocument(document), ...state.mapFiles.filter((file) => file.id !== document.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  persistMap();
  render();
  applyingRemoteMap = false;
}

function applyRemoteMetadata(document: MindMapFileDocument, message: string, preservePending = false): void {
  const pendingOperations = preservePending ? state.pendingOperations : [];
  state.mapId = document.id;
  state.mapTitle = document.title;
  state.mapVersion = document.version;
  state.pendingOperations = pendingOperations;
  state.rpcStatus = "saved";
  state.rpcMessage = message;
  state.mapFiles = [summaryFromDocument(document), ...state.mapFiles.filter((file) => file.id !== document.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  persistMap();
  render();
}

function remoteInput(): { title: string; selectedId: string; nodes: StoredMindNode[] } {
  return {
    title: state.mapTitle,
    selectedId: state.selectedId,
    nodes: storedNodesFrom(state.nodes)
  };
}

function storedNodesFrom(nodes: MindNode[]): StoredMindNode[] {
  return nodes.map((node) => ({ ...node, tags: [...node.tags] }));
}

function updateMapTitle(value: string): void {
  const nextTitle = normalizeMapTitle(value);
  if (nextTitle === state.mapTitle) {
    return;
  }
  state.mapTitle = nextTitle;
  queueOperations([{ type: "rename-map", title: state.mapTitle }]);
  persistMap();
  scheduleRemoteSave();
  refreshCollaborationControls();
}

function refreshCollaborationControls(): void {
  const status = document.querySelector(".collaboration-panel .remote-status");
  if (status) {
    status.textContent = `Client ${state.clientId.slice(-7)} · ${state.pendingOperations.length} pending ops`;
  }
  const pushButton = document.getElementById("push-diff");
  if (pushButton instanceof HTMLButtonElement) {
    pushButton.disabled = !(state.mapId && state.pendingOperations.length);
  }
}

function upsertOperations(nodes: MindNode[]): MindMapOperationInput[] {
  return nodes.map((node) => ({ type: "upsert-node", node: toStoredNode(node) }));
}

function upsertNodeOperation(node: MindNode): MindMapOperationInput {
  return { type: "upsert-node", node: toStoredNode(node) };
}

function toStoredNode(node: MindNode): StoredMindNode {
  return { ...node, tags: [...node.tags] };
}

function summaryFromDocument(document: MindMapFileDocument): MindMapFileSummary {
  const { nodes: _nodes, ...summary } = document;
  return summary;
}

function nextMapTitle(): string {
  return `Mind map ${state.mapFiles.length + 1}`;
}

function normalizeMapTitle(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || "Untitled map";
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
  commit([node, ...state.nodes], id, "Add root idea", [{ type: "select-node", selectedId: id }, upsertNodeOperation(node)]);
}

function addChildIdea(): void {
  const parent = selectedNode();
  const id = `idea-${Date.now().toString(36)}`;
  const child = createChildNode(parent, getChildren(state.nodes, parent.id).length + 1, id);
  commit([child, ...state.nodes], id, "Add child idea", [{ type: "select-node", selectedId: id }, upsertNodeOperation(child)]);
}

function patchSelected(patch: Partial<Omit<MindNode, "id">>): void {
  const nodes = state.nodes.map((node) => (node.id === state.selectedId ? updateNode(node, patch) : node));
  const updated = nodes.find((node) => node.id === state.selectedId);
  commit(nodes, state.selectedId, editLabel(patch), updated ? [upsertNodeOperation(updated)] : []);
}

function setSelected(id: string): void {
  state.selectedId = id;
  queueOperations([{ type: "select-node", selectedId: id }]);
  persistMap();
  scheduleRemoteSave();
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
  commit(restored.nodes, restored.selectedId, `Restore ${snapshot.label}`);
}

function resetMap(): void {
  commit(seedNodes(), "idea-launch", "Reset map");
}

function autoLayoutMap(): void {
  commit(autoLayoutNodes(state.nodes), state.selectedId, "Auto layout map");
}

function previewImport(value = state.importJson): void {
  state.importJson = value;
  state.importResult = parseMindMapJson(value);
  render();
}

function applyImport(): void {
  const result = state.importResult;
  if (!result?.ok) {
    return;
  }
  state.importJson = "";
  state.importResult = null;
  state.snapshots = [
    createSnapshot({
      nodes: state.nodes,
      selectedId: state.selectedId,
      label: "Before import"
    }),
    ...state.snapshots
  ].slice(0, 6);
  persistSnapshots();
  commit(result.nodes, result.selectedId, "Apply JSON import");
}

function openCommandPalette(query = ""): void {
  state.commandPaletteOpen = true;
  state.commandQuery = query;
  render();
}

function closeCommandPalette(): void {
  state.commandPaletteOpen = false;
  state.commandQuery = "";
  render();
}

function runCommand(commandId: string): void {
  const command = commandCatalog().find((item) => item.id === commandId);
  if (command?.disabled) {
    return;
  }

  switch (commandId) {
    case "add-root":
      addRootIdea();
      break;
    case "add-child":
      addChildIdea();
      break;
    case "undo-edit":
      undoMapEdit();
      break;
    case "redo-edit":
      redoMapEdit();
      break;
    case "save-snapshot":
      saveSnapshot();
      break;
    case "restore-latest":
      if (state.snapshots[0]) {
        restoreSnapshotById(state.snapshots[0].id);
      }
      break;
    case "focus-search":
      state.commandPaletteOpen = false;
      state.commandQuery = "";
      render();
      byId<HTMLInputElement>("query").focus();
      break;
    case "auto-layout":
      autoLayoutMap();
      break;
    case "export-markdown": {
      state.commandPaletteOpen = false;
      state.commandQuery = "";
      render();
      const exportPreview = byId<HTMLTextAreaElement>("markdown-export");
      exportPreview.focus();
      exportPreview.select();
      break;
    }
    case "export-json": {
      state.commandPaletteOpen = false;
      state.commandQuery = "";
      render();
      const jsonExport = byId<HTMLTextAreaElement>("json-export");
      jsonExport.focus();
      jsonExport.select();
      break;
    }
    case "focus-import":
      state.commandPaletteOpen = false;
      state.commandQuery = "";
      render();
      byId<HTMLTextAreaElement>("json-import").focus();
      break;
    default:
      break;
  }
}

function commandCatalog(): CommandDefinition[] {
  return buildCommandPalette({
    hasSnapshots: state.snapshots.length > 0,
    hasSelection: state.nodes.some((node) => node.id === state.selectedId),
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0
  });
}

function loadSavedMap(): Pick<EditorState, "nodes" | "selectedId" | "mapId" | "mapTitle" | "mapVersion"> | null {
  const raw = readStorage(storageKeys.map);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { nodes?: MindNode[]; selectedId?: string; mapId?: string | null; mapTitle?: string; mapVersion?: number };
    const nodes = normalizeStoredNodes(parsed.nodes);
    if (nodes.length === 0) {
      return null;
    }
    return {
      nodes,
      selectedId: typeof parsed.selectedId === "string" && nodes.some((node) => node.id === parsed.selectedId) ? parsed.selectedId : nodes[0].id,
      mapId: typeof parsed.mapId === "string" ? parsed.mapId : null,
      mapTitle: typeof parsed.mapTitle === "string" ? parsed.mapTitle : "Launch workspace",
      mapVersion: typeof parsed.mapVersion === "number" ? parsed.mapVersion : 0
    };
  } catch {
    return null;
  }
}

function loadClientId(): string {
  const saved = readStorage(storageKeys.clientId);
  if (saved) {
    return saved;
  }
  const id = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  writeStorage(storageKeys.clientId, id);
  return id;
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
      selectedId: state.selectedId,
      mapId: state.mapId,
      mapTitle: state.mapTitle,
      mapVersion: state.mapVersion
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

function importPreviewMarkup(): string {
  const result = state.importResult;
  if (!state.importJson.trim()) {
    return `<p class="import-muted">Paste exported JSON to preview it before replacing the current map.</p>`;
  }
  if (!result) {
    return `<p class="import-muted">Import preview is waiting for JSON.</p>`;
  }
  if (!result.ok) {
    return `<p class="import-error">${escapeHtml(result.error)}</p>`;
  }
  return `
    <div class="import-preview">
      <strong>${result.preview.total} ideas · ${result.preview.roots} roots</strong>
      <span>Selected: ${escapeHtml(result.preview.selectedTitle)}</span>
      <span>Tags: ${result.preview.tags.join(", ") || "none"}</span>
    </div>
  `;
}

function drawConnectors(): void {
  const canvas = document.getElementById("connector-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#94a9c2";
  context.lineWidth = 2;
  context.lineCap = "round";

  state.nodes.forEach((child) => {
    const parent = child.parentId ? state.nodes.find((item) => item.id === child.parentId) : undefined;
    if (!parent) {
      return;
    }
    const parentIsLeft = parent.x <= child.x;
    context.beginPath();
    context.moveTo(parentIsLeft ? parent.x + 170 : parent.x, parent.y + 37);
    context.lineTo(parentIsLeft ? child.x : child.x + 170, child.y + 37);
    context.stroke();
  });
}

function beginNodeDrag(event: PointerEvent, nodeId: string): void {
  if (window.matchMedia("(max-width: 760px)").matches) {
    return;
  }
  const node = state.nodes.find((item) => item.id === nodeId);
  const target = event.currentTarget;
  if (!node || !(target instanceof HTMLElement)) {
    return;
  }

  event.preventDefault();
  target.setPointerCapture(event.pointerId);
  target.classList.add("dragging");
  state.selectedId = nodeId;
  dragState = {
    nodeId,
    pointerId: event.pointerId,
    originPointerX: event.clientX,
    originPointerY: event.clientY,
    originNodeX: node.x,
    originNodeY: node.y,
    originNodes: state.nodes.map((item) => ({ ...item, tags: [...item.tags] })),
    hasMoved: false
  };
}

function moveDraggedNode(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  const delta = {
    x: event.clientX - dragState.originPointerX,
    y: event.clientY - dragState.originPointerY
  };
  if (Math.abs(delta.x) > 1 || Math.abs(delta.y) > 1) {
    dragState.hasMoved = true;
  }
  const moved = moveNode(
    state.nodes.map((node) =>
      node.id === dragState?.nodeId
        ? {
            ...node,
            x: dragState.originNodeX,
            y: dragState.originNodeY
          }
        : node
    ),
    dragState.nodeId,
    delta
  );
  state.nodes = moved;
  const movedNode = moved.find((node) => node.id === dragState?.nodeId);
  const element = document.querySelector<HTMLElement>(`.map-node[data-node-id="${dragState.nodeId}"]`);
  if (movedNode && element) {
    element.style.left = `${movedNode.x}px`;
    element.style.top = `${movedNode.y}px`;
  }
  drawConnectors();
}

function endNodeDrag(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  const element = document.querySelector<HTMLElement>(`.map-node[data-node-id="${dragState.nodeId}"]`);
  element?.classList.remove("dragging");
  if (dragState.hasMoved) {
    rememberHistory("Drag node", dragState.originNodes, dragState.nodeId);
    const movedNode = state.nodes.find((node) => node.id === dragState?.nodeId);
    if (movedNode) {
      queueOperations([upsertNodeOperation(movedNode)]);
    }
  }
  dragState = null;
  persistMap();
  scheduleRemoteSave();
  render();
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
  const jsonExport = exportMapAsJson(state.nodes, state.selectedId);
  const latestSnapshot = state.snapshots[0];
  const commands = filterCommands(commandCatalog(), state.commandQuery);
  const canvasWidth = Math.max(1040, ...state.nodes.map((item) => item.x + 230));
  const canvasHeight = Math.max(520, ...state.nodes.map((item) => item.y + 120));
  const rpcLabel = state.rpcStatus === "saved" || state.rpcStatus === "online" ? "Sync online" : state.rpcStatus === "offline" ? "Sync offline" : state.rpcStatus;

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
          <button id="undo-edit" aria-label="Undo map edit" ${state.history.past.length ? "" : "disabled"}>Undo</button>
          <button id="redo-edit" aria-label="Redo map edit" ${state.history.future.length ? "" : "disabled"}>Redo</button>
          <button id="save-snapshot" aria-label="Save snapshot">Save</button>
          <button id="auto-layout" aria-label="Auto layout map">Layout</button>
          <button id="open-commands" aria-label="Open command palette">Commands</button>
          <button id="reset-map" aria-label="Reset map">Reset</button>
        </div>
      </header>

      ${
        state.commandPaletteOpen
          ? `<div class="command-backdrop">
              <section class="command-panel" role="dialog" aria-modal="true" aria-label="Command palette">
                <div class="command-search">
                  <span>Command Palette</span>
                  <input id="command-query" aria-label="Search commands" value="${escapeHtml(state.commandQuery)}" placeholder="Type a command or shortcut" />
                </div>
                <div class="command-list">
                  ${
                    commands.length
                      ? commands
                          .map(
                            (command) => `
                              <button class="command-row" data-command-id="${command.id}" ${command.disabled ? "disabled" : ""}>
                                <span>
                                  <strong>${escapeHtml(command.title)}</strong>
                                  <small>${escapeHtml(command.description)}</small>
                                </span>
                                <kbd>${escapeHtml(command.shortcut)}</kbd>
                              </button>
                            `
                          )
                          .join("")
                      : `<p class="empty">No commands found.</p>`
                  }
                </div>
              </section>
            </div>`
          : ""
      }

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

          <section class="file-panel" aria-label="Map files">
            <div class="section-head">
              <h2>Map Files</h2>
              <span>${escapeHtml(rpcLabel)}</span>
            </div>
            <label>
              File title
              <input id="map-title-input" aria-label="Map file title" value="${escapeHtml(state.mapTitle)}" />
            </label>
            <div class="file-actions">
              <button id="create-map-file" aria-label="Create map file">New file</button>
              <button id="save-map-file" aria-label="Save map file" ${state.mapId ? "" : "disabled"}>Save file</button>
            </div>
            <p class="remote-status ${state.rpcStatus}">${escapeHtml(state.rpcMessage)}</p>
            <div class="file-list">
              ${
                state.mapFiles.length
                  ? state.mapFiles
                      .map(
                        (file) => `
                          <button class="file-row ${file.id === state.mapId ? "selected" : ""}" data-map-file-id="${file.id}">
                            <strong>${escapeHtml(file.title)}</strong>
                            <span>${file.nodeCount} ideas · v${file.version}</span>
                          </button>
                        `
                      )
                      .join("")
                  : `<p class="empty">No database files loaded.</p>`
              }
            </div>
          </section>

          <section class="file-panel collaboration-panel" aria-label="Collaboration sync">
            <div class="section-head">
              <h2>Collaboration</h2>
              <span>v${state.mapVersion}</span>
            </div>
            <p class="remote-status saved">Client ${escapeHtml(state.clientId.slice(-7))} · ${state.pendingOperations.length} pending ops</p>
            <div class="file-actions">
              <button id="push-diff" aria-label="Push diff operations" ${state.mapId && state.pendingOperations.length ? "" : "disabled"}>Push diff</button>
              <button id="pull-diff" aria-label="Pull diff operations" ${state.mapId ? "" : "disabled"}>Pull diff</button>
            </div>
          </section>

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
          <div class="canvas-grid" aria-label="Idea map canvas" style="--canvas-width:${canvasWidth}px;--canvas-height:${canvasHeight}px">
            <canvas id="connector-canvas" class="connector-layer" aria-hidden="true" width="${canvasWidth}" height="${canvasHeight}" data-connector-count="${state.nodes.filter((item) => item.parentId && state.nodes.some((parent) => parent.id === item.parentId)).length}"></canvas>
            ${state.nodes
              .map(
                (item) => `
                  <button class="map-node ${item.status} ${item.id === state.selectedId ? "selected" : ""}" style="left:${item.x}px;top:${item.y}px" data-node-id="${item.id}" data-parent-id="${item.parentId ?? ""}">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${item.status}</span>
                  </button>
                `
              )
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

          <section class="context-panel history-panel" aria-label="Edit history">
            <div class="section-head">
              <h2>Edit History</h2>
              <span>${state.history.past.length}/${state.history.future.length}</span>
            </div>
            <p>${state.history.past[0] ? `Undo: ${escapeHtml(state.history.past[0].label)}` : "No undo steps yet."}</p>
            <p>${state.history.future[0] ? `Redo: ${escapeHtml(state.history.future[0].label)}` : "No redo steps queued."}</p>
            <div class="history-actions">
              <button id="history-undo" aria-label="Undo latest map edit" ${state.history.past.length ? "" : "disabled"}>Undo</button>
              <button id="history-redo" aria-label="Redo latest map edit" ${state.history.future.length ? "" : "disabled"}>Redo</button>
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
            <textarea id="markdown-export" aria-label="Markdown export preview" readonly rows="9">${escapeHtml(markdown)}</textarea>
          </section>

          <section class="context-panel">
            <div class="section-head">
              <h2>JSON Transfer</h2>
              <span>${state.importResult?.ok ? "ready" : "local"}</span>
            </div>
            <label>
              Export JSON
              <textarea id="json-export" aria-label="JSON export preview" readonly rows="7">${escapeHtml(jsonExport)}</textarea>
            </label>
            <label>
              Import JSON
              <textarea id="json-import" aria-label="JSON import input" rows="6" placeholder="Paste a Mind Map Studio JSON export">${escapeHtml(state.importJson)}</textarea>
            </label>
            ${importPreviewMarkup()}
            <div class="transfer-actions">
              <button id="preview-import" aria-label="Preview JSON import">Preview</button>
              <button id="apply-import" aria-label="Apply JSON import" ${state.importResult?.ok ? "" : "disabled"}>Apply</button>
            </div>
          </section>
        </aside>
      </section>
    </section>
  `;

  drawConnectors();
  byId<HTMLButtonElement>("add-root").addEventListener("click", addRootIdea);
  byId<HTMLButtonElement>("add-child").addEventListener("click", addChildIdea);
  byId<HTMLButtonElement>("undo-edit").addEventListener("click", undoMapEdit);
  byId<HTMLButtonElement>("redo-edit").addEventListener("click", redoMapEdit);
  byId<HTMLButtonElement>("save-snapshot").addEventListener("click", saveSnapshot);
  byId<HTMLButtonElement>("auto-layout").addEventListener("click", autoLayoutMap);
  byId<HTMLButtonElement>("open-commands").addEventListener("click", () => openCommandPalette());
  byId<HTMLButtonElement>("reset-map").addEventListener("click", resetMap);
  byId<HTMLButtonElement>("history-undo").addEventListener("click", undoMapEdit);
  byId<HTMLButtonElement>("history-redo").addEventListener("click", redoMapEdit);
  byId<HTMLButtonElement>("create-map-file").addEventListener("click", () => {
    void createMapFile();
  });
  byId<HTMLButtonElement>("save-map-file").addEventListener("click", () => {
    void saveCurrentRemoteMap();
  });
  byId<HTMLButtonElement>("push-diff").addEventListener("click", () => {
    void syncCurrentRemoteDiff();
  });
  byId<HTMLButtonElement>("pull-diff").addEventListener("click", () => {
    void pullRemoteChanges();
  });
  byId<HTMLInputElement>("map-title-input").addEventListener("change", (event) => {
    updateMapTitle((event.target as HTMLInputElement).value);
  });
  byId<HTMLInputElement>("map-title-input").addEventListener("input", (event) => {
    updateMapTitle((event.target as HTMLInputElement).value);
  });
  byId<HTMLButtonElement>("preview-import").addEventListener("click", () => previewImport());
  byId<HTMLButtonElement>("apply-import").addEventListener("click", applyImport);
  byId<HTMLTextAreaElement>("json-import").addEventListener("input", (event) => {
    state.importJson = (event.target as HTMLTextAreaElement).value;
    state.importResult = parseMindMapJson(state.importJson);
    render();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-command-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.commandId) {
        runCommand(button.dataset.commandId);
      }
    });
  });
  document.getElementById("command-query")?.addEventListener("input", (event) => {
    state.commandQuery = (event.target as HTMLInputElement).value;
    render();
  });
  document.getElementById("restore-latest")?.addEventListener("click", () => {
    if (state.snapshots[0]) {
      restoreSnapshotById(state.snapshots[0].id);
    }
  });
  document.querySelectorAll<HTMLButtonElement>("[data-map-file-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mapFileId) {
        void openRemoteMap(button.dataset.mapFileId);
      }
    });
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
    button.addEventListener("pointerdown", (event) => {
      if (button.dataset.nodeId) {
        beginNodeDrag(event, button.dataset.nodeId);
      }
    });
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
  if (state.commandPaletteOpen) {
    byId<HTMLInputElement>("command-query").focus();
  }
}

document.addEventListener("pointermove", moveDraggedNode);
document.addEventListener("pointerup", endNodeDrag);
document.addEventListener("pointercancel", endNodeDrag);

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const commandModifier = event.metaKey || event.ctrlKey;

  if (commandModifier && key === "k") {
    event.preventDefault();
    openCommandPalette();
    return;
  }

  if (state.commandPaletteOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette();
      return;
    }
    if (event.key === "Enter") {
      const firstEnabled = filterCommands(commandCatalog(), state.commandQuery).find((command) => !command.disabled);
      if (firstEnabled) {
        event.preventDefault();
        runCommand(firstEnabled.id);
      }
      return;
    }
  }

  if (commandModifier && key === "s") {
    event.preventDefault();
    saveSnapshot();
    return;
  }

  if (isTypingTarget(event.target)) {
    return;
  }

  if (commandModifier && key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redoMapEdit();
    } else {
      undoMapEdit();
    }
    return;
  }

  if (commandModifier && key === "y") {
    event.preventDefault();
    redoMapEdit();
    return;
  }

  if (key === "/") {
    event.preventDefault();
    runCommand("focus-search");
    return;
  }

  if (event.shiftKey && key === "r") {
    event.preventDefault();
    runCommand("restore-latest");
    return;
  }

  if (key === "r") {
    event.preventDefault();
    addRootIdea();
    return;
  }

  if (key === "c") {
    event.preventDefault();
    addChildIdea();
    return;
  }

  if (key === "l") {
    event.preventDefault();
    autoLayoutMap();
  }
});

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || element.isContentEditable;
}

render();
void initializeRemoteLibrary();
