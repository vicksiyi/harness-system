# Deploy RPC AGENTS

## 模块职责

负责 Docker Compose 部署记录、健康检查摘要、部署前检查和回滚建议。

## 关键入口

- `src/server.ts`：`deploy` 和 `preflight` RPC。
- `docker-compose.yml`：本地部署入口。

## RPC 方法

- `deploy`
- `preflight`

## 常用命令

```bash
docker compose config
docker compose up --build
pnpm health
pnpm deploy:local
```

## 修改注意事项

- Docker 失败必须写入 `docs/test-log.md`。
- 健康检查要覆盖 web 和所有 RPC 服务。
- 记录回滚建议，不需要真的连接远端发布系统。

## 常见故障

- Docker build 缺依赖：检查 Dockerfile 的 pnpm workspace 安装步骤。
- 健康检查失败：先确认容器端口和环境变量。

