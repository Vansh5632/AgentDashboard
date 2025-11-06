# Multi-stage Dockerfile for API service
# This follows the step-by-step guide for pnpm monorepo builds

# ================================
# Stage 1: Base - Install Node.js and pnpm
# ================================
FROM node:20-alpine AS base

# Install system dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    dumb-init

# Install pnpm globally
RUN npm install -g pnpm@10.18.3

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api -u 1001

# Set working directory
WORKDIR /app

# ================================
# Stage 2: Dependencies - Cache production dependencies
# ================================
FROM base AS deps

# Copy only manifest files for dependency caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Fetch production dependencies only (creates cache)
RUN pnpm fetch --prod

# ================================
# Stage 3: Builder - Build the application
# ================================
FROM base AS builder

# Copy dependency cache from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy necessary source code
COPY apps/api ./apps/api
COPY packages/db ./packages/db

# Install all dependencies (dev + prod) for the API app and its workspace deps
RUN CI=true pnpm install --filter=api... --frozen-lockfile

# Generate Prisma client (required before building)
RUN pnpm --filter @ai_agent/db run generate

# Build the database package first
RUN pnpm --filter @ai_agent/db run build

# Build the API application
RUN pnpm --filter api run build

# ================================
# Stage 4: Pruner - Create clean production artifacts
# ================================
FROM base AS pruner

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Copy built artifacts from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/schema.prisma ./packages/db/schema.prisma

# Use pnpm deploy to create clean production directory
# This copies only production dependencies and built code
RUN pnpm --filter=api deploy --prod --legacy /prod-api

# ================================
# Stage 5: Final - Production runtime image
# ================================
FROM node:20-alpine AS final

# Install only essential runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    openssl

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api -u 1001

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Set working directory
WORKDIR /app

# Copy clean production artifacts from pruner stage
COPY --from=pruner --chown=api:nodejs /prod-api ./

# Copy the schema.prisma file to the correct location for Prisma generation
COPY --from=builder /app/packages/db/schema.prisma ./schema.prisma

# The Prisma client needs to be regenerated in the final environment
# to ensure it's compatible with the production Node.js version
RUN ./node_modules/.pnpm/node_modules/.bin/prisma generate --schema=./schema.prisma

# Change ownership of the app directory
RUN chown -R api:nodejs /app

# Switch to non-root user
USER api

# Expose the port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]