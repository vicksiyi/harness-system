import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createRpcServer, type ServiceHealth } from "./index.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
});

function baseUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return `http://127.0.0.1:${address.port}`;
}

describe("createRpcServer", () => {
  it("serves health responses", async () => {
    const server = createRpcServer({
      serviceName: "test-rpc",
      port: 0,
      methods: {},
      health: (): ServiceHealth => ({
        service: "test-rpc",
        status: "ok",
        at: new Date().toISOString()
      })
    });
    servers.push(server);

    const response = await fetch(`${baseUrl(server)}/health`);
    const body = (await response.json()) as ServiceHealth;

    expect(response.ok).toBe(true);
    expect(body.service).toBe("test-rpc");
  });

  it("dispatches rpc methods", async () => {
    const server = createRpcServer({
      serviceName: "test-rpc",
      port: 0,
      methods: {
        echo: (params) => params
      }
    });
    servers.push(server);

    const response = await fetch(`${baseUrl(server)}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "1", method: "echo", params: { ok: true } })
    });
    const body = await response.json();

    expect(body.result).toEqual({ ok: true });
  });

  it("returns method_not_found for unknown methods", async () => {
    const server = createRpcServer({
      serviceName: "test-rpc",
      port: 0,
      methods: {}
    });
    servers.push(server);

    const response = await fetch(`${baseUrl(server)}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "1", method: "missing" })
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("method_not_found");
  });
});

