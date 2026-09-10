#!/bin/sh
set -e

echo "🚀 [EasyLegal] Initializing Backend Container..."

# Ensure data and storage directories exist
mkdir -p /app/data
mkdir -p /app/storage

# Run Prisma schema migration/push
echo "📦 [EasyLegal] Synchronizing SQLite Database Schema..."
npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss

# Auto seed if database is brand new or explicitly forced
if [ "$AUTO_SEED_DEMO" = "true" ] || [ ! -f "/app/data/.seeded" ]; then
  echo "🌱 [EasyLegal] Seeding demo accounts and mock email data..."
  npx tsx prisma/seed-demo.ts || true
  touch /app/data/.seeded
fi

echo "✨ [EasyLegal] Ready! Starting backend on port ${PORT:-4000}..."
exec "$@"
