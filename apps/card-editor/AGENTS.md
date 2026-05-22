# Card Editor Target AGENTS

## 模块职责

`apps/card-editor` 是被 Harness 编排的独立目标应用，不属于 Harness 控制平面。Codex 通过 `$harness requirement|bugfix|polish ...` 接到任务后，优先在这里实现产品需求、修复 Bug 或做体验打磨。

## 产品定位

一个本地卡片编辑器，用于创建、编辑、整理和预览知识卡片。它适合作为 Harness 的目标应用，因为需求、Bugfix、Polish 都能落在真实 UI 和领域模型上。

## 关键入口

- `src/domain.ts`：卡片、标签、状态、过滤、排序等纯函数领域逻辑。
- `src/domain.test.ts`：领域逻辑单测。修改领域行为前先补测试。
- `src/main.ts`：无框架前端交互和渲染。
- `src/style.css`：编辑器界面样式。

## 常用命令

```bash
pnpm target:dev
pnpm target:test
pnpm target:build
```

## 修改注意事项

- Harness 编排代码在 `services/`、`packages/`、`harness-worktree/`，目标产品代码在 `apps/card-editor/`，两者保持隔离。
- 目标项目需求优先修改 `apps/card-editor`，不要为了产品需求改 Harness 控制面。
- 目标项目如果需要 RPC，优先在现有 `services/` 下新增或扩展服务，不在 app 目录里内嵌后端。
- 领域逻辑先写单测，再实现。
- UI 是编辑器工具，不要做营销页。

## 在闭环中的位置

Harness 负责分析、计划、测试、部署和记录；Card Editor 是被操作的产品仓库目录。
