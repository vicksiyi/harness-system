import type {
  MindMapFileDocument,
  MindMapFileSummary,
  MindMapNodeSearchInput,
  MindMapNodeSearchResult,
  MindMapSaveInput,
  MindMapSyncEvent,
  MindMapSyncInput,
  MindMapSyncResult,
  RpcResponse
} from "@harness/shared";

const rpcBaseUrl = import.meta.env.VITE_MINDMAP_RPC_URL ?? "http://localhost:4105";

export async function mindMapRpc<TResult>(method: string, params?: unknown, timeoutMs = 5000): Promise<TResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${rpcBaseUrl.replace(/\/$/, "")}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: `web_${Date.now().toString(36)}`,
        method,
        params
      }),
      signal: controller.signal
    });
    const body = (await response.json()) as RpcResponse<TResult>;
    if (!response.ok || body.error) {
      throw new Error(body.error?.message ?? `Mind map sync request ${method} failed.`);
    }
    return body.result as TResult;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function listRemoteMaps(): Promise<MindMapFileSummary[]> {
  return mindMapRpc<MindMapFileSummary[]>("listMaps");
}

export function getRemoteMap(id: string): Promise<MindMapFileDocument | null> {
  return mindMapRpc<MindMapFileDocument | null>("getMap", { id });
}

export function searchRemoteNodes(input: MindMapNodeSearchInput): Promise<MindMapNodeSearchResult[]> {
  return mindMapRpc<MindMapNodeSearchResult[]>("searchNodes", input);
}

export function createRemoteMap(input: Omit<MindMapSaveInput, "id" | "baseVersion">): Promise<MindMapFileDocument> {
  return mindMapRpc<MindMapFileDocument>("createMap", input);
}

export function saveRemoteMap(input: MindMapSaveInput): Promise<MindMapFileDocument> {
  return mindMapRpc<MindMapFileDocument>("saveMap", input);
}

export function syncRemoteMap(input: MindMapSyncInput): Promise<MindMapSyncResult> {
  return mindMapRpc<MindMapSyncResult>("syncMap", input);
}

export function subscribeRemoteSyncEvents(input: {
  clientId: string;
  onEvent: (event: MindMapSyncEvent) => void;
  onStatus?: (status: "connecting" | "live" | "retrying" | "unsupported") => void;
}): () => void {
  if (typeof window.EventSource !== "function") {
    input.onStatus?.("unsupported");
    return () => {};
  }

  const url = new URL(`${rpcBaseUrl.replace(/\/$/, "")}/events`);
  url.searchParams.set("clientId", input.clientId);
  input.onStatus?.("connecting");

  const source = new EventSource(url);
  source.addEventListener("open", () => input.onStatus?.("live"));
  source.addEventListener("error", () => input.onStatus?.("retrying"));
  source.addEventListener("mindmap-sync", (event) => {
    try {
      input.onEvent(JSON.parse((event as MessageEvent<string>).data) as MindMapSyncEvent);
    } catch {
      input.onStatus?.("retrying");
    }
  });

  return () => source.close();
}
