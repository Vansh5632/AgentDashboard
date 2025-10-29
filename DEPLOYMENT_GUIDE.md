# 🚀 Deployment Guide - AI Agent Platform

This guide walks you through deploying your AI Agent platform to production using:
- **Railway**: API + Worker services
- **Vercel**: Frontend (Next.js)
- **Railway PostgreSQL**: Production database
- **Upstash Redis**: Production Redis (recommended)

---

## 📋 Pre-Deployment Checklist

### 1. Required Services & API Keys

Before deploying, ensure you have:

- ✅ **Railway Account** (for API + Worker + PostgreSQL)
- ✅ **Vercel Account** (for Frontend)
- ✅ **Upstash Account** (for Redis - recommended) or Railway Redis
- ✅ **ElevenLabs API Key** (for voice AI)
- ✅ **OpenAI API Key** (for AI summaries)
- ✅ **Pinecone Account** (for vector search)
- ✅ **Cal.com Account** (optional - for meeting scheduling)
- ✅ **GoHighLevel Account** (optional - for WhatsApp notifications)

### 2. Generate Secrets

Generate secure random secrets for:

```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# Encryption Key (exactly 32 characters)
openssl rand -hex 16
```

---

## 🗄️ Step 1: Deploy Database (Railway)

### Option A: Railway PostgreSQL (Recommended)

1. **Create New Project** in Railway
2. **Add PostgreSQL** service
   - Click "+ New" → "Database" → "PostgreSQL"
   - Railway will auto-generate credentials
3. **Get Connection String**
   - Click on PostgreSQL service
   - Copy `DATABASE_URL` from "Connect" tab
   - Format: `postgresql://user:password@host:port/dbname`

### Option B: External PostgreSQL (Supabase, Neon, etc.)

If using external PostgreSQL:
1. Create database instance
2. Enable connection pooling if available
3. Copy connection string

---

## 🔴 Step 2: Deploy Redis (Upstash Recommended)

### Option A: Upstash Redis (Recommended - Free tier available)

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create new Redis database
3. Select region closest to your Railway region
4. Copy connection details:
   - `REDIS_HOST`: Your endpoint
   - `REDIS_PORT`: Usually `6379`
   - `REDIS_PASSWORD`: Your password (if TLS enabled, use TLS connection)

### Option B: Railway Redis

1. In your Railway project
2. Click "+ New" → "Database" → "Redis"
3. Railway will auto-generate credentials

---

## 🖥️ Step 3: Deploy API Service (Railway)

### 3.1 Create API Service

1. In Railway project, click **"+ New"** → **"GitHub Repo"**
2. Connect your repository
3. Select **"Add Service"** → Choose your repo
4. Railway will detect the monorepo structure

### 3.2 Configure API Service

1. Click on the service → **"Settings"**
2. **Root Directory**: Leave as `/` (monorepo root)
3. **Build Command**: 
   ```bash
   pnpm install --frozen-lockfile && cd packages/db && pnpm exec prisma generate && cd ../../apps/api && pnpm build
   ```
4. **Start Command**:
   ```bash
   pnpm run migrate:deploy && cd apps/api && pnpm start
   ```
5. **Health Check Path**: `/health`

### 3.3 Set Environment Variables

In Railway API service, add these variables:

```bash
# Required
NODE_ENV=production
PORT=3001
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
JWT_SECRET=<your-generated-jwt-secret>
ENCRYPTION_KEY=<your-generated-encryption-key>

# API Keys
ELEVENLABS_API_KEY=<your-elevenlabs-key>

# CORS - Update after Vercel deployment
CORS_ORIGINS=https://your-app.vercel.app

# Optional
CALCOM_API_KEY=<your-calcom-key>
GHL_API_KEY=<your-ghl-key>
```

### 3.4 Generate Public URL

1. Go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://your-api.up.railway.app`)
4. This will be your `NEXT_PUBLIC_API_URL` for Vercel

---

## 🔧 Step 4: Deploy Worker Service (Railway)

### 4.1 Create Worker Service

1. In same Railway project, click **"+ New"** → **"GitHub Repo"**
2. Select **same repository**
3. This creates a second service from same repo

### 4.2 Configure Worker Service

1. Click on the worker service → **"Settings"**
2. **Root Directory**: Leave as `/` (monorepo root)
3. **Build Command**:
   ```bash
   pnpm install --frozen-lockfile && cd packages/db && pnpm exec prisma generate && cd ../../apps/worker && pnpm build
   ```
