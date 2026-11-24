#!/bin/sh
set -e

echo "[OpenTrack] Pushing Prisma schema to PostgreSQL..."
npx prisma db push --skip-generate

if [ "${SEED_DATABASE}" = "true" ]; then
  echo "[OpenTrack] Running database seed (idempotent)..."
  npx tsx prisma/seed.ts || true
fi

echo "[OpenTrack] Starting server on port ${PORT:-3000}..."
exec node server.js
