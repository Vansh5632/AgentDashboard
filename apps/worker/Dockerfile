# File: ./api.Dockerfile

# Stage 1: Dependencies
# Installs ALL dependencies for the whole monorepo
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy all workspace config and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/  # <-- ADD THIS LINE

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps

# Copy source code
COPY packages/db ./packages/db
COPY apps/api ./apps/api
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Generate Prisma Client
RUN cd packages/db && pnpm exec prisma generate

# Build the API
RUN cd apps/api && pnpm build

# Stage 3: Pruner
# Removes dev-only dependencies
FROM builder AS pruner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
RUN pnpm prune --prod

# Stage 4: Runner
# Final, slim image for the API
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
RUN apk add --no-cache wget

# Copy ONLY production dependencies and built code
COPY --from=pruner /app/node_modules ./node_modules
COPY --from=pruner /app/apps/api/dist ./apps/api/dist
COPY --from=pruner /app/apps/api/package.json ./apps/api/package.json
COPY --from=pruner /app/packages/db ./packages/db
COPY --from=pruner /app/package.json ./
COPY --from=pruner /app/pnpm-workspace.yaml ./

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:${PORT}/health || exit 1

CMD ["node", "apps/api/dist/server.js"]