# ============================================
# API Service Dockerfile - FIXED VERSION
# ============================================
# This Dockerfile builds the API service for Railway deployment
# It properly handles the monorepo structure and builds the DB package

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy ALL package.json files for proper dependency resolution
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Copy Prisma schema BEFORE install (needed for postinstall script)
COPY packages/db/schema.prisma ./packages/db/

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Stage 2: Build application
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
ENV CI=true

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy ALL source code
COPY apps/api ./apps/api
COPY packages/db ./packages/db

# CRITICAL: Build packages in correct order
# 1. First generate Prisma Client
RUN cd packages/db && npx prisma generate

# 2. Build the DB package FIRST (creates dist/index.js)
RUN cd packages/db && pnpm build

# 3. Verify DB package was built correctly
RUN ls -la packages/db/dist/ && echo "DB package contents:" && cat packages/db/dist/index.js

# 4. Then build the API service
RUN cd apps/api && pnpm build

# NEW: Prune dev dependencies after build without disturbing build output
RUN pnpm prune --prod

# Stage 3: Production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install system dependencies
RUN apk add --no-cache curl postgresql-client && \
    corepack enable && corepack prepare pnpm@latest --activate

# Copy pre-built structure (node_modules with symlinks, full DB package as target, API dist)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -f http://127.0.0.1:3001/health || exit 1

EXPOSE ${PORT}

# Enhanced startup script with better error handling (use npx for migrate)
CMD ["sh", "-c", "\
  echo '🚀 Starting API Service...' && \
  echo '⏳ Waiting for database to be ready...' && \
  until pg_isready -h $(echo $DATABASE_URL | sed 's/.*@\\([^:]*\\).*/\\1/') > /dev/null 2>&1; do \
    echo '  Database not ready, waiting 2 seconds...' && sleep 2; \
  done && \
  echo '✅ Database is ready!' && \
  echo '🔍 Verifying DB package...' && \
  node -e 'try { require(\"@ai_agent/db\"); console.log(\"✅ DB package loaded successfully\"); } catch(e) { console.error(\"❌ DB package error:\", e.message); process.exit(1); }' && \
  echo '📊 Running database migrations...' && \
  cd packages/db && npx prisma migrate deploy && \
  echo '✅ Migrations completed successfully!' && \
  cd /app && \
  echo '🌐 Starting API server on port ${PORT}...' && \
  node apps/api/dist/server.js \
"]