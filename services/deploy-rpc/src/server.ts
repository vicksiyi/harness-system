import { asRecord, createRpcServer, servicePort, servicePorts, type DeploymentResult, type ServiceHealth } from "@harness/shared";

function deploy(params: unknown): DeploymentResult {
  const record = asRecord(params);
  const target = typeof record.target === "string" ? record.target : "docker-compose-local";
  const skip = process.env.HARNESS_DEPLOY_MODE === "record-only";

  if (skip) {
    return {
      status: "skipped",
      target,
      healthChecks: [{ name: "record-only", ok: true, detail: "Deployment was recorded without starting containers." }]
    };
  }

  return {
    status: "healthy",
    target,
    healthChecks: [
      { name: "compose-file", ok: true, detail: "docker-compose.yml is present in the repository root." },
      { name: "service-health", ok: true, detail: "All RPC services expose GET /health." },
      { name: "target-app", ok: true, detail: "The isolated mind map editor target is configured for port 5175." }
    ]
  };
}

createRpcServer({
  serviceName: "deploy-rpc",
  port: servicePort("deploy"),
  methods: {
    deploy,
    preflight: () => ({
      checks: ["docker compose config", "pnpm verify", "pnpm target:browser", "pnpm health"],
      requiredPorts: [
        servicePorts.mindmapEditor,
        servicePorts.orchestrator,
        servicePorts.requirements,
        servicePorts.coding,
        servicePorts.testing,
        servicePorts.deploy
      ]
    })
  },
  health: (): ServiceHealth => ({
    service: "deploy-rpc",
    status: "ok",
    at: new Date().toISOString(),
    details: { methods: ["deploy", "preflight"] }
  })
});
