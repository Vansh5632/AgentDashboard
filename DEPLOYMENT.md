# Deployment & Scalability Guide

## 🗄️ Database Scalability

### Production Database Setup
**Recommended Providers (in order of preference):**
1. **Neon** (Serverless PostgreSQL) - Auto-scaling, branching
2. **Supabase** - Built-in auth, realtime, edge functions
3. **Railway** - Simple deployment with PostgreSQL
4. **AWS RDS** - Enterprise-grade, high availability
5. **DigitalOcean Managed PostgreSQL** - Cost-effective

### Database Configuration for Scale

```env
# Production Database URL (use connection pooling)
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=10"

# For Prisma with connection pooling
DATABASE_URL="postgresql://user:pass@host:5432/db"
DIRECT_URL="postgresql://user:pass@host:5432/db" # For migrations
```

### Essential Database Optimizations

1. **Connection Pooling** (CRITICAL)
   - Use PgBouncer or Prisma Accelerate
   - Prevents connection exhaustion
   - Essential for serverless deployments

2. **Indexes** (Add to schema.prisma)
   ```prisma
   @@index([tenantId])  // On all tenant-scoped queries
   @@index([email])      // For user lookups
   @@index([phoneNumber]) // For bot lookups
   @@index([conversationId]) // For call logs
   @@index([createdAt])  // For time-based queries
   ```

3. **Database Backups**
   - Automated daily backups
   - Point-in-time recovery
   - Retention: 30 days minimum

---

## 🚀 Application Deployment

### Backend API Options

**Recommended Platforms:**

1. **Railway** ⭐ (EASIEST)
   - One-click deployment
   - Built-in PostgreSQL
   - Auto-scaling
   - Good for monorepo
   - Cost: ~$5-20/month

2. **Render**
   - Free tier available
   - Auto-deploy from Git
   - Managed PostgreSQL
   - Good for Node.js

3. **Fly.io**
   - Edge deployment
   - Global distribution
   - Low latency
   - Docker-based

4. **AWS ECS/Fargate**
   - Enterprise-grade
   - Complex setup
   - Best for high scale

5. **Vercel** (for Next.js API routes)
   - Serverless functions
   - Edge runtime
   - Great DX

### Container Setup (Docker)

Create these files for containerization:

**apps/api/Dockerfile:**
```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm -F db exec prisma generate
RUN pnpm -F api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db ./packages/db
CMD ["node", "apps/api/dist/index.js"]
```

---

## 📡 Real-time & WebSocket Scaling

For ElevenLabs voice calls (WebSocket connections):

### Issues at Scale:
- WebSockets don't work well with auto-scaling
- Sticky sessions required
- Connection state management

### Solutions:

1. **Redis for State Management** (CRITICAL)
   ```bash
   pnpm add ioredis
   ```
   - Store active call sessions
   - Pub/Sub for multi-instance coordination
   - Rate limiting

2. **Dedicated WebSocket Server**
   - Separate from API
   - Can scale independently
   - Use Socket.IO with Redis adapter

3. **WebSocket Providers** (Alternative)
   - Pusher
   - Ably
   - AWS API Gateway WebSocket

---

## 🔐 Security Best Practices

### 1. Credential Encryption
Your `Credential` model stores encrypted API keys. Implement:

```typescript
// Use crypto for encryption
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.ENCRYPTION_KEY; // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}
```

### 2. Rate Limiting
```bash
pnpm add express-rate-limit
```

### 3. API Authentication
- JWT tokens with expiry
- Refresh token rotation
- Tenant isolation (CRITICAL)

---

## 📊 Monitoring & Observability

### Essential Tools:

1. **Application Monitoring**
   - Sentry (errors)
   - New Relic / DataDog (APM)
   - LogTail / Axiom (logs)

2. **Database Monitoring**
   - Prisma Pulse (real-time)
   - PgHero (query analysis)
   - Provider dashboards

3. **Uptime Monitoring**
   - Better Uptime
   - Pingdom
   - UptimeRobot

### Logging Strategy:
```typescript
// Use structured logging
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { 
    service: 'ai-agent-api',
    tenantId: '...' // ALWAYS log tenant context
  }
});
```

---

## 🎯 Multi-Tenancy Scalability

### Row-Level Security (Your Current Approach)
✅ Single database
✅ Tenant filtering via `tenantId`
⚠️ Risk: Query without tenant filter exposes data

