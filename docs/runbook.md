# Runbook

## 安装

```bash
pnpm install
```

## 本地开发

```bash
pnpm dev:services
pnpm dev:web
```

访问：

- Web Console: `http://localhost:5173`
- Orchestrator: `http://localhost:4100`

## Skill 调用

```txt
$harness requirement 增加一个工作流运行详情页
$harness bugfix 测试服务日志解析失败
$harness polish 优化前端任务状态展示
```

底层命令：

```bash
pnpm workflow:requirement "增加一个工作流运行详情页"
pnpm workflow:bugfix "测试服务日志解析失败"
pnpm workflow:polish "优化前端任务状态展示"
```

## 测试

```bash
pnpm typecheck
pnpm test
pnpm --filter @harness/web build
```

## 健康检查

```bash
pnpm health
```

## Docker 部署

```bash
docker compose up --build
```

如果失败：

1. 运行 `docker compose config`。
2. 查看具体服务日志。
3. 检查端口 `4100-4104` 和 `5173` 是否冲突。
4. 将失败摘要写入 `docs/test-log.md`。

## 生成 MR Summary

```bash
pnpm mr:summary
```

