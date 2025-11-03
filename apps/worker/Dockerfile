# ============================================
# Worker Service Dockerfile
# ============================================
# This Dockerfile builds the Worker service for Railway deployment
# It waits for database to be ready but does NOT run migrations (API handles that)

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for workspace dependencies
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

# Copy source code
COPY apps/worker ./apps/worker
COPY packages/db ./packages/db

# Generate Prisma Client
RUN cd packages/db && npx prisma generate

# Build TypeScript to JavaScript for both packages
RUN cd packages/db && pnpm build
RUN cd apps/worker && pnpm build

# Stage 3: Production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Install system dependencies (postgresql-client for DB health checks)
RUN apk add --no-cache postgresql-client && \
    corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/

# Copy Prisma schema
COPY packages/db/schema.prisma ./packages/db/

# Copy built db package with all its files
COPY --from=builder /app/packages/db/dist ./packages/db/dist

# Install production dependencies (this will create symlinks for workspace packages)
RUN pnpm install --prod --frozen-lockfile

# Generate Prisma Client in production
RUN cd packages/db && npx prisma generate

# Copy built application from builder
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

# Health check - just check if worker process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD ps aux | grep -v grep | grep "node.*worker" || exit 1

# Start script:
# 1. Wait for database to be ready (but don't run migrations)
# 2. Start worker process
CMD ["sh", "-c", "echo '🚀 Starting Worker Service...' && echo '⏳ Waiting for database to be ready...' && until pg_isready -h $(echo $DATABASE_URL | sed 's/.*@\\([^:]*\\).*/\\1/') > /dev/null 2>&1; do echo '  Database not ready, waiting 3 seconds...' && sleep 3; done && echo '✅ Database is ready!' && echo '⚙️  Starting worker process...' && node apps/worker/dist/worker.js"]
