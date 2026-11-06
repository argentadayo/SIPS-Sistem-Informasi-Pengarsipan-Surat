# syntax=docker/dockerfile:1
# React SPA monorepo apps/web → Nginx static

FROM oven/bun:1.2-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
WORKDIR /app/apps/web
ENV VITE_API_URL=
RUN bun run build

FROM nginx:1.27-alpine AS runtime
RUN apk add --no-cache curl \
  && rm -rf /usr/share/nginx/html/*

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
