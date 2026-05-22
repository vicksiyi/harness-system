import {
  asRecord,
  createRpcServer,
  servicePort,
  type ServiceHealth,
} from "@harness/shared";
import { runBrowserQualityCheck } from "./browser-quality.js";
import { parseFailureLog } from "./log-parser.js";
import { runHarnessValidation } from "./test-runner.js";

createRpcServer({
  serviceName: "testing-rpc",
  port: servicePort("testing"),
  methods: {
    runTests: (params) => runHarnessValidation(params, { browserQualityRunner: runBrowserQualityCheck }),
    parseLogs: (params) => {
      const record = asRecord(params);
      const rawLog = typeof record.rawLog === "string" ? record.rawLog : "";
      return parseFailureLog(rawLog);
    }
  },
  health: (): ServiceHealth => ({
    service: "testing-rpc",
    status: "ok",
    at: new Date().toISOString(),
    details: { methods: ["runTests", "parseLogs"] }
  })
});
