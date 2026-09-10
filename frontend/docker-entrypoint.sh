#!/bin/sh
set -e

BACKEND_URL="${BACKEND_INTERNAL_URL:-http://backend:4000}"

echo "🚀 [EasyLegal Frontend] Initializing Next.js container..."
echo "🔗 [EasyLegal Frontend] Directing /api proxy to: $BACKEND_URL"

# Dynamically patch routes-manifest.json and required-server-files.json if BACKEND_INTERNAL_URL is customized
for manifest in /app/.next/routes-manifest.json /app/.next/required-server-files.json /app/server.js; do
  if [ -f "$manifest" ]; then
    sed -i -E "s|https?://[a-zA-Z0-9_.-]+:4000|$BACKEND_URL|g" "$manifest"
  fi
done

exec "$@"
