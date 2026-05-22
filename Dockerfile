FROM node:22-slim

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.6.5 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps ./apps
COPY services ./services
COPY packages ./packages
COPY harness-worktree ./harness-worktree
COPY docs ./docs
COPY skills ./skills

RUN pnpm install --frozen-lockfile

EXPOSE 4100 4101 4102 4103 4104 4105 5175

CMD ["pnpm", "dev:services"]
