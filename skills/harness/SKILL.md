---
name: harness
description: "当用户使用 $harness requirement、$harness bugfix、$harness polish，或要求 Codex 运行本地 Harness 研发闭环时使用；负责从需求/Bug/Polish 到分析、编码、测试、日志读取、自动修复、重测、MR Summary、Docker 部署和执行记录的一次调用闭环。"
metadata:
  short-description: "运行 Harness 研发闭环"
---

# Harness

当用户使用 `$harness ...`，或要求 Codex 运行本地 Harness 研发闭环时，使用本 Skill。

## 触发方式

```txt
$harness requirement <自然语言需求>
$harness bugfix <Bug 描述或失败日志>
$harness polish <体验、文案、DX 或流程优化目标>
```

主入口是单一 `$harness`，通过 `requirement`、`bugfix`、`polish` 子命令区分流程。仓库同时提供 `$harness-requirement`、`$harness-bugfix`、`$harness-polish` 三个专用 Skill，适合更明确的调用。

## 适用场景

- 需求从描述到实现验证的端到端闭环。
- Bug 从失败日志到根因、修复、回归测试的闭环。
- 前端、文案、开发体验、流程展示等 polish 类改进。
- 需要生成 MR Summary、Release Notes、部署记录和可审计执行日志。

## 输入格式

```txt
$harness requirement 增加一个工作流运行详情页
$harness bugfix 测试服务日志解析失败
$harness polish 优化前端任务状态展示
```

## 渐进式读取 AGENTS.md

只读取当前任务需要的知识库：

1. 先读仓库根目录 `AGENTS.md`，确认总入口和模块索引。
2. 编排、状态机、闭环流程：读 `harness-worktree/AGENTS.md`、`packages/workflow-core/AGENTS.md`、`services/orchestrator-rpc/AGENTS.md`。
3. 需求分析：读 `services/requirements-rpc/AGENTS.md`。
4. 编码计划和模拟 Agent 执行：读 `services/coding-rpc/AGENTS.md`。
5. 测试、日志解析、失败归因、重试：读 `services/testing-rpc/AGENTS.md`。
6. Docker Compose、健康检查、部署记录：读 `services/deploy-rpc/AGENTS.md`。
7. 目标产品 UI：读 `apps/mindmap-editor/AGENTS.md`。
8. 文档、MR Summary、Release Notes、测试日志：读 `docs/AGENTS.md`。

## 调用本地脚本

Skill 背后的执行器是 `harness-worktree/scripts/run-workflow.mjs`。按子命令映射：

```bash
pnpm workflow:requirement "<需求>"
pnpm workflow:bugfix "<Bug 或日志>"
pnpm workflow:polish "<优化目标>"
```

该脚本会：

- 检查所有 RPC 服务 `/health`。
- 如果服务未启动，自动运行 `pnpm dev:services`。
- 调用 `orchestrator-rpc` 的 `runWorkflow`。
- 由编排服务依次调用 requirements、coding、testing、deploy RPC。
- 读取测试结果和结构化失败原因。
- 在失败可修复时进入 `fixing -> retesting`。
- 将运行记录写入 `.harness/runs/<run-id>.json`。
- 更新 `docs/agent-journal.md`、`docs/test-log.md`、`docs/generated-mr-summary.md`、`docs/release-notes.md`。

## 如何运行服务

开发模式：

```bash
pnpm dev:services
pnpm target:dev
```

服务地址：

- Mind Map Studio Target: `http://localhost:5175`
- Orchestrator RPC: `http://localhost:4100`
- Requirements RPC: `http://localhost:4101`
- Coding RPC: `http://localhost:4102`
- Testing RPC: `http://localhost:4103`
- Deploy RPC: `http://localhost:4104`

## 如何读取日志

按顺序读取：

1. `.harness/runs/<run-id>.json`：完整事件、日志、测试、部署、阻塞原因。
2. `.harness/logs/dev-services.log`：服务启动和端口冲突日志。
3. `docs/test-log.md`：人工可读的测试命令、失败摘要、修复和重试记录。
4. `docs/agent-journal.md`：每次执行摘要和下一步。

## 如何判断失败

优先看 `.harness/runs/<run-id>.json` 中的：

- `status`
- `stage`
- `blocker`
- `tests.failures[]`
- `deployment.healthChecks[]`

可修复失败必须包含：

- `reason`
- `evidence`
- `suggestedFix`

真实浏览器验证还必须查看截图：

1. `pnpm target:browser` 会输出 desktop/mobile 截图路径。
2. Codex 必须读取截图，确认布局、可见内容、弹层、移动端显示和关键交互状态是否正常。
3. 仅 DOM 可见性通过但截图中存在截断、遮挡、溢出、错位或不可读，也要判定为失败并修复。

如果失败不可自动修复，必须把阻塞原因写入 `docs/test-log.md` 和 `docs/agent-journal.md`。

## 自动修复与重跑

1. 根据 `tests.failures[]` 找到失败模块。
2. 读取该模块最近的 `AGENTS.md`。
3. 先补或更新单测，保持类似 TDD 的开发节奏。
4. 修改最小必要代码。
5. 运行：

```bash
pnpm typecheck
pnpm test
pnpm target:build
pnpm target:browser
```

6. 重跑原始 workflow 命令。
7. 把失败、修复、重试结果写入 `docs/test-log.md`。

## 生成 MR Summary

```bash
pnpm mr:summary
```

生成文件：

- `docs/generated-mr-summary.md`
- `docs/release-notes.md`

## 部署与健康检查

Docker 部署：

```bash
docker compose up --build
```

健康检查：

```bash
pnpm health
```

部署验证脚本：

```bash
pnpm deploy:local
```

## 执行记录

每次执行都要更新：

- `docs/agent-journal.md`
- `docs/test-log.md`
- `.harness/runs/<run-id>.json`
- `docs/generated-mr-summary.md`
- `docs/release-notes.md`

## 输出要求

最终向用户汇报：

- Workflow run id
- 最终状态和阶段
- 测试结果
- 部署结果
- MR Summary 路径
- 阻塞原因和下一步，如果存在
