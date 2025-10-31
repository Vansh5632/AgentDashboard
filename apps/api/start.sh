#!/bin/sh
set -e

echo "========================================"
echo "Starting API Service"
echo "========================================"

echo "📊 Running database migrations..."
cd /app/packages/db
npx prisma migrate deploy

if [ $? -eq 0 ]; then
  echo "✅ Migrations completed successfully!"
else
  echo "❌ Migration failed!"
  exit 1
fi

echo "========================================"
echo "🚀 Starting API server..."
echo "========================================"
cd /app
exec node apps/api/dist/server.js
