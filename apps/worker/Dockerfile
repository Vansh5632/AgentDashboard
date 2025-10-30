# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY apps/worker/package.json ./apps/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy dependencies and workspace config from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy source code (only these come from build context)
COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

# Generate Prisma Client
RUN cd packages/db && pnpm exec prisma generate

# Build the Worker
RUN cd apps/worker && pnpm build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

CMD ["node", "apps/worker/dist/worker.js"]