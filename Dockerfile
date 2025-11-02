# Multi-stage Dockerfile for AI Agent Platform
# This builds all services in a single container for simplified deployment

# Stage 1: Base dependencies
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Database setup
FROM base AS db-setup
COPY packages/db ./packages/db
RUN cd packages/db && npx prisma generate

# Stage 3: API builder
FROM db-setup AS api-builder
COPY apps/api ./apps/api
RUN cd apps/api && pnpm build

# Stage 4: Worker builder  
FROM db-setup AS worker-builder
COPY apps/worker ./apps/worker
RUN cd apps/worker && pnpm build

# Stage 5: Web builder
FROM base AS web-builder
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && pnpm build

# Stage 6: Production
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install runtime dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config for production installs
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/  
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built applications
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=worker-builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=web-builder /app/apps/web/.next/standalone ./
COPY --from=web-builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-builder /app/apps/web/public ./apps/web/public
COPY --from=db-setup /app/packages/db ./packages/db

# Copy source files needed for runtime
COPY apps/api/server.ts ./apps/api/
COPY apps/worker/worker.ts ./apps/worker/

# Create necessary users
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Set ownership for nextjs user
RUN chown -R nextjs:nodejs /app/apps/web/.next

# Health check - check all services
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD wget --spider -q http://localhost:3001/health && \
      wget --spider -q http://localhost:3000 && \
      ps aux | grep -v grep | grep "worker" || exit 1

# Expose ports
EXPOSE 3000 3001

# Start all services using simple commands
CMD ["sh", "-c", "cd packages/db && npx prisma migrate deploy && cd /app && node apps/api/dist/server.js & sleep 10 && node apps/worker/dist/worker.js & sleep 5 && node apps/web/server.js"]