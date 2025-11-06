# Multi-stage Dockerfile for Web service (Next.js)
# This follows the step-by-step guide for pnpm monorepo builds

# ================================
# Stage 1: Base - Install Node.js and pnpm
# ================================
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    dumb-init

# Install pnpm globally
RUN npm install -g pnpm@10.18.3

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S web -u 1001

# Set working directory
WORKDIR /app

# ================================
# Stage 2: Dependencies - Cache production dependencies
# ================================
FROM base AS deps

# Copy only manifest files for dependency caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

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

# Copy web app source code
COPY apps/web ./apps/web

# Install all dependencies (dev + prod) for the web app
RUN CI=true pnpm install --filter=web... --frozen-lockfile

# Set Next.js environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build the Next.js application
RUN pnpm --filter web run build

# ================================
# Stage 4: Pruner - Create clean production artifacts
# ================================
FROM base AS pruner

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

# Copy built application from builder
COPY --from=builder /app/apps/web/.next/standalone ./apps/web/
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Use pnpm deploy to create clean production directory
# This copies only production dependencies
RUN pnpm --filter=web deploy --prod --legacy /prod-web

# Copy the Next.js standalone files to the production directory
COPY --from=builder /app/apps/web/.next/standalone /prod-web/
COPY --from=builder /app/apps/web/.next/static /prod-web/.next/static
COPY --from=builder /app/apps/web/public /prod-web/public

# ================================
# Stage 5: Final - Production runtime image
# ================================
FROM node:20-alpine AS final

# Install only essential runtime dependencies
RUN apk add --no-cache \
    dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S web -u 1001

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Set working directory
WORKDIR /app

# Copy clean production artifacts from pruner stage
COPY --from=pruner --chown=web:nodejs /prod-web ./

# Ensure the server.js file is executable (it's in apps/web/ subdirectory)
RUN chmod +x ./apps/web/server.js

# Change ownership of the app directory
RUN chown -R web:nodejs /app

# Switch to non-root user
USER web

# Expose the port
EXPOSE 3000

# Health check for web service
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js application
CMD ["node", "apps/web/server.js"]