4. **Start Command**:
   ```bash
   cd apps/worker && pnpm start
   ```

### 4.3 Set Environment Variables

In Railway Worker service, add these variables:

```bash
# Required
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}

# API Keys
OPENAI_API_KEY=<your-openai-key>
PINECONE_API_KEY=<your-pinecone-key>
PINECONE_INDEX_NAME=ai-agent-calls
```

---

## 🎨 Step 5: Deploy Frontend (Vercel)

### 5.1 Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### 5.2 Configure Build Settings

**Framework Preset**: Next.js
**Root Directory**: `apps/web`
**Build Command**: 
```bash
cd ../.. && pnpm install --frozen-lockfile && cd apps/web && pnpm build
```
**Install Command**:
```bash
pnpm install --frozen-lockfile
```
**Output Directory**: `apps/web/.next` (auto-detected)

### 5.3 Set Environment Variables

In Vercel project settings, add:

```bash
NEXT_PUBLIC_API_URL=<your-railway-api-url>
```

Example: `https://your-api.up.railway.app`

### 5.4 Deploy

Click **"Deploy"** and wait for build to complete.

---

## 🔐 Step 6: Update CORS Settings

After Vercel deployment:

1. Copy your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Go back to **Railway API service**
3. Update `CORS_ORIGINS` environment variable:
   ```bash
   CORS_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
   ```
4. Railway will auto-redeploy with new CORS settings

---

## 🗃️ Step 7: Run Database Migrations

Database migrations run automatically during API deployment via:
```bash
pnpm run migrate:deploy
```

To verify migrations:

1. Go to Railway PostgreSQL service
2. Click "Data" tab to view tables
3. Should see: `Tenant`, `User`, `AgentBot`, `CallLog`, `Meeting`, etc.

---

## ✅ Step 8: Verify Deployment

### 8.1 Check API Health

```bash
curl https://your-api.up.railway.app/health
```

Expected response:
```json
{"status":"ok"}
```

### 8.2 Check Frontend

Visit: `https://your-app.vercel.app`
- Should load login page
- Try signup flow
- Login and access dashboard

### 8.3 Check Worker Logs

In Railway Worker service:
- Go to "Deployments" → "View Logs"
- Should see: "🎯 Call processing worker started"
- Should see: "🗓️ Meeting processing worker started"

---

## 🔍 Step 9: Monitoring & Debugging

### Railway Logs

```bash
# API Service Logs
Railway Dashboard → API Service → Deployments → View Logs

# Worker Service Logs
Railway Dashboard → Worker Service → Deployments → View Logs
```

### Vercel Logs

```bash
# Function Logs
Vercel Dashboard → Your Project → Deployments → View Function Logs

# Runtime Logs
Vercel Dashboard → Your Project → Logs
```

### Common Issues

**1. Database Connection Failed**
- Check `DATABASE_URL` format
- Ensure PostgreSQL service is running
- Check if IP whitelist is needed (Railway auto-handles this)

**2. Redis Connection Failed**
- Verify `REDIS_HOST` and `REDIS_PORT`
- Check if password is required
- Ensure Redis service is running

**3. CORS Errors on Frontend**
- Update `CORS_ORIGINS` in API service
- Include both Vercel URL and custom domain
- Wait for API redeployment

**4. 401 Unauthorized**
- Check JWT_SECRET is same across deployments
- Clear browser localStorage and re-login
- Verify token is being sent in headers

**5. Build Failures**
- Check pnpm version compatibility
- Verify all dependencies in package.json
- Check build logs for specific errors

---

## 🌐 Step 10: Custom Domain (Optional)

### For Frontend (Vercel)

1. Go to Vercel project → **"Settings"** → **"Domains"**
2. Add your custom domain (e.g., `app.yourdomain.com`)
3. Update DNS records as instructed by Vercel
4. SSL certificate auto-provisioned

### For API (Railway)

1. Go to Railway API service → **"Settings"** → **"Networking"**
2. Add custom domain (e.g., `api.yourdomain.com`)
3. Update DNS with CNAME record
4. SSL certificate auto-provisioned

**Don't forget to update CORS_ORIGINS!**

---

## 📊 Environment Variables Summary

