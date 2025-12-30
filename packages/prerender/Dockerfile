# =========================
# 1) Build stage
# =========================
FROM node:20-alpine AS builder

# pnpm 활성화
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /repo

# workspace 전체 복사 (의존성 해석용)
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# prerender 패키지 메타만 먼저 복사 (캐시 최적화)
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

WORKDIR /app

# 빌드 결과만 복사
COPY --from=builder /repo/packages/prerender/dist ./dist
COPY --from=builder /repo/packages/prerender/package.json ./

# prod 의존성만 설치
RUN corepack enable && corepack prepare pnpm@latest --activate \
  && pnpm install --prod --frozen-lockfile

EXPOSE 8080

CMD ["node", "dist/server.js"]
