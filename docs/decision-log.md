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

- 决策：新增 `apps/card-editor` 作为 Harness 默认目标产品，并移除容易混淆的 Harness 前端控制台。
- 原因：Harness 应该编排 Agent 开发另一个产品，而不是把业务需求写进 Harness 控制面。
- 取舍：Harness 观察面主要依赖 Skill、RPC、`.harness/runs` 和 `docs/*`；目标项目仍在同一 monorepo，便于本地测试和 Docker 部署。
