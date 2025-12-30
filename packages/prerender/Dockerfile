# =========================
# 1) Build stage
# =========================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /repo

# workspace 설정
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# prerender 메타
COPY packages/prerender/package.json packages/prerender/tsconfig.json ./packages/prerender/

# 의존성 설치 (workspace 기준)
RUN pnpm install --frozen-lockfile

# 소스 복사
COPY packages/prerender ./packages/prerender

# prerender 빌드
RUN pnpm --filter @infra/prerender build


# =========================
# 2) Runtime stage
# =========================
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# prerender 실행에 필요한 것만 복사
COPY --from=builder /repo/packages/prerender/dist ./dist
COPY --from=builder /repo/packages/prerender/package.json ./
COPY --from=builder /repo/node_modules ./node_modules

EXPOSE 8080

CMD ["node", "dist/server.js"]
