import { asRecord, createRpcServer, servicePort, type MindMapSaveInput, type ServiceHealth, type StoredMindNode } from "@harness/shared";
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
    id: typeof record.id === "string" ? record.id : "",
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

createRpcServer({
  serviceName: "mindmap-rpc",
  port: servicePort("mindmap"),
  methods: {
    listMaps,
    getMap,
    createMap,
    saveMap,
    deleteMap
  },
  health: (): ServiceHealth => ({
    service: "mindmap-rpc",
    status: "ok",
    at: new Date().toISOString(),
    details: {
      databasePath,
      mapCount: store.listMaps().length,
      methods: ["listMaps", "getMap", "createMap", "saveMap", "deleteMap"]
    }
  })
});

process.on("SIGTERM", () => {
  store.close();
  process.exit(0);
});
