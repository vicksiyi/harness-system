# Mind Map Editor AGENTS

## 模块职责

`apps/mindmap-editor` 是一个独立产品样例：面向个人或小团队的脑图式想法编辑器。它不依赖 Harness 运行时代码，不展示 Harness、Agent 或流程编排文案。

Harness 只能把本文件作为产品上下文读取，用来理解产品边界、测试方式和改动注意事项。

## 关键入口文件

- `src/domain.ts`：脑图节点、筛选、摘要、导出和焦点建议等纯逻辑。
- `src/domain.test.ts`：产品逻辑单测，新增能力先补这里。
- `src/main.ts`：Vite 前端入口和交互绑定。
- `src/rpc.ts`：连接产品后端 `mindmap-rpc` 的 JSON-RPC 客户端。
- `src/style.css`：工具型编辑界面样式。

## 常用命令

```bash
pnpm target:dev
pnpm target:rpc
pnpm target:test
pnpm target:build
pnpm target:browser
```

## 修改注意事项

- 产品 UI 不出现 Harness、Codex、Agent、workflow 等控制面概念。
- 需求、Bugfix、Polish 优先在本目录内完成；只有验证或编排能力不足时才修改 Harness。
- 新增领域行为时先补 `src/domain.test.ts`，保持 TDD-like 节奏。
- 多文件、数据库和协同能力走 `services/mindmap-rpc`，不要退回纯 localStorage 假实现。
- 所有交互控件必须具备可访问名称，浏览器质量检查会验证。

## 下一级上下文

- 浏览器验证：`harness-worktree/scripts/browser-quality-check.mjs`
- 产品后端：`services/mindmap-rpc/AGENTS.md`
- 测试服务：`services/testing-rpc/AGENTS.md`
- 编排入口：`harness-worktree/AGENTS.md`

## 常见故障

- 浏览器检查找不到标题：确认页面主标题仍是 `Mind Map Studio`。
- 移动端横向溢出：检查 `.workspace`、`.canvas-grid`、`.inspector` 的响应式布局。
- 单测失败：优先修复 `src/domain.ts` 的纯逻辑，不要在 UI 层硬编码补丁。
