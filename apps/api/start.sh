#!/bin/sh
set -e

echo "========================================"
echo "Starting API Service"
echo "========================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not set!"
  exit 1
fi

echo "✅ DATABASE_URL is configured"

echo "📊 Running database migrations..."
cd /app/packages/db

# List migration files for debugging
echo "📁 Available migrations:"
ls -la migrations/ || echo "⚠️  No migrations directory found"

# Run migrations
echo "🔄 Executing prisma migrate deploy..."
npx prisma migrate deploy --schema=./schema.prisma

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
