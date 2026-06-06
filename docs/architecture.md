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
- `harness-worktree`：Skill 背后的流程执行入口和本地 Git 收尾适配器。
- `skills/*`：Codex Skill 包。
- `apps/mindmap-editor`：与 Harness 控制面隔离的目标产品，需求默认作用于这里；产品 UI 不展示 Harness/Agent/编排概念。
- `services/mindmap-rpc`：目标产品后端，提供多文件、DIFF 协同和跨文件节点搜索等 JSON-RPC 能力，数据落在本地 SQLite。

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
testing/retesting -> reviewing -> committing -> pushing
-> summarizing -> creating-mr -> deploying -> completed
任意关键阶段 -> blocked 或 failed
```

## 运行记录

- `.harness/runs/<run-id>.json`：完整结构化记录。
- `.harness/tasks/<run-id>.json`：每任务稳定执行 flow，包含步骤状态、测试用例、质量验证、证据和 blockers。
- `.harness/git/<run-id>.json`：Git review、commit、push 和 MR/PR 记录。
- `.harness/logs/dev-services.log`：服务启动日志。
- `docs/agent-journal.md`：人工可读执行摘要。
- `docs/test-log.md`：测试和修复记录。

## 控制面与目标项目隔离

Harness 的职责是分析、计划、测试、部署和记录；目标产品的职责是承载真实需求。默认目标产品为 `apps/mindmap-editor`，后续可以新增更多 `apps/*` 产品应用作为独立样例；涉及 RPC 的能力继续放在 `services/*`。目标产品只通过自己的 `AGENTS.md` 给编排提供上下文。

## Task JSON Flow

每次 workflow 都会创建 `.harness/tasks/<run-id>.json`，作为 Skill 和 Agent 的稳定执行轨道。标准步骤为：

```txt
intake -> requirement-analysis -> test-case-generation -> implementation-planning
-> coding -> automated-testing -> quality-validation -> git-change-review
-> git-commit -> git-push -> mr-summary -> mr-create
-> deployment -> execution-record
```

`WorkflowRun` 记录实际运行结果；`HarnessTaskFile` 记录每一步应该做什么、输入输出、命令、质量门、证据和阻塞原因。Skill 执行时必须先读 task JSON，再根据当前 step 继续。

## 架构边界

- `workflow-core` 只保存纯状态机、task flow、摘要生成和 Git finalization 推导，不直接读写本地 Git。
- `orchestrator-rpc` 负责串联 RPC、推进状态、持久化 run/task/git 文档。
- `services/orchestrator-rpc/src/git-adapter.ts` 是本地 Git snapshot 读取适配器，可替换为真实 worktree 或远端 SCM 适配器。
- `harness-worktree/scripts/git-finalize.mjs` 是人工/Skill 收尾入口，显式执行 review、commit、push 和 MR/PR 记录。
