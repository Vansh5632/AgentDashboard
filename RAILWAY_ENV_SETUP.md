# Railway Environment Variables Setup

## 🚨 Critical: Required Environment Variables for Deployment

### API Service (`apps/api`)

Set these in Railway's API service environment variables:

```bash
# Auto-injected by Railway (when services are linked)
DATABASE_URL=<auto-provided-by-railway>
REDIS_URL=<auto-provided-by-railway>

# Required - Set Manually
NODE_ENV=production
PORT=3001
JWT_SECRET=<generate-with-openssl-rand-base64-32>
ENCRYPTION_KEY=<generate-with-openssl-rand-base64-32>

# External API Keys
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
ELEVENLABS_API_KEY=...
GHL_API_KEY=...
CALCOM_API_KEY=...

# CORS - Allow your frontend domain
CORS_ORIGINS=https://web-production-af51.up.railway.app,http://localhost:3000
```

### Worker Service (`apps/worker`)

Set these in Railway's Worker service environment variables:

```bash
# Auto-injected by Railway (when services are linked)
DATABASE_URL=<auto-provided-by-railway>
REDIS_URL=<auto-provided-by-railway>

# Required - Set Manually
NODE_ENV=production

# External API Keys (same as API service)
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
ELEVENLABS_API_KEY=...
GHL_API_KEY=...
CALCOM_API_KEY=...
CALCOM_API_BASE_URL=https://api.cal.com/v1
```

### Web Service (`apps/web`)

**🚨 CRITICAL:** This is the most common mistake!

Set these in Railway's Web service environment variables:

```bash
# Required - Point to your API service domain
# ⚠️ IMPORTANT: Use the full Railway domain, NO trailing slash, NO /api, NO /health
NEXT_PUBLIC_API_URL=https://api-production-8446.up.railway.app

# Railway will auto-inject
PORT=3000
NODE_ENV=production
```

## ❌ Common Mistakes

### Wrong `NEXT_PUBLIC_API_URL` values:

```bash
# ❌ WRONG - includes /health
NEXT_PUBLIC_API_URL=https://api-production-8446.up.railway.app/health

# ❌ WRONG - includes /api
NEXT_PUBLIC_API_URL=https://api-production-8446.up.railway.app/api

# ❌ WRONG - trailing slash
NEXT_PUBLIC_API_URL=https://api-production-8446.up.railway.app/

# ✅ CORRECT - just the domain
NEXT_PUBLIC_API_URL=https://api-production-8446.up.railway.app
```

## 🔍 How to Find Your Railway URLs

1. Go to your Railway project dashboard
2. Click on the API service
3. Go to "Settings" tab
4. Look for "Public Networking" section
5. Copy the domain (e.g., `api-production-8446.up.railway.app`)
6. Use `https://` + that domain as your `NEXT_PUBLIC_API_URL`

## ✅ Verification Steps

### 1. Check API Health
```bash
curl https://api-production-8446.up.railway.app/health
# Should return: {"status":"ok"}
```

### 2. Check API Routes
```bash
curl https://api-production-8446.up.railway.app/api/auth/signup -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123","tenantName":"Test"}'
# Should return JSON response (not 404)
```

### 3. Check CORS
Open browser console on your web app and check:
- Network tab shows correct URL (no /health in the path)
- Response headers include `Access-Control-Allow-Origin`
- No CORS errors in console

## 🔄 After Setting Environment Variables

1. **Redeploy all services** - Environment variables require a rebuild
2. Check deployment logs for:
   - API: "✅ Migrations completed successfully!"
   - Worker: "Redis connection: <redis-host>"
   - Web: Build should complete without errors

## 📝 Quick Setup Checklist

- [ ] PostgreSQL service created and linked to API & Worker
- [ ] Redis service created and linked to API & Worker
- [ ] API service environment variables set (including `CORS_ORIGINS`)
- [ ] Worker service environment variables set
- [ ] Web service has `NEXT_PUBLIC_API_URL` set correctly
- [ ] All services redeployed after setting environment variables
- [ ] API health endpoint returns 200 OK
- [ ] Web app can access API without CORS errors
- [ ] Check browser network tab - URLs should NOT include `/health`
