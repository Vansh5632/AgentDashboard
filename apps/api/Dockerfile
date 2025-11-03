# ============================================
# API Service Dockerfile
# ============================================
# This Dockerfile builds the API service for Railway deployment
# It handles database migrations before starting the server

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for workspace dependencies
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

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy source code
COPY apps/api ./apps/api
COPY packages/db ./packages/db

# Generate Prisma Client
RUN cd packages/db && npx prisma generate

# Build TypeScript to JavaScript for both packages
RUN cd packages/db && pnpm build
RUN cd apps/api && pnpm build

# Stage 3: Production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install system dependencies (curl for health checks, postgresql-client for DB checks)
RUN apk add --no-cache curl postgresql-client && \
    corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Copy Prisma schema and migrations
COPY packages/db/schema.prisma ./packages/db/
COPY packages/db/migrations ./packages/db/migrations

# Copy built db package with all its files
COPY --from=builder /app/packages/db/dist ./packages/db/dist

# Install production dependencies (this will create symlinks for workspace packages)
RUN pnpm install --prod --frozen-lockfile

# Generate Prisma Client in production
RUN cd packages/db && npx prisma generate

# Copy built application from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE ${PORT}

# Start script:
# 1. Wait for database to be ready
# 2. Run Prisma migrations
# 3. Start API server
CMD ["sh", "-c", "echo '🚀 Starting API Service...' && echo '⏳ Waiting for database to be ready...' && until pg_isready -h $(echo $DATABASE_URL | sed 's/.*@\\([^:]*\\).*/\\1/') > /dev/null 2>&1; do echo '  Database not ready, waiting 2 seconds...' && sleep 2; done && echo '✅ Database is ready!' && echo '📊 Running database migrations...' && cd packages/db && pnpm exec prisma migrate deploy && echo '✅ Migrations completed successfully!' && cd /app && echo '🌐 Starting API server on port ${PORT}...' && node apps/api/dist/server.js"]
