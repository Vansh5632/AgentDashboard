# 🚀 Railway Deployment Guide - AI Agent Platform

## Overview
This guide will walk you through deploying the entire AI Agent monorepo to Railway with PostgreSQL and Redis services.

## Architecture
- **API Service** (Express.js) - Port 3001
- **Worker Service** (BullMQ background jobs) - No exposed port
- **Web Service** (Next.js) - Port 3000
- **PostgreSQL** (Railway managed) - Database
- **Redis** (Railway managed) - Job queue

---

## 📋 Prerequisites

1. **Railway Account**: Sign up at https://railway.app
2. **GitHub Repository**: Push your code to GitHub
3. **Required API Keys**:
   - OpenAI API key
   - Pinecone API key & index name
   - ElevenLabs API key
   - Cal.com API key (optional)
   - GHL webhook URLs (optional)

---

## 🔧 Step 1: Prepare Your Repository

✅ **Already Done:**
- Dockerfiles created for all services (API, Worker, Web)
- Railway.toml configs present
- Next.js configured for standalone output

✅ **Commit and Push:**
```bash
git add .
git commit -m "Add Railway deployment configs"
git push origin main
```

---

## 🎯 Step 2: Create Railway Project

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect and select your repository: `AgentDashboard`
5. Railway will detect your services - **SKIP AUTO-DEPLOY FOR NOW**

---

## 💾 Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will provision the database and generate credentials
4. Note: `DATABASE_URL` will be automatically available to link to services

**Verify Database:**
- Click on PostgreSQL service
- Go to "Variables" tab
- You'll see `DATABASE_URL` - Railway will share this with other services

---

## 🔴 Step 4: Add Redis Service

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add Redis"**
3. Railway will provision Redis and generate credentials

**Verify Redis:**
- Click on Redis service
- Go to "Variables" tab
- You'll see `REDIS_HOST`, `REDIS_PORT`, `REDIS_URL`

---

## 🔧 Step 5: Deploy API Service

1. Click **"+ New"** → **"GitHub Repo"** → Select your repo
2. Railway will detect multiple services
3. Select **"apps/api"** as the root (or configure manually)

**Configure API Service:**

### 5.1 Service Settings
- **Name**: `ai-agent-api`
- **Root Directory**: Leave as repo root (Dockerfile handles paths)
- **Dockerfile Path**: `apps/api/Dockerfile`

### 5.2 Link Database Services
- Click **"Variables"** tab
- Click **"+ New Variable"** → **"Add Reference"**
- Select PostgreSQL service → `DATABASE_URL`
- Select Redis service → `REDIS_HOST`, `REDIS_PORT`

### 5.3 Add Environment Variables
Click **"Variables"** and add:

```
NODE_ENV=production
PORT=3001
JWT_SECRET=<generate-with-openssl-rand-base64-32>
ENCRYPTION_KEY=<generate-with-openssl-rand-hex-16>
CORS_ORIGINS=https://<your-web-service-domain>,https://www.<your-domain>
ELEVENLABS_API_KEY=<your-elevenlabs-key>
CALCOM_API_BASE_URL=https://api.cal.com/v1
```

### 5.4 Configure Build & Deploy
- Railway should auto-detect from `railway.toml`
- If not, set:
  - **Build Command**: (use railway.toml)
  - **Start Command**: (use railway.toml)

### 5.5 Generate Domain
- Go to **"Settings"** tab
- Under **"Networking"**
- Click **"Generate Domain"**
- Save this URL (e.g., `https://ai-agent-api.railway.app`)

### 5.6 Deploy
- Click **"Deploy"** 
- Watch logs for successful migration and startup

---

## 👷 Step 6: Deploy Worker Service

1. Click **"+ New"** → **"GitHub Repo"** → Select your repo
2. Configure for worker service

**Configure Worker Service:**

### 6.1 Service Settings
- **Name**: `ai-agent-worker`
- **Root Directory**: Leave as repo root
- **Dockerfile Path**: `apps/worker/Dockerfile`

### 6.2 Link Database Services
- Add reference to PostgreSQL `DATABASE_URL`
- Add reference to Redis `REDIS_HOST`, `REDIS_PORT`

### 6.3 Add Environment Variables
```
NODE_ENV=production
OPENAI_API_KEY=<your-openai-key>
PINECONE_API_KEY=<your-pinecone-key>
PINECONE_INDEX_NAME=<your-pinecone-index>
ELEVENLABS_API_KEY=<your-elevenlabs-key>
CALCOM_API_BASE_URL=https://api.cal.com/v1
```

### 6.4 Deploy
- Click **"Deploy"**
- Worker has no exposed port (background service)

---

## 🌐 Step 7: Deploy Web Service (Next.js)

1. Click **"+ New"** → **"GitHub Repo"** → Select your repo
2. Configure for web service

**Configure Web Service:**

### 7.1 Service Settings
- **Name**: `ai-agent-web`
- **Root Directory**: Leave as repo root
- **Dockerfile Path**: `apps/web/Dockerfile`

### 7.2 Add Environment Variables
```
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://ai-agent-api.railway.app
NEXT_TELEMETRY_DISABLED=1
```

⚠️ **Important**: Replace `https://ai-agent-api.railway.app` with your actual API domain from Step 5.5

### 7.3 Generate Domain
- Go to **"Settings"** tab
- Generate domain for web service
- This is your frontend URL

### 7.4 Update API CORS
- Go back to **API service**
- Update `CORS_ORIGINS` variable to include web service domain:
```
CORS_ORIGINS=https://ai-agent-web.railway.app,https://<custom-domain-if-any>
```
- Redeploy API service