### Best Practices:

1. **Prisma Middleware** (CRITICAL)
   ```typescript
   // Auto-inject tenantId in all queries
   prisma.$use(async (params, next) => {
     if (params.model && params.action === 'findMany') {
       params.args.where = { 
         ...params.args.where, 
         tenantId: currentTenantId 
       };
     }
     return next(params);
   });
   ```

2. **Database Indexes**
   ```prisma
   @@index([tenantId, createdAt])
   @@index([tenantId, status])
   ```

3. **Query Optimization**
   - Always filter by tenantId first
   - Use pagination
   - Limit result sets

---

## 💰 Cost Optimization

### Free Tier / Low Cost Setup:
- **Database**: Neon (Free tier: 0.5GB)
- **Backend**: Render (Free tier or $7/month)
- **Frontend**: Vercel (Free tier)
- **Redis**: Upstash (Free tier: 10k commands/day)
- **Monitoring**: Sentry (Free tier: 5k errors/month)

**Total: $0-15/month for small scale**

### Production Scale (1000+ users):
- **Database**: Neon/Supabase ($20-50/month)
- **Backend**: Railway/Render ($20-100/month)
- **Redis**: Upstash ($10-30/month)
- **Monitoring**: $20-50/month
- **CDN**: Cloudflare (Free)

**Total: $70-230/month**

---

## 🚦 Deployment Checklist

### Before Going Live:

- [ ] Environment variables in production (not .env files)
- [ ] Database connection pooling enabled
- [ ] Database indexes added
- [ ] Prisma migrations run
- [ ] API rate limiting implemented
- [ ] Error monitoring (Sentry) configured
- [ ] Logging configured
- [ ] Backups automated
- [ ] SSL/TLS certificates (HTTPS)
- [ ] CORS properly configured
- [ ] Tenant isolation middleware
- [ ] Health check endpoint (`/health`)
- [ ] Graceful shutdown handling
- [ ] Redis for session management
- [ ] Load testing completed
- [ ] Security audit done

### Post-Launch:

- [ ] Set up alerting
- [ ] Monitor error rates
- [ ] Track API response times
- [ ] Database query performance
- [ ] Cost monitoring
- [ ] Regular backup tests

---

## 🏗️ Recommended Architecture

```
┌─────────────┐
│   Cloudflare│  ← CDN + DDoS Protection
└──────┬──────┘
       │
┌──────▼──────┐
│  Frontend   │  ← Vercel/Netlify
│  (Next.js)  │
└──────┬──────┘
       │
┌──────▼──────┐
│   API       │  ← Railway/Render (Auto-scaling)
│ (Express/   │
│  Fastify)   │
└──┬───┬───┬──┘
   │   │   │
   │   │   └──────┐
   │   │          │
┌──▼───▼──┐   ┌──▼─────┐   ┌──────────┐
│PostgreSQL│   │ Redis  │   │ElevenLabs│
│ (Neon)   │   │(Upstash)│   │   API    │
└──────────┘   └────────┘   └──────────┘
```

---

## 📈 Scaling Roadmap

### Phase 1: Launch (0-100 users)
- Single server deployment
- Managed PostgreSQL
- Basic monitoring

### Phase 2: Growth (100-1000 users)
- Add Redis caching
- Implement rate limiting
- Database connection pooling
- CDN for static assets

### Phase 3: Scale (1000-10000 users)
- Horizontal scaling (multiple instances)
- Database read replicas
- Queue system (Bull/BullMQ)
- Advanced monitoring

### Phase 4: Enterprise (10000+ users)
- Microservices architecture
- Multi-region deployment
- Database sharding
- Kubernetes orchestration

---

## 🔧 Quick Start Commands

```bash
# Add essential dependencies
pnpm add dotenv ioredis express-rate-limit helmet cors
pnpm add -D @types/cors

# Database setup
pnpm -F db exec prisma generate
pnpm -F db exec prisma migrate deploy  # For production

# Build for production
pnpm build

# Run with PM2 (process manager)
pnpm add -g pm2
pm2 start apps/api/dist/index.js --name ai-agent-api
```

---

## 📚 Additional Resources

- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Railway Deployment Guide](https://docs.railway.app/)
- [Multi-tenant Architecture](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/multi-tenant-data-isolation.html)
- [ElevenLabs Conversational AI](https://elevenlabs.io/docs)
