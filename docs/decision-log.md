# Decision Log

## 0001 TypeScript Monorepo

- 决策：使用 pnpm workspace + TypeScript。
- 原因：共享类型、RPC 服务和前端可以在一个仓库内快速迭代。
- 取舍：没有引入大型后端框架，减少本地部署复杂度。

## 0002 JSON-RPC Over HTTP

- 决策：所有后端服务使用轻量 HTTP JSON-RPC。
- 原因：协议简单，适合本地 Harness 和 Docker Compose。
- 取舍：不使用 gRPC 或 tRPC，避免生成代码和额外运行时复杂度。

## 0003 Worktree-Like Directory

- 决策：创建 `harness-worktree` 作为流程编排目录。
- 原因：当前仓库从零初始化，真实 worktree 没有额外分支价值；目录化入口更直接。
- 迁移方式：后续可用 `git worktree add ../harness-system-worktree main` 迁移。

## 0004 TDD-Like Safety Net

- 决策：为状态机、需求分析、日志解析和 RPC server 先补单测。
- 原因：这些模块决定闭环可靠性，失败时需要快速定位。
- 取舍：服务级全链路测试放在后续验证脚本和 workflow 运行中。

## 0005 Isolated Target Project

- 决策：使用 `apps/mindmap-editor` 作为 Harness 默认目标产品，并移除容易混淆的 Harness 前端控制台。
- 原因：Harness 应该编排 Agent 开发另一个产品，而不是把业务需求写进 Harness 控制面。
- 取舍：Harness 观察面主要依赖 Skill、RPC、`.harness/runs` 和 `docs/*`；目标项目仍在同一 monorepo，便于本地测试和 Docker 部署。

## 0006 Browser Quality Gate

- 决策：testing-rpc 的验证结果必须包含真实浏览器质量检查，覆盖页面可见性、基础交互、可访问名称和响应式横向溢出。
- 原因：仅靠单测和构建无法证明目标产品在浏览器中可用。
- 取舍：单测通过可注入 runner 避免依赖本机浏览器；真实 workflow 和 `pnpm target:browser` 使用 Playwright Core + Chromium/Chrome。

## 0007 Alternate Port Profile

- 决策：RPC 服务和 workflow runner 支持 `HARNESS_PORT_OFFSET`，真实浏览器检查支持 `HARNESS_BROWSER_TARGET_URL` 推导 Vite 端口。
- 原因：本地旧容器或其他项目占用默认端口时，Harness 仍需要完成 Skill -> RPC -> 测试 -> 浏览器验证闭环。
- 取舍：默认端口保持不变；备用 profile 需要显式设置环境变量，例如 `HARNESS_PORT_OFFSET=100 HARNESS_BROWSER_TARGET_URL=http://localhost:5176`。

## 0008 Browser Gate Failure Aggregation

- 决策：浏览器质量脚本必须把任意单项 failed check 聚合为整体失败退出码。
- 原因：真实浏览器验证的价值在于阻断回归；只记录 failed check 但进程仍成功会让 workflow 误判。
- 取舍：脚本仍输出完整 JSON 和截图，便于失败后读取日志并定位 UI 或可访问性问题。

## 0009 Screenshot-Guided Visual QA

- 决策：浏览器质量脚本输出 desktop/mobile 截图，并要求 Codex 读取截图进行视觉复核。
- 原因：DOM 可见性和无障碍名称无法发现所有视觉问题，例如移动端画布节点被截断但元素仍存在。
- 取舍：截图审查会增加少量验证时间，但能更早发现错位、遮挡、截断和不可读状态。

## 0010 Product Sync Naming

- 决策：目标产品可以继续通过 HTTP JSON-RPC 调度后端服务，但产品界面和用户可见状态只使用 sync service、database file、pending changes 等产品语言。
- 原因：RPC 是传输/调度形式，不应成为用户理解保存文件或协同状态的接口名称。
- 取舍：内部包名和服务目录仍保留 `*-rpc`，方便 Harness 识别服务边界；浏览器质量报告面向产品行为时使用“sync service”检查名。
- 质量要求：浏览器门禁必须验证真实点击、保存结果、diff 队列清空、Canvas 像素和截图；发现失败后记录根因并修复，不只放宽选择器。

## 0011 Viewport Transform Over Coordinate Mutation

- 决策：无限画布使用本地 `CanvasViewport` 对整个 canvas surface 做 transform，不直接重写节点坐标。
- 原因：节点和连接线继续共享文档坐标系，平移/缩放时可以一起移动，降低连接线漂移风险。
- 取舍：视口暂时是本地状态，没有进入数据库 diff 协同；后续可按用户偏好决定是 per-user viewport 还是 per-file viewport。
- 质量要求：浏览器门禁必须验证 toolbar、pan/zoom、reset 和截图，而不只验证领域函数。

## 0012 Skill-Guided Task JSON Flow

- 决策：每次 Harness workflow 都生成 `.harness/tasks/<run-id>.json`，并固定 `intake -> requirement-analysis -> test-case-generation -> implementation-planning -> coding -> automated-testing -> quality-validation -> git-change-review -> git-commit -> git-push -> mr-summary -> mr-create -> deployment -> execution-record`。
- 原因：Skill 只有自然语言说明时容易跑偏；本地 task JSON 提供当前步骤、验收标准、测试用例、证据和 blocker 的稳定调度面。
- 取舍：`.harness/tasks` 属于本地执行产物，不纳入 Git；可审计摘要继续写入 `docs/agent-journal.md` 和 `docs/test-log.md`。

## 0013 Agent-Browser As Quality Skill

- 决策：新增中文 `harness-quality` Skill，把 agent-browser 定义为质量验证方法和工具清单，而不是默认固定路径脚本。
- 原因：不同需求需要不同验证面；协同、画布、RPC、保存、可访问性和截图检查应由 Agent 根据本次风险自主设计。
- 质量要求：任务涉及 UI/RPC/协同时，至少覆盖主路径、边界风险、回归风险、截图或 snapshot、console/errors/network 检查。

## 0014 Collaborative History Replay

- 决策：undo/redo 应把恢复后的历史帧转换为协同 DIFF：`select-node`、按父子顺序 `upsert-node`、以及对恢复帧中不存在的节点发 `delete-node`。
- 原因：只恢复本地 `state.nodes` 会让其他客户端保持旧状态；仅 upsert 也无法同步“撤销新增节点”这类删除语义。
- 质量要求：浏览器门禁必须验证同一文件双端编辑后，peer 同步收到节点 diff、undo diff 和 redo diff。

## 0015 Git Finalization Boundary

- 决策：Git finalization 分为纯 workflow contract、orchestrator snapshot adapter 和 `workflow:git` 本地收尾脚本三层。
- 原因：状态机需要记录 review/commit/push/MR 证据，但 RPC 编排服务不应直接提交、推送或创建 PR。
- 取舍：默认 workflow 只记录 handoff；真实 `git commit` 必须由 `pnpm workflow:git commit -- --files ...` 明确触发。
