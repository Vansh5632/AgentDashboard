# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for all required workspaces
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy source code
COPY apps/api ./apps/api
COPY packages/db ./packages/db

# Generate Prisma Client in builder stage
RUN cd packages/db && npx prisma generate

# Build TypeScript
RUN cd apps/api && pnpm build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application files
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema and migrations (CRITICAL for runtime migrations)
COPY --from=builder /app/packages/db/schema.prisma ./packages/db/schema.prisma
COPY --from=builder /app/packages/db/migrations ./packages/db/migrations
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json

# Generate Prisma Client in production environment
RUN cd packages/db && npx prisma generate

# Verify migrations directory exists and is not empty
RUN echo "📁 Verifying migrations..." && \
    ls -la /app/packages/db/migrations && \
    if [ ! -d "/app/packages/db/migrations" ]; then \
      echo "❌ ERROR: Migrations directory not found!"; \
      exit 1; \
    fi && \
    if [ -z "$(ls -A /app/packages/db/migrations)" ]; then \
      echo "❌ ERROR: Migrations directory is empty!"; \
      exit 1; \
    fi && \
    echo "✅ Migrations verified successfully"

# Create entrypoint script inline (no external file needed)
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'set -e' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo 'echo "========================================="' >> /app/docker-entrypoint.sh && \
    echo 'echo "🚀 API Service Starting"' >> /app/docker-entrypoint.sh && \
    echo 'echo "========================================="' >> /app/docker-entrypoint.sh && \
    echo 'echo "⏰ Time: $(date)"' >> /app/docker-entrypoint.sh && \
    echo 'echo "🐳 Node: $(node --version)"' >> /app/docker-entrypoint.sh && \
    echo 'echo "📂 Directory: $(pwd)"' >> /app/docker-entrypoint.sh && \
    echo 'echo ""' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Validate DATABASE_URL' >> /app/docker-entrypoint.sh && \
    echo 'if [ -z "$DATABASE_URL" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "❌ FATAL: DATABASE_URL not set!"' >> /app/docker-entrypoint.sh && \
    echo '  echo "   Set this in Railway environment variables"' >> /app/docker-entrypoint.sh && \
    echo '  exit 1' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo 'echo "✅ DATABASE_URL configured"' >> /app/docker-entrypoint.sh && \
    echo 'echo ""' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Navigate to db package' >> /app/docker-entrypoint.sh && \
    echo 'cd /app/packages/db' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Test database connection' >> /app/docker-entrypoint.sh && \
    echo 'echo "🔌 Testing database connection..."' >> /app/docker-entrypoint.sh && \
    echo 'if ! timeout 10 npx prisma db execute --stdin --schema=./schema.prisma <<EOF 2>&1' >> /app/docker-entrypoint.sh && \
    echo 'SELECT 1 as connection_test;' >> /app/docker-entrypoint.sh && \
    echo 'EOF' >> /app/docker-entrypoint.sh && \
    echo 'then' >> /app/docker-entrypoint.sh && \
    echo '  echo "❌ ERROR: Cannot connect to database!"' >> /app/docker-entrypoint.sh && \
    echo '  echo "   Check:"' >> /app/docker-entrypoint.sh && \
    echo '   echo "   - PostgreSQL service is running"' >> /app/docker-entrypoint.sh && \
    echo '   echo "   - DATABASE_URL is correct"' >> /app/docker-entrypoint.sh && \
    echo '   echo "   - Services are properly linked in Railway"' >> /app/docker-entrypoint.sh && \
    echo '  exit 1' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo 'echo "✅ Database connection successful"' >> /app/docker-entrypoint.sh && \
    echo 'echo ""' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# List available migrations' >> /app/docker-entrypoint.sh && \
    echo 'echo "📁 Available migrations:"' >> /app/docker-entrypoint.sh && \
    echo 'ls -1 migrations/ | grep -v "migration_lock.toml" | head -10' >> /app/docker-entrypoint.sh && \
    echo 'echo ""' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Check current migration status' >> /app/docker-entrypoint.sh && \
    echo 'echo "📊 Checking migration status..."' >> /app/docker-entrypoint.sh && \
    echo 'npx prisma migrate status --schema=./schema.prisma || echo "⚠️  Migration status check failed (might be first run)"' >> /app/docker-entrypoint.sh && \
    echo 'echo ""' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Deploy migrations' >> /app/docker-entrypoint.sh && \
    echo 'echo "🔄 Deploying migrations..."' >> /app/docker-entrypoint.sh && \
    echo 'if npx prisma migrate deploy --schema=./schema.prisma; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "✅ Migrations deployed successfully!"' >> /app/docker-entrypoint.sh && \
    echo 'else' >> /app/docker-entrypoint.sh && \
    echo '  MIGRATION_EXIT_CODE=$?' >> /app/docker-entrypoint.sh && \
    echo '  echo "❌ Migration deployment FAILED (exit code: $MIGRATION_EXIT_CODE)"' >> /app/docker-entrypoint.sh && \
    echo '  echo ""' >> /app/docker-entrypoint.sh && \
    echo '  echo "🔍 Attempting to diagnose issue..."' >> /app/docker-entrypoint.sh && \
    echo '  npx prisma migrate status --schema=./schema.prisma || true' >> /app/docker-entrypoint.sh && \
    echo '  echo ""' >> /app/docker-entrypoint.sh && \
    echo '  echo "💡 Possible solutions:"' >> /app/docker-entrypoint.sh && \
    echo '  echo "   1. Check if database has conflicting schema"' >> /app/docker-entrypoint.sh && \
    echo '  echo "   2. Run: prisma migrate resolve --applied <migration_name>"' >> /app/docker-entrypoint.sh && \
    echo '  echo "   3. Check Railway logs for detailed errors"' >> /app/docker-entrypoint.sh && \
    echo '  exit 1' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo 'echo ""' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Verify tables were created' >> /app/docker-entrypoint.sh && \
    echo 'echo "🔍 Verifying database tables..."' >> /app/docker-entrypoint.sh && \
    echo 'TABLE_COUNT=$(npx prisma db execute --stdin --schema=./schema.prisma <<EOF | grep -o "[0-9]*" | head -1' >> /app/docker-entrypoint.sh && \
    echo 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '"'"'public'"'"' AND table_type = '"'"'BASE TABLE'"'"' AND table_name != '"'"'_prisma_migrations'"'"';' >> /app/docker-entrypoint.sh && \
    echo 'EOF' >> /app/docker-entrypoint.sh && \
    echo ')' >> /app/docker-entrypoint.sh && \
    echo 'echo "   Found $TABLE_COUNT application tables"' >> /app/docker-entrypoint.sh && \
    echo 'if [ "$TABLE_COUNT" -lt 5 ]; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "⚠️  WARNING: Expected at least 5 tables, found only $TABLE_COUNT"' >> /app/docker-entrypoint.sh && \
    echo 'else' >> /app/docker-entrypoint.sh && \
    echo '  echo "✅ Database tables verified"' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo 'echo ""' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Final status check' >> /app/docker-entrypoint.sh && \
    echo 'echo "📋 Final migration status:"' >> /app/docker-entrypoint.sh && \
    echo 'npx prisma migrate status --schema=./schema.prisma' >> /app/docker-entrypoint.sh && \
    echo 'echo ""' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo 'echo "========================================="' >> /app/docker-entrypoint.sh && \
    echo 'echo "✅ Database ready! Starting API server..."' >> /app/docker-entrypoint.sh && \
    echo 'echo "========================================="' >> /app/docker-entrypoint.sh && \
    echo 'echo ""' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Start the application' >> /app/docker-entrypoint.sh && \
    echo 'cd /app' >> /app/docker-entrypoint.sh && \
    echo 'exec node apps/api/dist/server.js' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

# Health check with proper timeout and retry logic
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Use the embedded entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]
