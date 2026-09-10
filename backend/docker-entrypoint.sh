#!/bin/sh
set -e

echo "🚀 [EasyLegal] Initializing Backend Container..."

# Ensure data and storage directories exist
mkdir -p /app/data
mkdir -p /app/storage

# Run Prisma schema migration/push
echo "📦 [EasyLegal] Synchronizing SQLite Database Schema..."
npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss

echo "✨ [EasyLegal] Ready! Starting backend on port ${PORT:-4000}..."
exec "$@"
