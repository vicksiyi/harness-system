# Harness System

Harness System 是一个本地优先的 Codex / Agent 端到端研发闭环验证系统。它不是普通业务脚手架，而是给 Codex Skill 调用的工程控制面：接收需求、Bug 或 polish 目标，编排需求分析、编码计划、测试、日志读取、自动修复、重测、MR Summary、部署和执行记录。

当前默认产品样例是 `apps/mindmap-editor`，即一个与 Harness 控制面隔离的脑图编辑器。Harness 负责研发流程编排；Mind Map Studio 负责承载真实产品需求。产品 UI 不展示 Harness、Agent 或流程编排概念，只通过自己的 `AGENTS.md` 向 Agent 提供上下文。

## 当前能力概览

- Codex Skill 入口：`$harness`、`$harness-requirement`、`$harness-bugfix`、`$harness-polish`。
- 多 RPC 控制面：orchestrator、requirements、coding、testing、deploy。
- 独立产品后端：`mindmap-rpc`，提供多文件、SQLite 存储、DIFF 协同、跨文件节点搜索。
- 独立产品前端：`apps/mindmap-editor`，提供脑图编辑、文件管理、导入导出、无限画布、快捷键、协同同步和可视化状态。
- 自动化质量闭环：单测、类型检查、前端构建、RPC 健康检查、无头浏览器交互、截图复核、失败日志解析。
- 渐进式知识库：根目录和各模块 `AGENTS.md`。
- 可审计输出：`.harness/runs/*.json`、`docs/agent-journal.md`、`docs/test-log.md`、`docs/generated-mr-summary.md`、`docs/release-notes.md`。
- Docker Compose 部署：`docker compose up --build`。

## 目录结构

```txt
harness-system/
  apps/
    mindmap-editor/        # 隔离的产品样例：Mind Map Studio
  services/
    orchestrator-rpc/      # 控制面总编排
    requirements-rpc/      # 自然语言需求结构化
    coding-rpc/            # patch plan / 变更摘要 / 测试建议
    testing-rpc/           # 测试执行、日志解析、失败归因
    deploy-rpc/            # Docker 部署记录和健康检查
    mindmap-rpc/           # 产品后端：文件、SQLite、DIFF 协同
  packages/
    shared/                # 共享类型、JSON-RPC server、工具函数
    rpc-client/            # RPC client 和健康检查
    workflow-core/         # 状态机、重试策略、评分、摘要生成
  harness-worktree/        # Skill 背后的流程入口和 runbook
  skills/                  # 可安装 Codex Skill 包，中文说明
  docs/                    # 架构、测试、执行、MR、Release 文档
  docker-compose.yml
```

## Skill 调用方式

主要入口是 `$harness`：

```txt
$harness requirement 增加一个工作流运行详情页
$harness bugfix 测试服务日志解析失败
$harness polish 优化前端任务状态展示
```

也支持更明确的专用入口：

```txt
$harness-requirement 增加脑图文件模板
$harness-bugfix 保存文件接口失败
$harness-polish 优化节点编辑体验
```

底层脚本等价入口：

```bash
pnpm workflow:requirement "增加脑图文件模板"
pnpm workflow:bugfix "保存文件接口失败"
pnpm workflow:polish "优化节点编辑体验"
```

Skill 文件位置：

- `skills/harness/SKILL.md`
- `skills/harness-requirement/SKILL.md`
- `skills/harness-bugfix/SKILL.md`
- `skills/harness-polish/SKILL.md`

安装到本机 Codex Skill 目录：

```bash
pnpm skills:install
```

## 本地启动

安装依赖：

```bash
pnpm install
```

启动 Harness 控制面 RPC 服务：

```bash
pnpm dev:services
```

启动产品样例前端和产品 RPC：

```bash
pnpm target:dev
```

访问：

- Mind Map Studio: `http://localhost:5175`
- Orchestrator RPC: `http://localhost:4100`
- Requirements RPC: `http://localhost:4101`
- Coding RPC: `http://localhost:4102`
- Testing RPC: `http://localhost:4103`
- Deploy RPC: `http://localhost:4104`
- Mind Map RPC: `http://localhost:4105`

注意：只运行 `pnpm target:web` 会打开前端，但保存文件、Push diff、Pull diff 依赖 `mindmap-rpc`，因此日常建议用 `pnpm target:dev`。

## Mind Map Studio 当前功能

`apps/mindmap-editor` 是当前产品样例，已经具备：

- 文件管理页：创建、打开、保存、搜索、排序不同脑图文件。
- SQLite 持久化：文件和节点存储在本地数据库。
- 显式文件 ID：Files 和 Collaboration 面板显示当前 `mapId`，DIFF 同步按文件 ID 路由。
- DIFF 协同：Push / Pull diff，多端手动同步和自动同步。
- 编辑器页：专注节点编辑，包含 outline、inspector、关系洞察、快照、编辑历史、焦点队列。
- 无限画布：背景拖拽平移、滚轮缩放、键盘缩放、mini map、reset。
- Canvas 连接线：节点连线使用 canvas 绘制，并有像素级浏览器质检。
- 快捷键：`R` 新建根节点、`C` 新建子节点、`L` 自动布局、`Cmd/Ctrl+Z` undo、`Shift+Cmd/Ctrl+Z` redo、`Cmd/Ctrl+S` 快照、`Cmd/Ctrl +/-/0` 缩放；`Cmd/Ctrl+R` 保留给浏览器刷新。
- 导入导出：JSON 导入、JSON / Markdown 导出。
- 跨文件节点搜索：通过 `mindmap-rpc` 查询数据库节点，支持状态筛选并可跳转到编辑器选中节点。

## RPC 架构

所有 RPC 服务统一暴露：

