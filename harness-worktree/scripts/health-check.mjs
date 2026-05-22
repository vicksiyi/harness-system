#!/usr/bin/env node
const services = [
  ["orchestrator-rpc", process.env.ORCHESTRATOR_RPC_URL ?? "http://localhost:4100"],
  ["requirements-rpc", process.env.REQUIREMENTS_RPC_URL ?? "http://localhost:4101"],
  ["coding-rpc", process.env.CODING_RPC_URL ?? "http://localhost:4102"],
  ["testing-rpc", process.env.TESTING_RPC_URL ?? "http://localhost:4103"],
  ["deploy-rpc", process.env.DEPLOY_RPC_URL ?? "http://localhost:4104"]
];

const results = await Promise.all(
  services.map(async ([name, url]) => {
    try {
      const response = await fetch(`${url}/health`);
      return { name, url, ok: response.ok, body: await response.json().catch(() => ({})) };
    } catch (error) {
      return { name, url, ok: false, body: { error: error instanceof Error ? error.message : "Unknown error" } };
    }
  })
);

console.log(JSON.stringify(results, null, 2));
process.exit(results.every((result) => result.ok) ? 0 : 1);

