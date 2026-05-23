import type { IncomingMessage, ServerResponse } from "node:http";
import { createId, nowIso, type MindMapSyncEvent } from "@harness/shared";

export interface SyncEventStream {
  write(chunk: string): boolean;
  end(): void;
}

interface Subscriber {
  id: string;
  clientId: string;
  stream: SyncEventStream;
  endOnUnsubscribe: boolean;
}

export class MindMapSyncBroadcaster {
  private readonly subscribers = new Map<string, Subscriber>();

  subscribe(clientId: string, stream: SyncEventStream, options: { endOnUnsubscribe?: boolean } = {}): () => void {
    const subscriber: Subscriber = {
      id: createId("sub"),
      clientId: normalizeClientId(clientId),
      stream,
      endOnUnsubscribe: options.endOnUnsubscribe ?? true
    };

    this.subscribers.set(subscriber.id, subscriber);
    writeEvent(stream, "ready", { clientId: subscriber.clientId, at: nowIso() });

    let closed = false;
    return () => {
      if (closed) {
        return;
      }
      closed = true;
      this.subscribers.delete(subscriber.id);
      if (subscriber.endOnUnsubscribe) {
        subscriber.stream.end();
      }
    };
  }

  broadcast(event: MindMapSyncEvent): void {
    for (const subscriber of Array.from(this.subscribers.values())) {
      try {
        writeEvent(subscriber.stream, "mindmap-sync", event);
      } catch {
        this.subscribers.delete(subscriber.id);
        if (subscriber.endOnUnsubscribe) {
          subscriber.stream.end();
        }
      }
    }
  }

  activeSubscriberCount(): number {
    return this.subscribers.size;
  }

  handleRequest(request: IncomingMessage, response: ServerResponse): boolean {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (request.method !== "GET" || url.pathname !== "/events") {
      return false;
    }

    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });
    response.write(": connected\n\n");

    const unsubscribe = this.subscribe(url.searchParams.get("clientId") ?? "", response, { endOnUnsubscribe: false });
    request.on("close", unsubscribe);
    return true;
  }
}

function writeEvent(stream: SyncEventStream, eventName: string, payload: unknown): void {
  stream.write(`event: ${eventName}\n`);
  stream.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function normalizeClientId(value: string): string {
  const normalized = value.trim();
  return normalized || "anonymous-client";
}
