# Agent Journal

本文件记录可审计的执行摘要，不记录完整私有思维链。

## Initial Build

- 目标：创建可本地运行、Docker 部署、Skill 调用的 Harness 系统。
- 已完成：初始化 monorepo、workflow-core、RPC 服务、worktree 脚本、中文 Skill 包、单测基础覆盖。
- 下一步：补 Docker Compose、运行完整验证、记录结果。

## Verification Pass

- 目标：完成自动化测试闭环和 Docker 部署验证。
- 已完成：`pnpm verify` 通过；bugfix workflow 触发失败、自动修复、重测并完成；Docker Compose 构建和健康检查通过。
- 取舍：移除 Harness 前端控制台，避免和目标产品样例混淆；观察入口收敛到 Skill、RPC 和文档记录。
- 下一步：可接入真实 Agent patch executor，替换当前 coding-rpc 的模拟 patch plan。


## Run run_mphbeszb_ibsczodq

- At: 2026-05-22T19:31:00.044Z
- Type: bugfix
- Prompt: 测试服务日志解析失败
- Result: passed at completed
- Tests: passed with score 96
- Deployment: healthy
- MR Summary: docs/generated-mr-summary.md

## Run run_mphc6cqz_2lt2mci0

- At: 2026-05-22T19:52:25.386Z
- Type: requirement
- Prompt: 给脑图编辑器增加结构化编辑能力
- Target project: apps/mindmap-editor
- Result: passed at completed
- Tests: passed with score 96
- Deployment: healthy
- MR Summary: docs/generated-mr-summary.md

## Run run_mphc6v85_awfm002g

- At: 2026-05-22T19:52:49.320Z
- Type: requirement
- Prompt: 给脑图编辑器增加结构化编辑能力
- Target project: apps/mindmap-editor
- Result: passed at completed
- Tests: passed with score 96
- Deployment: healthy
- MR Summary: docs/generated-mr-summary.md

## Target Product Loop

- 目标：将 Harness 和产品样例隔离，让 Harness 默认编排 Mind Map Studio，而不是继续开发控制台。
- 已完成：删除 Harness 前端控制台；将目标产品切换为 `apps/mindmap-editor`；产品 UI 不再出现 Harness/Agent/编排文案；Docker Compose 只启动 Mind Map Studio 和 RPC 服务。
- 验证：`pnpm verify`、Docker Compose、浏览器烟测、`pnpm workflow:requirement "给脑图编辑器增加结构化编辑能力"` 均通过。
- 下一步：继续通过 `$harness requirement|bugfix|polish ...` 给 Mind Map Studio 增加更复杂能力，同时保持 Harness 控制面隔离。

## Run run_mphcdu9e_f6p05eh5

- At: 2026-05-22T19:58:14.659Z
- Type: requirement
- Prompt: 给脑图编辑器增加关联视图、反向引用和下一步焦点队列
- Target project: apps/mindmap-editor
- Result: passed at completed
- Tests: passed with score 96
- Deployment: healthy
- MR Summary: docs/generated-mr-summary.md

## Run run_mphci54n_mldhhnlg

- At: 2026-05-22T20:01:35.383Z
- Type: requirement
- Prompt: 给脑图编辑器增加关联视图、反向引用和下一步焦点队列
- Target project: apps/mindmap-editor
- Result: passed at completed
- Tests: passed with score 96
- Deployment: healthy
- MR Summary: docs/generated-mr-summary.md

## Mind Map Studio Isolation Pass

- At: 2026-05-23
- 目标：彻底移除 `apps/card-editor`，将唯一产品样例改为 `apps/mindmap-editor`，并让 Harness 只通过产品 `AGENTS.md` 获取上下文。
- 已完成：新增独立 Mind Map Studio 产品；产品 UI 不含 Harness/Agent/编排文案；默认目标路径、RPC 分析、Skill 文档、Docker Compose、浏览器质量检查均切换到 `apps/mindmap-editor`。
- 验证：`pnpm target:test`、`pnpm typecheck`、`pnpm test`、`pnpm target:build`、`HARNESS_BROWSER_TARGET_URL=http://localhost:5176 pnpm verify` 通过。
- 阻塞：Docker Desktop 在移除旧容器/写入镜像 blob 时返回 `input/output error`，旧 `card-editor` 容器仍占用 `5175`；已记录到测试日志。

