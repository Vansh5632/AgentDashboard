# 🚀 Production Deployment - README

## Quick Links

📖 **Documentation**
- [Quick Deploy (15 min)](./QUICK_DEPLOY.md) - Fastest way to deploy
- [Complete Guide](./DEPLOYMENT_GUIDE.md) - Step-by-step instructions
- [Checklist](./DEPLOYMENT_CHECKLIST.md) - Interactive deployment checklist
- [Status Report](./DEPLOYMENT_STATUS.md) - Current readiness status
- [Platform Comparison](./DEPLOYMENT_COMPARISON.md) - Why Railway + Vercel?

🛠️ **Pre-Deployment**
- [Environment Template](./.env.production.template) - All required variables
- [Validation Script](./check-production-env.sh) - Check your env before deploy

---

## Recommended Deployment Stack

```
Frontend  → Vercel (FREE tier)
API       → Railway ($5-10/month)
Worker    → Railway ($5/month)
Database  → Railway PostgreSQL ($5/month)
Redis     → Upstash (FREE tier)
────────────────────────────────
Total: $15-20/month
```

---

## Deploy Now (3 Steps)

### Step 1: Prepare Secrets (5 min)

```bash
# Generate secrets
openssl rand -base64 32  # JWT_SECRET
openssl rand -hex 16     # ENCRYPTION_KEY

# Gather API keys
- ElevenLabs API Key
- OpenAI API Key
- Pinecone API Key
```

### Step 2: Deploy Backend (15 min)

1. **Railway**: Create project → Add PostgreSQL
2. **Upstash**: Create Redis database
3. **Railway**: Add API service from GitHub
4. **Railway**: Add Worker service from GitHub
5. Set environment variables (see `.env.production.template`)

### Step 3: Deploy Frontend (5 min)

1. **Vercel**: Import GitHub repo
2. Set root: `apps/web`
3. Set env: `NEXT_PUBLIC_API_URL=<Railway-API-URL>`
4. Deploy

**Done!** 🎉

---

## Deployment Files Reference

| File | Purpose |
|------|---------|
| `railway.json` | Railway project config |
| `vercel.json` | Vercel deployment config |
| `apps/api/nixpacks.toml` | API build configuration |
| `apps/worker/nixpacks.toml` | Worker build configuration |
| `.dockerignore` | Docker build exclusions |
| `.vercelignore` | Vercel build exclusions |

---

## Environment Variables Quick Reference

### API Service (Railway)
```bash
DATABASE_URL, REDIS_HOST, REDIS_PORT,
JWT_SECRET, ENCRYPTION_KEY, ELEVENLABS_API_KEY,
CORS_ORIGINS, NODE_ENV=production, PORT=3001
```

### Worker Service (Railway)
```bash
DATABASE_URL, REDIS_HOST, REDIS_PORT,
OPENAI_API_KEY, PINECONE_API_KEY,
PINECONE_INDEX_NAME, NODE_ENV=production
```

### Frontend (Vercel)
```bash
NEXT_PUBLIC_API_URL
```

---

## Verification Commands

```bash
# API Health
curl https://your-api.railway.app/health

# Database
# Check Railway PostgreSQL → Tables tab

# Frontend
open https://your-app.vercel.app

# Worker Logs
# Check Railway Worker → View Logs
```

---

## Cost Breakdown

- **Startup (0-1K users)**: $15-20/month
- **Growth (1K-10K users)**: $55-90/month
- **Scale (10K-100K users)**: $150-250/month

---

## Need Help?

1. Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions
2. Review [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) for system readiness
3. Compare platforms in [DEPLOYMENT_COMPARISON.md](./DEPLOYMENT_COMPARISON.md)
4. Join [Railway Discord](https://discord.gg/railway) or [Vercel Discord](https://vercel.com/discord)

---

## Post-Deployment

After successful deployment:

1. ✅ Test signup/login flow
2. ✅ Create first agent
3. ✅ Verify ElevenLabs integration
4. ✅ Check logs for errors
5. ✅ Set up custom domain (optional)
6. ✅ Configure monitoring

---

**Ready to deploy?** Start with [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)! 🚀
