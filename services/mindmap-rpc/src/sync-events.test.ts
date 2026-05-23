import { describe, expect, it } from "vitest";
import type { MindMapSyncEvent } from "@harness/shared";
import { MindMapSyncBroadcaster, type SyncEventStream } from "./sync-events.js";

class MemoryEventStream implements SyncEventStream {
  readonly chunks: string[] = [];
  ended = false;

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  end(): void {
    this.ended = true;
  }

  text(): string {
    return this.chunks.join("");
  }
}

function eventPayload(stream: MemoryEventStream, eventName: string): unknown {
  const lines = stream.text().split("\n");
  const eventIndex = lines.findIndex((line) => line === `event: ${eventName}`);
  const dataLine = eventIndex >= 0 ? lines.slice(eventIndex + 1).find((line) => line.startsWith("data: ")) : undefined;
  return dataLine ? JSON.parse(dataLine.slice("data: ".length)) : undefined;
}

describe("MindMapSyncBroadcaster", () => {
  it("streams a ready event and broadcasts diff sync events to every subscriber", () => {
    const broadcaster = new MindMapSyncBroadcaster();
    const clientA = new MemoryEventStream();
    const clientB = new MemoryEventStream();

    broadcaster.subscribe("client-a", clientA);
    broadcaster.subscribe("client-b", clientB);

    expect(broadcaster.activeSubscriberCount()).toBe(2);
    expect(eventPayload(clientA, "ready")).toMatchObject({ clientId: "client-a" });
    expect(eventPayload(clientB, "ready")).toMatchObject({ clientId: "client-b" });

    const event: MindMapSyncEvent = {
      type: "mindmap-sync",
      mapId: "map-1",
      version: 4,
      sourceClientId: "client-a",
      operations: [
        {
          id: "op-1",
          mapId: "map-1",
          version: 4,
          clientId: "client-a",
          type: "rename-map",
          payload: { type: "rename-map", title: "Broadcasted title" },
          createdAt: "2026-05-23T08:30:00.000Z"
        }
      ],
      at: "2026-05-23T08:30:00.000Z"
    };

    broadcaster.broadcast(event);

    expect(eventPayload(clientA, "mindmap-sync")).toMatchObject(event);
    expect(eventPayload(clientB, "mindmap-sync")).toMatchObject(event);
  });

  it("removes subscribers when their unsubscribe callback runs", () => {
    const broadcaster = new MindMapSyncBroadcaster();
    const stream = new MemoryEventStream();
    const unsubscribe = broadcaster.subscribe("client-a", stream);

    unsubscribe();

    expect(stream.ended).toBe(true);
    expect(broadcaster.activeSubscriberCount()).toBe(0);
  });
});
