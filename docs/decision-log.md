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
