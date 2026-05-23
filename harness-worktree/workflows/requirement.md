# Requirement Workflow

输入：自然语言需求。

步骤：

1. orchestrator-rpc 创建 `.harness/tasks/<run-id>.json`，固定本次任务 flow。
2. requirements-rpc 生成结构化需求、范围、风险、验收标准。
3. workflow-core 将验收标准转换为 `testCases[]`。
4. coding-rpc 生成 patch plan、变更摘要和测试建议。
5. Codex 根据 task JSON 执行编码和测试，不跳过当前 step。
6. testing-rpc 运行验证并解析失败日志。
7. `harness-quality` Skill 根据本次改动自主设计 E2E / 截图 / network / console 验证。
8. 如果失败可修复，orchestrator-rpc 进入 fixing，再 retesting。
9. 通过后生成 MR Summary 和 Release Notes。
10. deploy-rpc 记录 Docker Compose 部署和健康检查。
11. 写入 run JSON、task JSON 和执行记录。

本地命令：

```bash
pnpm workflow:requirement "<需求>"
```
