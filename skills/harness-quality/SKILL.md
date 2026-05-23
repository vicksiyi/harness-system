---
name: harness-quality
description: "当用户要求质量验证、E2E 验证、浏览器验证、截图复核、可访问性检查、agent-browser 验证，或 Harness workflow 需要根据本次改动自主设计质量门时使用；说明如何用 agent-browser、现有测试和日志形成发现问题、修复、重跑的闭环。"
metadata:
  short-description: "自主设计 Harness 质量验证"
---

# Harness Quality

当用户要求质量验证、E2E 测试、浏览器截图复核，或 `$harness` 流程进入验证阶段时，使用本 Skill。

本 Skill 是质量验证“方法说明”和工具清单，不定义固定业务路径。具体验证什么由 Codex 根据本次需求、Bug、代码 diff、风险面和产品上下文自主决定。

## 核心原则

- 先理解本次改动，再设计质量计划；不要机械执行固定点击路径。
- 质量验证必须覆盖用户可见行为、失败风险、数据/RPC 边界和回归风险。
- E2E 不只是 DOM 断言；需要结合 accessibility snapshot、截图、console、page errors、network、必要时 visual diff。
- 发现问题后不要只记录；先定位原因、修复、重跑同一验证，直到通过或写明 blocker。
- 验证记录必须写入 `docs/test-log.md` 和 `docs/agent-journal.md`，并在需要时刷新 MR Summary / Release Notes。

## 先读哪些上下文

1. 根目录 `AGENTS.md`，确认控制面和目标产品边界。
2. `.harness/tasks/<run-id>.json`，确认 `currentStepId`、`acceptanceCriteria`、`testCases`、`quality-validation` step。
3. 本次改动相关模块的 `AGENTS.md`。
4. 如果验证目标是 Mind Map Studio，读 `apps/mindmap-editor/AGENTS.md`。
5. 如果涉及测试闭环或日志解析，读 `services/testing-rpc/AGENTS.md`。
6. 如果涉及 workflow 状态、重试、评分，读 `packages/workflow-core/AGENTS.md`。

## 工具

### 固定回归工具

这些命令适合做基础质量门：

```bash
pnpm typecheck
pnpm test
pnpm target:test
pnpm target:build
pnpm target:browser
pnpm verify
```

`pnpm target:browser` 是仓库已有的确定性 Playwright 质量门，可继续用于稳定回归。

### agent-browser

agent-browser 用于 Agent 自主浏览器验证。先检查环境：

```bash
pnpm quality:agent-browser:doctor
```

核心命令：

```bash
pnpm exec agent-browser open http://localhost:5175
pnpm exec agent-browser snapshot -i
pnpm exec agent-browser find role button click --name "Open files page"
pnpm exec agent-browser find label "Search ideas" fill "launch"
pnpm exec agent-browser console --json
pnpm exec agent-browser errors
pnpm exec agent-browser network requests --filter rpc
pnpm exec agent-browser screenshot body .harness/browser/<run-id>-quality.png
pnpm exec agent-browser close
```

更复杂的多步验证可用 batch：

```bash
printf '%s' '[["open","http://localhost:5175"],["snapshot","-i"],["console","--json"],["errors"],["close"]]' \
  | pnpm exec agent-browser batch --bail --json
```

## 如何决定验证什么

根据改动类型选择验证面：

- UI/交互：关键路径、键盘操作、焦点、可访问名称、空状态、错误状态、移动端或窄屏截图。
- 数据/RPC：创建、保存、同步、失败响应、network request 是否 2xx、payload 是否包含必要 ID。
- 协同：多 tab / 多客户端、手动 pull、自动同步、冲突或乱序场景。
- 画布/编辑器：拖拽、缩放、选择、连线、mini map、导入导出。
- 流程/Harness：workflow run、状态机转移、失败进入 fixing/retesting、日志解析是否给出 actionable fix。
- 性能/稳定性：长列表、重复操作、console error、uncaught page error、network retry。

最小验证计划应包含：

1. 本次改动的主路径。
2. 一个最可能坏掉的边界场景。
3. 一个回归风险场景。
4. 截图或 snapshot 证据。
5. console/errors/network 检查。

验证计划要回写到 task JSON 对应的 `quality-validation` step 证据或备注中。如果当前环境无法自动改写 task JSON，至少把计划、命令、证据路径写入 `docs/test-log.md`。

## 推荐闭环

1. 读相关 `AGENTS.md` 和 diff。
2. 写出本次质量计划，列出要验证的用户行为和失败风险。
3. 运行必要单测或构建。
4. 用 agent-browser 打开目标页面并获取 `snapshot -i`。
5. 用语义定位优先操作：role、label、text、placeholder。必要时才用 CSS selector。
6. 每次页面状态变化后重新 snapshot。
7. 检查 `console --json`、`errors`、`network requests`。
8. 保存截图到 `.harness/browser/` 或 `.harness/quality/`。
9. 如果失败：
   - 保存失败日志和截图路径。
   - 判断是产品 Bug、测试假设错误、环境问题还是工具定位问题。
   - 修改代码或验证步骤。
   - 重跑同一验证，确认失败消失。
10. 更新 `docs/test-log.md`、`docs/agent-journal.md`。

## 失败判断

以下情况判定失败：

- 用户关键路径无法完成。
- 页面出现 console error 或 uncaught page error。
- 关键 RPC / network 请求失败。
- snapshot 中缺少应有语义控件、标题、状态或可访问名称。
- 截图中有遮挡、截断、布局溢出、连线漂移、不可读文本。
- 质量计划里的验收条件无法被证据支持。

## 输出要求

最终汇报需要包含：

- 质量计划摘要。
- 执行命令。
- agent-browser 关键 snapshot / screenshot / console / network 证据。
- 发现的问题、修复动作、重跑结果。
- 如果未覆盖某项风险，明确说明原因。
