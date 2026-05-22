import {
  asRecord,
  createRpcServer,
  servicePorts,
  type ServiceHealth,
} from "@harness/shared";
import { analyzeRequirement } from "./analyzer.js";

createRpcServer({
  serviceName: "requirements-rpc",
  port: Number(process.env.PORT ?? servicePorts.requirements),
  methods: {
    analyze: (params) => analyzeRequirement(asRecord(params)),
    templates: () => ({
      requirement: "需求 -> 拆解 -> 编码 -> 测试 -> 部署 -> MR Summary",
      bugfix: "复现 -> 日志 -> 根因 -> 修复 -> 回归 -> MR Summary",
      polish: "影响面 -> UI/DX 改进 -> 构建 -> 检查 -> 改进记录"
    })
  },
  health: (): ServiceHealth => ({
    service: "requirements-rpc",
    status: "ok",
    at: new Date().toISOString(),
    details: { methods: ["analyze", "templates"] }
  })
});
