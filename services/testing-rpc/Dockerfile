FROM node:22-slim

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/usr/bin/chromium"
ENV DEBIAN_FRONTEND="noninteractive"

RUN corepack enable && corepack prepare pnpm@10.6.5 --activate

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps ./apps
COPY services ./services
COPY packages ./packages
COPY harness-worktree ./harness-worktree
COPY docs ./docs
COPY skills ./skills

RUN pnpm install --frozen-lockfile

EXPOSE 4103

CMD ["pnpm", "--filter", "@harness/testing-rpc", "start"]