```txt
GET  /health
POST /rpc
```

请求格式：

```json
{ "id": "rpc_1", "method": "runWorkflow", "params": {} }
```

响应格式：

```json
{ "id": "rpc_1", "result": {} }
```

控制面服务职责：

- `orchestrator-rpc`：推进工作流状态机，串联其它 RPC 服务。
- `requirements-rpc`：把自然语言输入拆为任务类型、范围、风险、验收条件。
- `coding-rpc`：生成 patch plan、变更摘要、测试建议。
- `testing-rpc`：执行回归命令、读取日志、解析失败、给出修复建议。
- `deploy-rpc`：记录 Docker Compose 部署和健康检查结果。

产品服务职责：

- `mindmap-rpc`：产品自己的 JSON-RPC 后端，负责文件、节点、DIFF 操作记录、跨文件搜索和 SQLite 数据库。

## 工作流状态机

核心状态机在 `packages/workflow-core`：

```txt
created -> analyzing -> planning -> coding -> testing
testing -> fixing -> retesting -> fixing
testing/retesting -> summarizing -> deploying -> completed
任意关键阶段 -> blocked 或 failed
```

一次 `$harness bugfix ...` 会大致执行：

1. requirements-rpc 分析输入。
2. coding-rpc 生成修复计划。
3. testing-rpc 运行类型检查、单测、构建和浏览器质量门。
4. 失败时进入 fixing / retesting。
5. workflow-core 评分并生成 MR Summary / Release Notes。
6. deploy-rpc 记录部署和健康状态。
7. run 记录写入 `.harness/runs/<run-id>.json` 和 docs。

## 质量验证

常用验证命令：

```bash
pnpm typecheck
pnpm test
pnpm target:test
pnpm target:build
pnpm target:browser
pnpm verify
```

`pnpm verify` 当前包含：

- TypeScript 类型检查。
- Vitest 单元测试。
- Mind Map Studio 生产构建。
- 无头浏览器质量门。

无头浏览器质量门位于 `harness-worktree/scripts/browser-quality-check.mjs`，会验证：

- 页面关键区域可见。
- 创建数据库文件、保存文件、DIFF sync。
- File ID 对 DIFF 同步可见。
- 多端打开、手动 pull、自动同步。
- 导入导出。
- 命令面板、undo / redo、快照。
- 节点拖拽、自动布局、折叠展开。
- Canvas 连线像素检查。
- 无限画布平移、滚轮缩放、reset。
- 桌面和移动端截图、横向溢出和可访问名称。

浏览器截图默认写到：

```txt
.harness/browser/
```

## 执行记录和文档

关键文档：

- `docs/architecture.md`：系统架构。
- `docs/runbook.md`：运行手册。
- `docs/agent-journal.md`：每轮执行摘要。
- `docs/test-log.md`：测试命令、失败、修复、重试记录。
- `docs/generated-mr-summary.md`：最近一次 MR Summary。
- `docs/release-notes.md`：最近一次 Release Notes。

结构化运行记录：

```txt
.harness/runs/<run-id>.json
.harness/logs/dev-services.log
.harness/mindmap/mindmaps.sqlite
```

## AGENTS.md 渐进式知识库

入口是根目录 `AGENTS.md`。Agent 不需要一次读完整仓库，而是按任务进入对应模块：

- 产品 UI：`apps/mindmap-editor/AGENTS.md`
- 产品后端：`services/mindmap-rpc/AGENTS.md`
- 编排服务：`services/orchestrator-rpc/AGENTS.md`
- 状态机：`packages/workflow-core/AGENTS.md`
- 测试闭环：`services/testing-rpc/AGENTS.md`
- 部署：`services/deploy-rpc/AGENTS.md`
- Skill / worktree：`harness-worktree/AGENTS.md`
- 文档：`docs/AGENTS.md`

## Docker 部署

本地部署：

```bash
docker compose up --build
```

如果端口冲突，可以覆盖宿主端口：

```bash
MINDMAP_EDITOR_PORT=5176 docker compose up --build
```

健康检查：

```bash
pnpm health
```

部署脚本：

```bash
pnpm deploy:local
```

## 常见问题

### 保存文件失败

先确认 `mindmap-rpc` 在线：

```bash
curl http://localhost:4105/health
```

日常启动请使用：

```bash
pnpm target:dev
```

### `Cmd/Ctrl+R` 没有刷新

当前应用不再拦截 `Cmd/Ctrl+R`。如果仍异常，优先跑：

```bash
pnpm target:test
pnpm target:browser
```

### DIFF 不知道发到哪个文件

当前 DIFF payload 使用显式 `mapId`，页面会在 Files 和 Collaboration 面板显示 File ID。调试时先确认该 ID 与目标文件一致。

### 浏览器质检后保存又失败

质量门在连接已有 `http://localhost:5175` 前端时会保持 `mindmap-rpc` 在线。若手动关闭了 RPC，重新运行：

```bash
pnpm target:rpc
```

## 最近一次完整闭环

最近一次修复闭环：

```bash
HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:bugfix "修复保存文件失败、Cmd+R 误触创建节点、无限画布拖拽缩放缺失、协同 DIFF 缺少文件 ID 语义"
```

结果：

- Workflow run: `run_mphzxyd4_bye74m1r`
- `pnpm verify`：通过
- 单测：69 passed
- 浏览器质量门：通过
- 最新修复提交：`dce4939 fix: stabilize mind map collaboration canvas`

## 下一步方向

- 协同冲突检查和冲突解决 UI。
- 文件版本历史和操作时间线。
- 节点批量编辑。
- 更完整的数据库迁移机制。
- 更接近真实 Agent 执行的 patch 应用与回滚策略。