### 7.5 Deploy
- Click **"Deploy"**
- Visit your web domain to verify

---

## ✅ Step 8: Verify Deployment

### Check API Health
```bash
curl https://ai-agent-api.railway.app/health
# Should return: {"status":"ok"}
```

### Check Database Connection
- View API logs in Railway
- Should see "Database connected" or similar

### Check Worker
- View Worker logs
- Should see "Worker is starting..." and "✅ Pinecone connection verified"

### Check Web
- Visit your web domain
- Should load the login/signup page

---

## 🔒 Step 9: Generate Secure Keys

**On your local machine:**

```bash
# Generate JWT Secret (32 bytes base64)
openssl rand -base64 32

# Generate Encryption Key (16 bytes hex = 32 characters)
openssl rand -hex 16
```

**Update these in Railway:**
1. Go to API service → Variables
2. Update `JWT_SECRET` and `ENCRYPTION_KEY`
3. Click **"Deploy"** to restart with new values

---

## 📊 Step 10: Run Database Migrations

Railway should auto-run migrations via the API service's start command.

**To verify:**
1. Check API service logs
2. Look for "Prisma Migrate" messages

**Manual migration (if needed):**
1. Go to API service
2. Click **"Settings"** → **"Deploy"**
3. The start command in `railway.toml` includes migration

---

## 🌍 Step 11: Configure Custom Domains (Optional)

### For Web Service:
1. Go to Web service → **Settings** → **Networking**
2. Click **"Custom Domain"**
3. Add your domain (e.g., `app.yourdomain.com`)
4. Configure DNS as Railway instructs (CNAME record)

### For API Service:
1. Go to API service → **Settings** → **Networking**
2. Add custom domain (e.g., `api.yourdomain.com`)
3. Update Web service `NEXT_PUBLIC_API_URL` accordingly
4. Update API `CORS_ORIGINS` with new web domain

---

## 🔐 Environment Variables Summary

### API Service (Required)
```env
# Auto-injected by Railway
DATABASE_URL (from PostgreSQL service)
REDIS_HOST (from Redis service)
REDIS_PORT (from Redis service)

# You must set
NODE_ENV=production
PORT=3001
JWT_SECRET=<your-generated-secret>
ENCRYPTION_KEY=<your-generated-key>
CORS_ORIGINS=<your-web-domains>
ELEVENLABS_API_KEY=<your-key>
CALCOM_API_BASE_URL=https://api.cal.com/v1
```

### Worker Service (Required)
```env
# Auto-injected by Railway
DATABASE_URL (from PostgreSQL service)
REDIS_HOST (from Redis service)
REDIS_PORT (from Redis service)

# You must set
NODE_ENV=production
OPENAI_API_KEY=<your-key>
PINECONE_API_KEY=<your-key>
PINECONE_INDEX_NAME=<your-index>
ELEVENLABS_API_KEY=<your-key>
CALCOM_API_BASE_URL=https://api.cal.com/v1
```

### Web Service (Required)
```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://ai-agent-api.railway.app
NEXT_TELEMETRY_DISABLED=1
```

---

## 🚨 Troubleshooting

### API Service Won't Start
- Check logs: Look for database connection errors
- Verify `DATABASE_URL` is linked from PostgreSQL service
- Check if migrations ran successfully

### Worker Service Issues
- Verify Redis connection in logs
- Check `REDIS_HOST` and `REDIS_PORT` are set
- Ensure OpenAI and Pinecone keys are valid

### Web Can't Connect to API
- Check `NEXT_PUBLIC_API_URL` is correct
- Verify API service is running and healthy
- Check CORS settings in API service

### Database Migration Fails
- Check Railway API logs during deployment
- Verify Prisma schema is correct
- Manually trigger: Railway doesn't support interactive shell easily, but migrations run on start

---

## 📝 Post-Deployment Checklist

- [ ] API health endpoint responds
- [ ] Worker logs show successful startup
- [ ] Web loads and can reach API
- [ ] Database migrations completed
- [ ] Redis connection verified
- [ ] Custom domains configured (if using)
- [ ] JWT_SECRET and ENCRYPTION_KEY are strong random values
- [ ] CORS origins include all web domains
- [ ] All API keys are set correctly

---

## 🎉 You're Done!

Your AI Agent platform is now deployed on Railway with:
- ✅ Managed PostgreSQL database
- ✅ Managed Redis for job queue
- ✅ API service for REST endpoints
- ✅ Worker service for background jobs
- ✅ Next.js web frontend

**Access your application:**
- Frontend: `https://<your-web-domain>.railway.app`
- API: `https://<your-api-domain>.railway.app`

**Monitor your services:**
- Railway Dashboard: https://railway.app/dashboard
- View logs, metrics, and resource usage for each service

---

## 💡 Tips

1. **Cost Optimization**: Railway charges per resource usage. Monitor your usage in the dashboard.
2. **Scaling**: Railway can auto-scale. Configure in service settings.
3. **Logs**: Use Railway's log aggregation to debug issues across services.
4. **Backups**: Railway auto-backs up PostgreSQL. Configure retention in DB settings.
5. **Variables**: Use Railway's "Reference Variables" to avoid duplicating DATABASE_URL across services.

---

## 🔗 Useful Links

- [Railway Docs](https://docs.railway.app/)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [PostgreSQL Guide](https://docs.railway.app/databases/postgresql)
- [Redis Guide](https://docs.railway.app/databases/redis)
