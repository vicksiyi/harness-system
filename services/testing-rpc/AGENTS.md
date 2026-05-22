# Testing RPC AGENTS

## 模块职责

负责测试执行模拟、日志读取、失败解析、修复建议、重试归因和结果评分。

## 关键入口

- `src/log-parser.ts`：日志解析核心。
- `src/log-parser.test.ts`：日志解析回归测试。
- `src/server.ts`：`runTests` 和 `parseLogs` RPC。

## RPC 方法

- `runTests`
- `parseLogs`

## 常用命令

```bash
pnpm test services/testing-rpc/src/log-parser.test.ts
pnpm --filter @harness/testing-rpc dev
```

## 修改注意事项

- 任何新的失败签名必须先加单测。
- `ParsedFailure` 必须包含 `reason`、`evidence`、`suggestedFix`。
- 不要把未知错误直接吞掉；至少返回 `Unclassified failure`。

## 常见故障

- “日志解析失败”没有被识别：补充中文或英文签名测试。
- 重试循环没有退出：检查 `attempts`、`maxAttempts` 和 `decideAfterTest`。