## Run run_mphdm02f_uphw8u30

- At: 2026-05-22T20:32:43.048Z
- Type: requirement
- Prompt: 给脑图编辑器增加本地持久化、快照恢复和最近活动轨迹
- Target project: apps/mindmap-editor
- Result: failed at failed
- Tests: not passed with score n/a
- Deployment: not run
- MR Summary: docs/generated-mr-summary.md

## Run run_mphdmxiw_eclrxm1r

- At: 2026-05-22T20:33:22.600Z
- Type: requirement
- Prompt: 给脑图编辑器增加本地持久化、快照恢复和最近活动轨迹
- Target project: apps/mindmap-editor
- Result: passed at completed
- Tests: passed with score 98
- Deployment: healthy
- MR Summary: docs/generated-mr-summary.md

## Snapshot Persistence Loop

- At: 2026-05-23
- 目标：继续通过 `$harness requirement` 增强 Mind Map Studio，同时让 Harness 在默认端口被旧容器占用时也能闭环。
- 已完成：产品新增本地持久化、快照保存/恢复、最近活动轨迹；浏览器质量门禁覆盖快照恢复；RPC 服务支持 `HARNESS_PORT_OFFSET`；orchestrator 的测试 RPC 超时提升到可配置的 90s 默认。
- 验证：`HARNESS_BROWSER_TARGET_URL=http://localhost:5176 pnpm verify` 通过，`HARNESS_PORT_OFFSET=100 HARNESS_BROWSER_TARGET_URL=http://localhost:5176 pnpm workflow:requirement "给脑图编辑器增加本地持久化、快照恢复和最近活动轨迹"` 通过。
- 下一步：继续增加更复杂产品能力，例如节点拖拽布局、快捷键、导入导出 JSON、版本历史对比或后端同步。

## Run run_mphe0xvh_8iju59li

- At: 2026-05-22T20:44:14.387Z
- Type: requirement
- Prompt: 给脑图编辑器增加命令面板和键盘快捷操作
- Target project: apps/mindmap-editor
- Result: passed at completed
- Tests: passed with score 98
- Deployment: healthy
- MR Summary: docs/generated-mr-summary.md

## Command Palette Loop

- At: 2026-05-23
- 目标：继续通过 `$harness requirement` 增强 Mind Map Studio，使样例产品更接近可长期使用的编辑器。
- 已完成：新增命令面板、命令搜索、快捷键入口、Markdown 选择命令、搜索聚焦命令，并扩展浏览器门禁覆盖键盘路径。
- 发现并修复：移动端操作区因新增 Commands 按钮产生横向溢出；浏览器门禁没有把单个 failed check 转成失败退出码。
- 验证：`pnpm target:test`、`pnpm typecheck`、`pnpm test`、`pnpm target:build`、`HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify`、`HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:requirement "给脑图编辑器增加命令面板和键盘快捷操作"` 均通过。
- 下一步：继续增加更复杂产品能力，例如 JSON 导入导出、节点拖拽布局、版本差异对比、后端同步或协作状态。

## Run run_mphe8410_4fygji8e

- At: 2026-05-22T20:49:51.479Z
- Type: bugfix
- Prompt: 移动端脑图节点截图显示被截断，浏览器门禁需要输出并检查桌面和移动截图
- Target project: apps/mindmap-editor
- Result: passed at completed
- Tests: passed with score 98
- Deployment: healthy
- MR Summary: docs/generated-mr-summary.md

## Screenshot Visual QA Fix

- At: 2026-05-23
- 目标：让 Harness 的真实浏览器验证不只依赖 DOM 断言，而是产出截图并由 Codex 视觉复核。
- 已完成：修复移动端脑图节点默认被截断的问题；浏览器质量脚本现在输出 desktop/mobile 截图，并检查移动端节点是否落在可视画布内。
- 视觉复核：已读取 `.harness/browser/browser_mphe7uop-mobile-mindmap-editor.png`，确认移动端脑图节点现在纵向完整展示。
- 验证：`HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm verify` 和 `HARNESS_BROWSER_TARGET_URL=http://localhost:5175 pnpm workflow:bugfix "移动端脑图节点截图显示被截断，浏览器门禁需要输出并检查桌面和移动截图"` 通过。
- 下一步：继续产品复杂度建设，优先补 JSON 导入/导出和导入预览。
