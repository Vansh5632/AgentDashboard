#!/bin/sh

# Migration script for API container
set -e

echo "🔍 Checking Prisma CLI availability..."

# Try different paths for Prisma CLI
if [ -f "./node_modules/.pnpm/node_modules/.bin/prisma" ]; then
    PRISMA_CLI="./node_modules/.pnpm/node_modules/.bin/prisma"
    echo "✅ Found Prisma CLI at: $PRISMA_CLI"
elif [ -f "./node_modules/.bin/prisma" ]; then
    PRISMA_CLI="./node_modules/.bin/prisma"
    echo "✅ Found Prisma CLI at: $PRISMA_CLI"
elif command -v npx > /dev/null 2>&1; then
    PRISMA_CLI="npx prisma"
    echo "✅ Found Prisma CLI via npx"
else
    echo "❌ Prisma CLI not found!"
    exit 1
fi

echo "📊 Database connection status:"
echo "Database URL: $DATABASE_URL"

echo "🚀 Running database migrations..."
$PRISMA_CLI migrate deploy --schema=./schema.prisma

echo "✅ Database migrations completed successfully!"