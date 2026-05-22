# Requirement Workflow

输入：自然语言需求。

步骤：

1. requirements-rpc 生成结构化需求、范围、风险、验收标准。
2. coding-rpc 生成 patch plan、变更摘要和测试建议。
3. testing-rpc 运行验证并解析失败日志。
4. 如果失败可修复，orchestrator-rpc 进入 fixing，再 retesting。
5. 通过后生成 MR Summary 和 Release Notes。
6. deploy-rpc 记录 Docker Compose 部署和健康检查。
7. 写入执行记录。

本地命令：

```bash
pnpm workflow:requirement "<需求>"
```

