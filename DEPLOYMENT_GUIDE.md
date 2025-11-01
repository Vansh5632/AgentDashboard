# 🚀 Production Deployment Guide

## Overview

The API service now handles **everything through the Dockerfile** - migrations, server startup, and health checks. No external shell scripts are needed.

## 🏗️ Architecture

### Multi-Stage Docker Build

1. **Stage 1 (deps)**: Install all dependencies
2. **Stage 2 (builder)**: Generate Prisma Client and build TypeScript
3. **Stage 3 (runner)**: Production runtime with embedded entrypoint script

### Embedded Entrypoint Script

The Dockerfile creates an **embedded entrypoint script** that:
- ✅ Validates DATABASE_URL
- ✅ Tests database connection
- ✅ Lists available migrations
- ✅ Checks current migration status
- ✅ Deploys all pending migrations
- ✅ Verifies tables were created
- ✅ Starts the API server

## 🛠️ How Migrations Work

### Automatic Migration Flow

```
Container Starts
     ↓
Validate DATABASE_URL
     ↓
Test DB Connection (10s timeout)
     ↓
Check Migration Status
     ↓
Deploy Migrations (prisma migrate deploy)
     ↓
Verify Tables Created
     ↓
Start API Server (node apps/api/dist/server.js)
```

### Migration Safety Features

1. **Connection Testing**: Fails fast if database is unreachable
2. **Status Checking**: Logs current migration state before deploying
3. **Table Verification**: Confirms tables exist after migration
4. **Error Handling**: Clear error messages with troubleshooting steps
5. **Exit Codes**: Proper exit codes for container orchestration

## 📝 Railway Configuration

### railway.toml (apps/api/railway.toml)

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/api/Dockerfile"
dockerContext = "./"

[deploy]
# No startCommand needed - Docker ENTRYPOINT handles everything
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
```

### Required Environment Variables

Set these in Railway Dashboard for the API service:

```bash
# Auto-injected (link PostgreSQL service to API)
DATABASE_URL=postgresql://...

# Required
NODE_ENV=production
PORT=3001
JWT_SECRET=<generate-with-openssl-rand-base64-32>
ENCRYPTION_KEY=<generate-with-openssl-rand-base64-32>

# External APIs
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
PINECONE_API_KEY=...
GHL_API_KEY=...
CALCOM_API_KEY=...

# CORS (your frontend domain)
FRONTEND_ORIGIN=https://web-production-xxxx.up.railway.app
```

## 🔍 Monitoring Deployment

### Check Deployment Logs

In Railway Dashboard → API Service → Deployments → Logs, look for:

```
=========================================
🚀 API Service Starting
=========================================
⏰ Time: 2025-11-01T12:00:00Z
🐳 Node: v20.x.x
📂 Directory: /app

✅ DATABASE_URL configured

🔌 Testing database connection...
✅ Database connection successful

📁 Available migrations:
20251019104059_add_agent_phone_number
20251023121514_add_callback_fields_and_elevenlabs_ids
20251023122059_make_agent_fields_optional
20251023171746_add_meeting_models
20251024142835_add_ghl_whatsapp_and_calcom_response

📊 Checking migration status...
<migration status output>

🔄 Deploying migrations...
Applying migration `20251019104059_add_agent_phone_number`
Applying migration `20251023121514_add_callback_fields_and_elevenlabs_ids`
Applying migration `20251023122059_make_agent_fields_optional`
Applying migration `20251023171746_add_meeting_models`
Applying migration `20251024142835_add_ghl_whatsapp_and_calcom_response`
✅ Migrations deployed successfully!

🔍 Verifying database tables...
   Found 7 application tables
✅ Database tables verified

📋 Final migration status:
Database schema is up to date!

=========================================
✅ Database ready! Starting API server...
=========================================

🚀 Server is running on http://localhost:3001
```

### Success Indicators

✅ "Migrations deployed successfully!"
✅ "Found 7 application tables"
✅ "Server is running on http://localhost:3001"
✅ Health check passes: `/health` returns 200 OK

## ❌ Troubleshooting

### Error: "DATABASE_URL not set"

**Cause**: Environment variable missing

**Solution**:
1. Go to Railway Dashboard → API Service → Variables
2. Ensure DATABASE_URL is set (should be auto-injected when PostgreSQL is linked)
3. Redeploy the service

### Error: "Cannot connect to database"

**Cause**: Database is not reachable or not ready

**Solutions**:
1. Check PostgreSQL service is running in Railway
2. Verify services are linked (Railway Dashboard → Settings → Services)
3. Check if DATABASE_URL is correct
4. Wait 30 seconds and try again (database might be starting)

### Error: "Migration deployment FAILED"

**Cause**: Migration conflicts or database drift

**Solutions**:

#### Option 1: Check migration status
```bash
# In Railway Terminal or local with production DATABASE_URL
cd packages/db
npx prisma migrate status
```

#### Option 2: Resolve applied migrations
If a migration was partially applied:
```bash
npx prisma migrate resolve --applied <migration_name>
```

#### Option 3: Force sync (⚠️ Development only!)
```bash
# This will DROP and recreate all tables
npx prisma migrate reset --force
```

#### Option 4: Push schema directly (⚠️ Last resort!)
```bash
# This bypasses migrations and pushes schema
npx prisma db push --accept-data-loss
```

### Error: "Expected at least 5 tables, found only X"

**Cause**: Migrations didn't create all tables

**Solutions**:
1. Check migration logs for specific errors
2. Verify all migration files exist in container:
   ```bash
   # In Railway Terminal
   ls -la /app/packages/db/migrations
   ```
3. Manually apply migrations:
   ```bash
   cd /app/packages/db
   npx prisma migrate deploy
   ```

### Error: Health check fails

**Cause**: Server didn't start or crashed

**Solutions**:
1. Check logs for startup errors
2. Verify PORT environment variable is set to 3001
3. Check if migrations completed successfully
4. Look for JavaScript runtime errors in logs

## 🧪 Testing Locally

### Build and Run Docker Image Locally

```bash
# From repository root
docker build -f apps/api/Dockerfile -t ai-agent-api .

