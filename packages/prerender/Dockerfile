# =========================
# 1) Build stage
# =========================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /repo

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

COPY packages/prerender/package.json packages/prerender/tsconfig.json ./packages/prerender/

RUN pnpm install --frozen-lockfile

COPY packages/prerender ./packages/prerender

RUN pnpm --filter @infra/prerender build


# =========================
# 2) Runtime stage
# =========================
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# workspace 구조 그대로 복사 (핵심)
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/package.json ./
COPY --from=builder /repo/pnpm-workspace.yaml ./

# prerender 패키지 기준으로 실행
WORKDIR /app/packages/prerender

EXPOSE 8080

CMD ["node", "dist/server.js"]
