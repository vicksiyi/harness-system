import {
  asRecord,
  createRpcServer,
  servicePort,
  type MindMapNodeSearchInput,
  type MindMapOperationInput,
  type MindMapSaveInput,
  type ServiceHealth,
  type StoredMindNode
} from "@harness/shared";
import { defaultMindMapDatabasePath, MindMapStore } from "./store.js";

const databasePath = defaultMindMapDatabasePath();
const store = new MindMapStore(databasePath);

function listMaps() {
  return store.listMaps();
}

function getMap(params: unknown) {
  const record = asRecord(params);
  const id = typeof record.id === "string" ? record.id : "";
  return id ? store.getMap(id) : null;
}

function searchNodes(params: unknown) {
  const record = asRecord(params);
  const input: MindMapNodeSearchInput = {
    query: typeof record.query === "string" ? record.query : "",
    status:
      record.status === "seed" || record.status === "exploring" || record.status === "committed" || record.status === "all" ? record.status : undefined,
    limit: typeof record.limit === "number" ? record.limit : undefined
  };
  return store.searchNodes(input);
}

function createMap(params: unknown) {
  const record = asRecord(params);
  return store.createMap({
    title: typeof record.title === "string" ? record.title : "Untitled map",
    selectedId: typeof record.selectedId === "string" ? record.selectedId : "",
    nodes: Array.isArray(record.nodes) ? (record.nodes as StoredMindNode[]) : []
  });
}

function saveMap(params: unknown) {
  const record = asRecord(params);
  const input: MindMapSaveInput = {
    id: typeof record.id === "string" ? record.id : typeof record.mapId === "string" ? record.mapId : "",
    title: typeof record.title === "string" ? record.title : "Untitled map",
    selectedId: typeof record.selectedId === "string" ? record.selectedId : "",
    nodes: Array.isArray(record.nodes) ? (record.nodes as StoredMindNode[]) : [],
    baseVersion: typeof record.baseVersion === "number" ? record.baseVersion : undefined
  };
  return store.saveMap(input);
}

function deleteMap(params: unknown) {
  const record = asRecord(params);
  const id = typeof record.id === "string" ? record.id : "";
  return { deleted: id ? store.deleteMap(id) : false };
}

function syncMap(params: unknown) {
  const record = asRecord(params);
  return store.syncMap({
    id: typeof record.id === "string" ? record.id : undefined,
    mapId: typeof record.mapId === "string" ? record.mapId : undefined,
    clientId: typeof record.clientId === "string" ? record.clientId : "anonymous-client",
    sinceVersion: typeof record.sinceVersion === "number" ? record.sinceVersion : 0,
    operations: Array.isArray(record.operations) ? (record.operations as MindMapOperationInput[]) : []
  });
}

createRpcServer({
  serviceName: "mindmap-rpc",
  port: servicePort("mindmap"),
  methods: {
    listMaps,
    getMap,
    searchNodes,
    createMap,
    saveMap,
    deleteMap,
    syncMap
  },
  health: (): ServiceHealth => ({
    service: "mindmap-rpc",
    status: "ok",
    at: new Date().toISOString(),
    details: {
      databasePath,
      mapCount: store.listMaps().length,
      methods: ["listMaps", "getMap", "searchNodes", "createMap", "saveMap", "deleteMap", "syncMap"]
    }
  })
});

process.on("SIGTERM", () => {
  store.close();
  process.exit(0);
});
