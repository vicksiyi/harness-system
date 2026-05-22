# Bugfix Workflow

输入：Bug 描述或失败日志。

步骤：

1. 判断复现路径和失败签名。
2. testing-rpc 解析日志并输出 `ParsedFailure`。
3. coding-rpc 生成修复计划和回归测试建议。
4. 修改实现前先补回归单测。
5. 运行 typecheck、unit tests、build。
6. 重新执行 bugfix workflow。
7. 生成 MR Summary，记录根因和修复过程。

本地命令：

```bash
pnpm workflow:bugfix "<Bug 或失败日志>"
```