### API Service (Railway)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3001` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `REDIS_HOST` | Redis host | `redis-xxx.upstash.io` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT signing key | `<random-32-chars>` |
| `ENCRYPTION_KEY` | Credential encryption | `<random-32-chars>` |
| `ELEVENLABS_API_KEY` | ElevenLabs API | `sk_...` |
| `CORS_ORIGINS` | Allowed origins | `https://app.vercel.app` |

### Worker Service (Railway)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `REDIS_HOST` | Redis host | `redis-xxx.upstash.io` |
| `REDIS_PORT` | Redis port | `6379` |
| `OPENAI_API_KEY` | OpenAI API | `sk-...` |
| `PINECONE_API_KEY` | Pinecone API | `pcsk_...` |
| `PINECONE_INDEX_NAME` | Pinecone index | `ai-agent-calls` |

### Frontend (Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API base URL | `https://api.railway.app` |

---

## 🔄 CI/CD & Auto-Deployment

### Railway

- **Auto-deploys** on every push to `main` branch
- Configure in: Service Settings → "Deployments" → "Triggers"
- Can set specific branch or PR deployments

### Vercel

- **Auto-deploys** on every push to `main` branch
- Preview deployments for PRs automatically created
- Configure in: Project Settings → "Git"

---

## 📈 Scaling Considerations

### Railway

1. **API Service**: Can scale to multiple instances
   - Settings → "Deploy" → "Replicas"
   - Recommended: Start with 1, scale based on traffic

2. **Worker Service**: Can scale to multiple workers
   - BullMQ handles distributed job processing
   - Recommended: 1-2 workers for most use cases

3. **Database Connection Pooling**:
   ```bash
   DATABASE_URL=postgresql://user:pass@host/db?pgbouncer=true&connection_limit=10
   ```

### Vercel

- **Automatic scaling** based on traffic
- Serverless functions auto-scale
- No configuration needed

---

## 💰 Cost Estimates

### Railway (Hobby Plan)

- PostgreSQL: ~$5/month
- Redis: ~$5/month
- API Service: ~$5-10/month
- Worker Service: ~$5/month
- **Total**: ~$20-25/month

### Upstash Redis

- Free tier: 10K commands/day
- Pay-as-you-go: ~$0.2 per 100K commands
- **Total**: $0-5/month

### Vercel

- Hobby: FREE
- Pro: $20/month (if needed for team/advanced features)

### Total Estimated Cost: $20-50/month

---

## 🛡️ Security Best Practices

1. ✅ **Never commit `.env` files**
2. ✅ **Use strong JWT_SECRET and ENCRYPTION_KEY**
3. ✅ **Enable HTTPS only** (Railway & Vercel handle this)
4. ✅ **Restrict CORS_ORIGINS** to your domains only
5. ✅ **Rotate API keys** regularly
6. ✅ **Use environment variables** for all secrets
7. ✅ **Enable Railway/Vercel 2FA**
8. ✅ **Monitor logs** for suspicious activity

---

## 📞 Support & Troubleshooting

### Railway Support

- Discord: [Railway Discord](https://discord.gg/railway)
- Docs: [Railway Docs](https://docs.railway.app)

### Vercel Support

- Discord: [Vercel Discord](https://vercel.com/discord)
- Docs: [Vercel Docs](https://vercel.com/docs)

### Common Commands

```bash
# Check API health
curl https://your-api.railway.app/health

# Test authentication
curl -X POST https://your-api.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Check database migrations
# In Railway PostgreSQL console
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC;
```

---

## 🎉 Deployment Complete!

Your AI Agent platform is now live:

- 🌐 **Frontend**: `https://your-app.vercel.app`
- 🔧 **API**: `https://your-api.railway.app`
- 🗄️ **Database**: Railway PostgreSQL
- 🔴 **Redis**: Upstash/Railway Redis
- 🤖 **Worker**: Processing calls & meetings

**Next Steps**:
1. Create your first user via signup
2. Configure ElevenLabs agent
3. Set up Cal.com integration
4. Test callback flow
5. Monitor logs and metrics

---

## 📝 Quick Reference URLs

After deployment, save these URLs:

```bash
# Frontend
FRONTEND_URL=https://your-app.vercel.app

# API
API_URL=https://your-api.railway.app

# Database
DATABASE_URL=<from Railway PostgreSQL>

# Redis
REDIS_URL=<from Upstash/Railway>
```

Happy deploying! 🚀
