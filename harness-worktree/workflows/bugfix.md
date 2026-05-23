# Bugfix Workflow

输入：Bug 描述或失败日志。

步骤：

1. orchestrator-rpc 创建 `.harness/tasks/<run-id>.json`，固定 bugfix flow。
2. 判断复现路径和失败签名。
3. workflow-core 生成 bugfix `testCases[]`，至少包含回归测试和质量验证项。
4. testing-rpc 解析日志并输出 `ParsedFailure`。
5. coding-rpc 生成修复计划和回归测试建议。
6. 修改实现前先补回归单测。
7. 运行 typecheck、unit tests、build。
8. 使用 `harness-quality` Skill 根据 bug 风险自主设计 E2E / agent-browser 验证。
9. 重新执行 bugfix workflow。
10. 生成 MR Summary，记录根因、修复过程和 task JSON 证据。

本地命令：

```bash
pnpm workflow:bugfix "<Bug 或失败日志>"
```
