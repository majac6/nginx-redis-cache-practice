# 1. Prune 단계: 필요한 것만 발라내기
FROM node:20-alpine AS base
RUN apk update

FROM base AS builder
WORKDIR /app
RUN npm install -g turbo
COPY . .
# [핵심] app-a와 관련된 패키지들만 'out' 폴더로 추출 (Lockfile 포함)
# --docker 옵션은 의존성 설치용 json 폴더와 빌드용 full 폴더를 분리해줍니다.
RUN turbo prune --scope=@apps/a --docker

# 2. 의존성 설치 단계 (캐싱 최적화)
FROM base AS installer
WORKDIR /app

# Prune 단계에서 발라낸 package.json들만 먼저 복사 (캐시 활용)
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# 의존성 설치
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# 3. 빌드 단계
# 소스 코드 전체 복사 (Prune된 결과물인 full 폴더 사용)
COPY --from=builder /app/out/full/ .

# [추가] "나는 지금 도커 빌드 중이다"라는 플래그 설정
# 앱 빌드
RUN IS_DOCKER_BUILD=true npx turbo run build --filter=@apps/a...

# 4. 실행 단계 (Runner)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# next.config.js에서 output: 'standalone' 설정 필수
COPY --from=installer /app/apps/app-a/.next/standalone ./
COPY --from=installer /app/apps/app-a/.next/static ./apps/app-a/.next/static
COPY --from=installer /app/apps/app-a/public ./apps/app-a/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/app-a/server.js"]