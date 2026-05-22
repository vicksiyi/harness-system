# Architecture

Harness System 是一个本地优先的 Codex / Agent 研发闭环验证系统。

## 组件

- `services/orchestrator-rpc`：总编排服务，推进状态机并调用其它 RPC。
- `services/requirements-rpc`：自然语言任务结构化。
- `services/coding-rpc`：生成 patch plan、变更摘要和测试建议。
- `services/testing-rpc`：测试执行模拟、日志解析、失败归因和重试建议。
- `services/deploy-rpc`：Docker Compose 部署记录和健康检查。
- `packages/workflow-core`：状态机、重试决策、评分和摘要生成。
- `packages/shared`：共享类型、JSON-RPC server、工具函数。
- `packages/rpc-client`：RPC client 和健康检查。
- `harness-worktree`：Skill 背后的流程执行入口。
- `skills/*`：Codex Skill 包。
- `apps/mindmap-editor`：与 Harness 控制面隔离的目标产品，需求默认作用于这里；产品 UI 不展示 Harness/Agent/编排概念。

## 协议

所有 RPC 服务暴露：

- `GET /health`
- `POST /rpc`

RPC 请求：

```json
{ "id": "rpc_1", "method": "runWorkflow", "params": {} }
```

RPC 响应：

```json
{ "id": "rpc_1", "result": {} }
```

## 状态机

```txt
created -> analyzing -> planning -> coding -> testing
testing -> fixing -> retesting -> fixing
testing/retesting -> summarizing -> deploying -> completed
任意关键阶段 -> blocked 或 failed
```

## 运行记录

- `.harness/runs/<run-id>.json`：完整结构化记录。
- `.harness/logs/dev-services.log`：服务启动日志。
- `docs/agent-journal.md`：人工可读执行摘要。
- `docs/test-log.md`：测试和修复记录。

## 控制面与目标项目隔离

Harness 的职责是分析、计划、测试、部署和记录；目标产品的职责是承载真实需求。默认目标产品为 `apps/mindmap-editor`，后续可以新增更多 `apps/*` 产品应用作为独立样例；涉及 RPC 的能力继续放在 `services/*`。目标产品只通过自己的 `AGENTS.md` 给编排提供上下文。
