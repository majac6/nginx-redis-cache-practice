# =========================
# 0) Base
# =========================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN apk update


# =========================
# 1) Prune
# =========================
FROM base AS builder
WORKDIR /app

RUN npm install -g turbo
COPY . .

# prerender 패키지만 추출 (lockfile 포함)
RUN turbo prune --scope=@infra/prerender --docker


# =========================
# 2) Install
# =========================
FROM base AS installer
WORKDIR /app

# prune 결과 중 의존성 계산에 필요한 파일만 복사
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# 소스 전체 복사 (prune된 full 기준)
COPY --from=builder /app/out/full/ .

# prerender 빌드
RUN npx turbo run build --filter=@infra/prerender...


# =========================
# 3) Runner
# =========================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# 실행에 필요한 것만 복사
COPY --from=installer /app/packages/prerender/dist ./dist
COPY --from=installer /app/packages/prerender/package.json ./
COPY --from=installer /app/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/server.js"]
