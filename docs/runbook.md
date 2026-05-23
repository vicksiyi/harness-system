# Runbook

## 安装

```bash
pnpm install
```

## 本地开发

```bash
pnpm dev:services
pnpm target:dev
```

访问：

- Mind Map Studio Target: `http://localhost:5175`
- Orchestrator: `http://localhost:4100`

`pnpm target:dev` 会同时启动 Mind Map Studio 前端和产品同步服务。只启动 `pnpm target:web` 会导致页面可打开但保存文件、Push diff、Pull diff 失败，因为 `http://localhost:4105` 不在线。

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

默认目标项目是 `apps/mindmap-editor`。如需显式指定：

```bash
HARNESS_TARGET_PROJECT=apps/mindmap-editor pnpm workflow:requirement "增加脑图节点模板"
```

如果默认 RPC 端口被旧容器或其它项目占用，可以用备用端口 profile：

```bash
HARNESS_PORT_OFFSET=100 HARNESS_BROWSER_TARGET_URL=http://localhost:5176 pnpm workflow:requirement "增加脑图快照"
```

该命令会将 RPC 服务移到 `4200-4204`，并让浏览器门禁使用 `5176`。

## 测试

```bash
pnpm typecheck
pnpm test
pnpm target:test
pnpm target:build
pnpm target:browser
```

## 健康检查

```bash
pnpm health
```

## Docker 部署

```bash
docker compose up --build
```

如果目标产品端口已被其它项目占用，可以覆盖宿主机端口，例如：

```bash
MINDMAP_EDITOR_PORT=5176 docker compose up --build
```

如果失败：

1. 运行 `docker compose config`。
2. 查看具体服务日志。
3. 检查端口 `4100-4104` 和 `5175` 是否冲突。
4. 将失败摘要写入 `docs/test-log.md`。

## 生成 MR Summary

```bash
pnpm mr:summary
```
