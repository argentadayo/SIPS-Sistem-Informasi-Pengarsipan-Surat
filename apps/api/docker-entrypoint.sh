#!/bin/sh
set -e

echo "[entrypoint] prisma generate (if needed)..."
bunx prisma generate >/dev/null 2>&1 || true

echo "[entrypoint] applying schema..."
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null || true)" ]; then
  bunx prisma migrate deploy
else
  bunx prisma db push --skip-generate --accept-data-loss=false
fi

echo "[entrypoint] starting API on :${PORT:-3001}"
exec bun run dist/index.js
