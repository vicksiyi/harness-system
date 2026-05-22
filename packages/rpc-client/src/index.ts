import type { RpcRequest, RpcResponse, ServiceHealth } from "@harness/shared";
import { createId } from "@harness/shared";

export class RpcClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "RpcClientError";
  }
}

export async function rpcCall<TParams, TResult>(
  baseUrl: string,
  method: string,
  params?: TParams,
  timeoutMs = 8000
): Promise<TResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const request: RpcRequest<TParams> = {
    id: createId("rpc"),
    method,
    params
  };

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    const body = (await response.json()) as RpcResponse<TResult>;
    if (!response.ok || body.error) {
      throw new RpcClientError(
        body.error?.message ?? `RPC ${method} failed with ${response.status}`,
        body.error?.code ?? "http_error",
        body.error?.data
      );
    }
    return body.result as TResult;
  } finally {
    clearTimeout(timeout);
  }
}

export async function healthCheck(baseUrl: string, timeoutMs = 3000): Promise<ServiceHealth> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      signal: controller.signal
    });
    if (!response.ok) {
      return {
        service: baseUrl,
        status: "down",
        at: new Date().toISOString(),
        details: { statusCode: response.status }
      };
    }
    return (await response.json()) as ServiceHealth;
  } catch (error) {
    return {
      service: baseUrl,
      status: "down",
      at: new Date().toISOString(),
      details: { error: error instanceof Error ? error.message : "Unknown health error" }
    };
  } finally {
    clearTimeout(timeout);
  }
}

