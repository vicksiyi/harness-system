# Requirements RPC AGENTS

## 模块职责

将自然语言需求、Bug 或 polish 目标转为结构化任务说明、范围、风险、验收标准和推荐修改文件。

## 关键入口

- `src/analyzer.ts`：可单测的需求分析核心。
- `src/server.ts`：RPC 服务入口。
- `src/analyzer.test.ts`：需求分析单测。

## RPC 方法

- `analyze`
- `templates`

## 常用命令

```bash
pnpm test services/requirements-rpc/src/analyzer.test.ts
pnpm --filter @harness/requirements-rpc dev
```

## 修改注意事项

- 新任务类型或验收规则先补 `analyzer.test.ts`。
- 输出必须包含可验证验收标准。
- 推荐文件要帮助 Codex 进入正确 AGENTS 层级。

## 常见故障

- 需求标题过长：检查 `analyzeRequirement` 的截断逻辑。
- 验收标准不匹配类型：检查 `criteriaFor`。

