# Railway Deployment Checklist

## Before Deployment

- [ ] All API keys secured and ready
- [ ] JWT_SECRET generated (32+ characters)
- [ ] ENCRYPTION_KEY generated (32 characters)
- [ ] Database provider selected (Railway PostgreSQL recommended)
- [ ] Redis provider selected (Upstash recommended)
- [ ] Repository pushed to GitHub

## Railway Setup

### 1. PostgreSQL Database
- [ ] PostgreSQL service added to Railway project
- [ ] DATABASE_URL copied

### 2. Redis Service
- [ ] Upstash Redis created OR Railway Redis added
- [ ] REDIS_HOST and REDIS_PORT noted
- [ ] Connection tested

### 3. API Service
- [ ] GitHub repo connected
- [ ] Build command configured
- [ ] Start command configured
- [ ] All environment variables set (see list below)
- [ ] Health check path set to `/health`
- [ ] Public domain generated
- [ ] API URL copied for Vercel

### 4. Worker Service
- [ ] Same GitHub repo connected (second service)
- [ ] Build command configured
- [ ] Start command configured
- [ ] All environment variables set (see list below)
- [ ] Service deployed successfully

## Vercel Setup

### 1. Frontend Deployment
- [ ] GitHub repo imported
- [ ] Root directory set to `apps/web`
- [ ] Build command configured
- [ ] NEXT_PUBLIC_API_URL environment variable set
- [ ] Deployment successful
- [ ] Vercel URL copied

### 2. Post-Deployment
- [ ] CORS_ORIGINS updated in Railway API service with Vercel URL
- [ ] Railway API redeployed
- [ ] Custom domain added (optional)

## Environment Variables

### API Service (Railway)
```
NODE_ENV=production
PORT=3001
DATABASE_URL=<from PostgreSQL service>
REDIS_HOST=<from Redis service>
REDIS_PORT=6379
JWT_SECRET=<generated secret>
ENCRYPTION_KEY=<generated key>
ELEVENLABS_API_KEY=<your key>
CORS_ORIGINS=<Vercel URL>
CALCOM_API_KEY=<optional>
GHL_API_KEY=<optional>
```

### Worker Service (Railway)
```
NODE_ENV=production
DATABASE_URL=<from PostgreSQL service>
REDIS_HOST=<from Redis service>
REDIS_PORT=6379
OPENAI_API_KEY=<your key>
PINECONE_API_KEY=<your key>
PINECONE_INDEX_NAME=ai-agent-calls
```

### Frontend (Vercel)
```
NEXT_PUBLIC_API_URL=<Railway API URL>
```

## Verification

- [ ] API health check returns `{"status":"ok"}`
- [ ] Frontend loads successfully
- [ ] Signup flow works
- [ ] Login flow works
- [ ] Dashboard displays data
- [ ] Worker logs show started message
- [ ] Database migrations applied

## Post-Launch

- [ ] Monitor Railway logs for errors
- [ ] Monitor Vercel logs for errors
- [ ] Test complete user flow
- [ ] Set up custom domains (optional)
- [ ] Configure alerts/monitoring
- [ ] Document deployed URLs

## URLs to Save

```
Frontend: https://___________________.vercel.app
API: https://___________________.up.railway.app
Database: <Railway PostgreSQL internal URL>
Redis: <Upstash/Railway Redis URL>
```