# Run with your local/test database
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  -e JWT_SECRET="test-secret" \
  -e ENCRYPTION_KEY="test-key" \
  -e NODE_ENV="production" \
  ai-agent-api
```

### Test Migration Process

```bash
# Watch the migration logs
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  -e JWT_SECRET="test-secret" \
  -e ENCRYPTION_KEY="test-key" \
  -e NODE_ENV="production" \
  ai-agent-api 2>&1 | grep -E "(Migration|Database|Table|Error)"
```

### Verify Tables Created

```bash
# Connect to your database and check tables
psql $DATABASE_URL -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
"

# Should show:
# - AgentBot
# - CallLog
# - Credential
# - Meeting
# - MeetingCredential
# - Tenant
# - User
# - _prisma_migrations
```

## 📋 Deployment Checklist

Before deploying to Railway:

- [ ] PostgreSQL service is created and running
- [ ] API service is linked to PostgreSQL service
- [ ] All environment variables are set (see above)
- [ ] Dockerfile builds successfully locally
- [ ] migrations/ directory exists and has all migrations
- [ ] schema.prisma matches the latest migration

After deployment:

- [ ] Check Railway logs for migration success
- [ ] Verify health endpoint: `curl https://your-api.railway.app/health`
- [ ] Test signup endpoint to verify database access
- [ ] Check Railway metrics for container stability
- [ ] Monitor logs for any runtime errors

## 🔄 Updating Migrations

When you create a new migration:

1. **Locally**: Create migration with Prisma
   ```bash
   cd packages/db
   npx prisma migrate dev --name descriptive_name
   ```

2. **Commit**: Commit the new migration file
   ```bash
   git add packages/db/migrations/
   git commit -m "Add migration: descriptive_name"
   git push
   ```

3. **Deploy**: Railway will automatically:
   - Build new Docker image with new migration
   - Run entrypoint script
   - Apply new migration
   - Start server

4. **Verify**: Check logs for "Migrations deployed successfully!"

## 🎯 Best Practices

### ✅ DO

- Always test migrations locally first
- Use descriptive migration names
- Keep DATABASE_URL secure (never commit)
- Monitor Railway logs after deployment
- Link services properly in Railway
- Use environment variables for configuration

### ❌ DON'T

- Don't edit migration files after they're applied
- Don't manually modify production database schema
- Don't skip testing migrations locally
- Don't use `prisma db push` in production
- Don't delete migration files
- Don't commit .env files with secrets

## 📞 Quick Reference

### Railway Commands

```bash
# Link to project
railway login
railway link

# View logs
railway logs

# Run command in container
railway run bash

# Check environment variables
railway variables
```

### Prisma Commands

```bash
# Check migration status
npx prisma migrate status

# Deploy migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio
npx prisma studio
```

### Docker Commands

```bash
# Build image
docker build -f apps/api/Dockerfile -t api .

# Run container
docker run -p 3001:3001 -e DATABASE_URL="..." api

# Check running containers
docker ps

# View logs
docker logs <container_id>

# Execute command in container
docker exec -it <container_id> sh
```

## 🆘 Emergency Recovery

If production is completely broken:

1. **Stop the bleeding**: Scale API service to 0 instances in Railway
2. **Check database**: Verify PostgreSQL service is healthy
3. **Review logs**: Look for the exact error in deployment logs
4. **Fix the issue**: Apply one of the troubleshooting solutions above
5. **Test locally**: Build and run Docker image with production DATABASE_URL
6. **Redeploy**: Scale back up or trigger new deployment
7. **Monitor**: Watch logs carefully for successful migration

---

## Summary

**Everything is now in the Dockerfile** - no external scripts needed. The embedded entrypoint script handles migrations automatically on every container start. This is more reliable, easier to debug, and follows Docker best practices.

Railway configuration is minimal - just point to the Dockerfile and let it handle the rest. Migrations run before the server starts, ensuring the database is always in the correct state.
