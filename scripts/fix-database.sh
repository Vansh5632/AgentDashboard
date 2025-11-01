#!/bin/bash

# Emergency Database Fix Script
# Use this script if migrations are not applying correctly in production

set -e

echo "========================================="
echo "🔧 Emergency Database Fix Script"
echo "========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo ""
  echo "Usage:"
  echo "  export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
  echo "  ./scripts/fix-database.sh"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Navigate to db package
cd "$(dirname "$0")/../packages/db"

echo "📂 Current directory: $(pwd)"
echo ""

# Check connection
echo "🔌 Testing database connection..."
if ! npx prisma db execute --stdin --schema=./schema.prisma <<EOF 2>&1
SELECT 1 as connection_test;
EOF
then
  echo "❌ ERROR: Cannot connect to database!"
  exit 1
fi
echo "✅ Database connection successful"
echo ""

# Check migration status
echo "📊 Checking current migration status..."
npx prisma migrate status --schema=./schema.prisma || echo "⚠️  No migrations applied yet"
echo ""

# Check existing tables
echo "🔍 Checking existing tables..."
TABLE_COUNT=$(npx prisma db execute --stdin --schema=./schema.prisma <<EOF | grep -o "[0-9]*" | head -1
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != '_prisma_migrations';
EOF
)
echo "   Found $TABLE_COUNT application tables in database"
echo ""

# Offer options
echo "Choose an option:"
echo ""
echo "1. 🔄 Deploy migrations (recommended for new deployments)"
echo "2. 🔨 Push schema directly (bypass migrations, keeps data)"
echo "3. 🗑️  Reset database (DANGER: drops all data and re-applies migrations)"
echo "4. 📋 Mark all migrations as applied (if tables already exist)"
echo "5. ❌ Cancel"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
  1)
    echo ""
    echo "🔄 Deploying migrations..."
    npx prisma migrate deploy --schema=./schema.prisma
    echo "✅ Migrations deployed!"
    ;;
  2)
    echo ""
    echo "⚠️  WARNING: This will push schema changes without recording migration history"
    read -p "Are you sure? (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
      echo "🔨 Pushing schema..."
      npx prisma db push --schema=./schema.prisma --accept-data-loss --skip-generate
      echo "✅ Schema pushed!"
    else
      echo "❌ Cancelled"
      exit 0
    fi
    ;;
  3)
    echo ""
    echo "🗑️  DANGER: This will DROP ALL DATA and re-create the database!"
    read -p "Are you absolutely sure? Type 'DELETE ALL DATA' to confirm: " confirm
    if [ "$confirm" = "DELETE ALL DATA" ]; then
      echo "🗑️  Resetting database..."
      npx prisma migrate reset --schema=./schema.prisma --force
      echo "✅ Database reset complete!"
    else
      echo "❌ Cancelled (confirmation did not match)"
      exit 0
    fi
    ;;
  4)
    echo ""
    echo "📋 Marking migrations as applied..."
    echo "Available migrations:"
    ls -1 migrations/ | grep -v "migration_lock.toml"
    echo ""
    echo "This will mark migrations as applied without actually running them."
    echo "Only do this if the tables already exist in the database!"
    read -p "Continue? (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
      for migration in $(ls -1 migrations/ | grep -v "migration_lock.toml"); do
        echo "Marking $migration as applied..."
        npx prisma migrate resolve --applied "$migration" --schema=./schema.prisma || true
      done
      echo "✅ All migrations marked as applied!"
    else
      echo "❌ Cancelled"
      exit 0
    fi
    ;;
  5)
    echo "❌ Cancelled"
    exit 0
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "📊 Final migration status:"
npx prisma migrate status --schema=./schema.prisma

echo ""
echo "🔍 Final table count:"
FINAL_COUNT=$(npx prisma db execute --stdin --schema=./schema.prisma <<EOF | grep -o "[0-9]*" | head -1
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != '_prisma_migrations';
EOF
)
echo "   Found $FINAL_COUNT application tables"

if [ "$FINAL_COUNT" -ge 7 ]; then
  echo "✅ All expected tables are present!"
else
  echo "⚠️  WARNING: Expected 7 tables, found $FINAL_COUNT"
fi

echo ""
echo "========================================="
echo "✅ Database fix complete!"
echo "========================================="
