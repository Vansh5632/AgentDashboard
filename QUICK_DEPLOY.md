# Quick Start Deployment Guide

## 🚀 Deploy in 15 Minutes

### 1. Railway Setup (5 minutes)

**Create PostgreSQL:**
```bash
Railway → New Project → Add PostgreSQL
Copy: DATABASE_URL
```

**Create Redis (Upstash recommended):**
```bash
Upstash.com → Create Redis → Copy credentials
```

**Deploy API:**
```bash
Railway → Add GitHub Repo → Settings:
- Build: pnpm install && cd packages/db && pnpm exec prisma generate && cd ../../apps/api && pnpm build
- Start: pnpm run migrate:deploy && cd apps/api && pnpm start
- Health: /health
- Add all env vars from .env.production.template
- Generate Domain → Copy URL
```

**Deploy Worker:**
```bash
Railway → Add Same GitHub Repo → Settings:
- Build: pnpm install && cd packages/db && pnpm exec prisma generate && cd ../../apps/worker && pnpm build
- Start: cd apps/worker && pnpm start
- Add env vars (DATABASE_URL, REDIS, OPENAI, PINECONE)
```

### 2. Vercel Setup (3 minutes)

```bash
Vercel → Import GitHub Repo → Settings:
- Framework: Next.js
- Root: apps/web
- Build: cd ../.. && pnpm install && cd apps/web && pnpm build
- Env: NEXT_PUBLIC_API_URL=<Railway API URL>
- Deploy
```

### 3. Update CORS (1 minute)

```bash
Railway → API Service → Variables:
CORS_ORIGINS=<Vercel URL>
Redeploy
```

### 4. Test (1 minute)

```bash
curl https://your-api.railway.app/health
Open: https://your-app.vercel.app
Signup → Login → Dashboard
```

## ✅ Done!

Your AI Agent platform is live!

**Troubleshooting:** See DEPLOYMENT_GUIDE.md for detailed instructions.
