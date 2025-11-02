# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for all required workspaces
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy source code
COPY apps/worker ./apps/worker
COPY packages/db ./packages/db

# Generate Prisma Client
RUN cd packages/db && npx prisma generate

# Build TypeScript
RUN cd apps/worker && pnpm build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Install dependencies for Railway deployment
RUN apk add --no-cache curl && \
    corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/db ./packages/db

# Generate Prisma Client in production
RUN cd packages/db && npx prisma generate

# Health check for Railway (worker doesn't expose HTTP, so check process and database connection)
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD ps aux | grep -v grep | grep "node.*worker" && cd packages/db && npx prisma db version || exit 1

# Railway deployment: Wait for database to be ready, then start worker
CMD ["sh", "-c", "echo 'Starting Railway Worker deployment...' && echo 'Waiting for database to be ready...' && until cd packages/db && npx prisma db version > /dev/null 2>&1; do echo 'Database not ready, waiting 5 seconds...'; sleep 5; done && echo 'Database is ready' && echo 'Starting worker...' && cd /app && node apps/worker/dist/worker.js"]
