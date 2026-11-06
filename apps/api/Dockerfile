# syntax=docker/dockerfile:1
# Multi-stage: Bun + Prisma + Hono API (monorepo apps/api)

FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
WORKDIR /app/apps/api
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
RUN bunx prisma generate
RUN bun build src/index.ts --outdir dist --target bun --external @prisma/client --external .prisma/client

FROM oven/bun:1.2-alpine AS runtime

RUN addgroup -S arsip && adduser -S arsip -G arsip \
  && apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    UPLOAD_DIR=/app/storage/uploads \
    TEMP_DIR=/app/storage/temp

COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared

COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/storage/uploads /app/storage/temp \
  && chown -R arsip:arsip /app

USER arsip

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/app/docker-entrypoint.sh"]
