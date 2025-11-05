# ============================================
# Worker Service Dockerfile - FIXED VERSION
# ============================================
# This Dockerfile builds the Worker service for Railway deployment
# It properly handles the monorepo structure and builds the DB package

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy ALL package.json files for proper dependency resolution
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/

# Copy Prisma schema BEFORE install (needed for postinstall script)
COPY packages/db/schema.prisma ./packages/db/

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Stage 2: Build application
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy ALL source code
COPY apps/worker ./apps/worker
COPY packages/db ./packages/db

# CRITICAL: Build packages in correct order
# 1. First generate Prisma Client
RUN cd packages/db && npx prisma generate

# 2. Build the DB package FIRST (creates dist/index.js)
RUN cd packages/db && pnpm build

# 3. Verify DB package was built correctly
RUN ls -la packages/db/dist/ && echo "DB package contents:" && cat packages/db/dist/index.js

# 4. Then build the Worker service
RUN cd apps/worker && pnpm build

# NEW: Prune dev dependencies after build without touching compiled artifacts
RUN printf 'Skipping pnpm prune to retain workspace dependencies in node_modules\n'

# Stage 3: Production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Install system dependencies
RUN apk add --no-cache postgresql-client && \
    corepack enable && corepack prepare pnpm@latest --activate

# Copy pre-built structure (node_modules with symlinks, full DB package as target, worker dist)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

# Ensure workspace package is reachable from all resolution paths
RUN mkdir -p node_modules/@ai_agent apps/worker/node_modules/@ai_agent \
  && rm -rf node_modules/@ai_agent/db apps/worker/node_modules/@ai_agent/db \
  && ln -s /app/packages/db node_modules/@ai_agent/db \
  && ln -s /app/packages/db apps/worker/node_modules/@ai_agent/db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD ps aux | grep -v grep | grep "node.*worker" || exit 1

# Enhanced startup script with better error handling
CMD ["sh", "-c", "\
  echo '🚀 Starting Worker Service...' && \
  echo '⏳ Waiting for database to be ready...' && \
  until pg_isready -h $(echo $DATABASE_URL | sed 's/.*@\\([^:]*\\).*/\\1/') > /dev/null 2>&1; do \
    echo '  Database not ready, waiting 3 seconds...' && sleep 3; \
  done && \
  echo '✅ Database is ready!' && \
  echo '🔍 Verifying DB package...' && \
  node -e 'try { require(\"@ai_agent/db\"); console.log(\"✅ DB package loaded successfully\"); } catch(e) { console.error(\"❌ DB package error:\", e.message); process.exit(1); }' && \
  echo '⚙️  Starting worker process...' && \
  node apps/worker/dist/worker.js \
"]