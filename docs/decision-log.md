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

