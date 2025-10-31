# AI Agent Platform

Voice AI platform with automated callbacks and meeting scheduling using ElevenLabs, OpenAI, and Cal.com.

## Architecture

This is a monorepo managed with pnpm workspaces containing:

- **API Service** - Express.js REST API
- **Worker Service** - BullMQ background job processor
- **Web Service** - Next.js frontend dashboard
- **Database Package** - Shared Prisma ORM schema

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: Next.js 14, React, TailwindCSS
- **Database**: PostgreSQL (Prisma ORM)
- **Queue**: Redis + BullMQ
- **AI/ML**: OpenAI, Pinecone, ElevenLabs
- **Deployment**: Railway

## Project Structure

```
├── apps/
│   ├── api/          # REST API service
│   ├── worker/       # Background job processor
│   └── web/          # Next.js frontend
├── packages/
│   └── db/           # Shared Prisma schema
└── examples/         # API usage examples
```

## Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL
- Redis

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma Client
pnpm db:generate

# Run database migrations
pnpm migrate:deploy
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://...

# Redis (Choose ONE option)
# Option 1: Use REDIS_URL (Railway auto-provides this)
REDIS_URL=redis://username:password@host:port

# Option 2: Use individual variables (for local development)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional, leave empty for local Redis

# API Keys
JWT_SECRET=your-secret
ENCRYPTION_KEY=your-key
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
ELEVENLABS_API_KEY=...
```

### Development

```bash
# Run API service
cd apps/api && pnpm dev

# Run Worker service
cd apps/worker && pnpm dev

# Run Web frontend
cd apps/web && pnpm dev
```

## Railway Deployment

### Prerequisites
1. Install Redis locally for development: `sudo apt install redis-server` (Linux) or `brew install redis` (Mac)
2. Start Redis locally: `redis-server`

### Railway Setup

Each service has a Dockerfile and railway.toml for deployment:

1. **Create Railway Project**
   - Go to [Railway](https://railway.app) and create a new project

2. **Add PostgreSQL Service**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway automatically creates `DATABASE_URL` variable

3. **Add Redis Service**
   - Click "New" → "Database" → "Redis"
   - Railway automatically creates `REDIS_URL` variable
   - The format is: `redis://default:password@host:port`

4. **Deploy Services**
   - Deploy API service (apps/api)
   - Deploy Worker service (apps/worker)
   - Deploy Web service (apps/web)

5. **Link Services**
   - In each service settings, go to "Variables"
   - Click "Reference" to link PostgreSQL and Redis
   - Railway will auto-inject `DATABASE_URL` and `REDIS_URL`

6. **Configure Environment Variables**
   Set these variables for API and Worker services:
   ```
   NODE_ENV=production
   JWT_SECRET=<your-secret>
   ENCRYPTION_KEY=<your-key>
   OPENAI_API_KEY=<your-key>
   PINECONE_API_KEY=<your-key>
   ELEVENLABS_API_KEY=<your-key>
   GHL_API_KEY=<your-key>
   CALCOM_API_KEY=<your-key>
   ```

7. **Important Notes**
   - Worker service MUST have access to Redis (it processes background jobs)
   - API service MUST have access to Redis (it queues jobs)
   - Both services need PostgreSQL access
   - `REDIS_URL` takes precedence over `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`
   - **Database migrations run automatically** on API service startup via `start.sh`

8. **First Deployment**
   - API service will automatically run `prisma migrate deploy` on startup
   - Check Railway logs to confirm: "✅ Migrations completed successfully!"
   - If you see table errors, verify `DATABASE_URL` is correctly set
   - Migrations are idempotent - safe to run multiple times

### Troubleshooting

**Error: `The table 'public.Tenant' does not exist`**
- This means database migrations haven't run successfully
- Check Railway API service logs for migration errors
- Verify `DATABASE_URL` is set and PostgreSQL is linked
- The `start.sh` script should show migration output in logs
- If migrations fail, check for syntax errors in schema.prisma
- To manually run migrations: `cd packages/db && npx prisma migrate deploy`

**Error: `ECONNREFUSED 127.0.0.1:6379`**
- This means Redis connection is not configured properly
- Make sure `REDIS_URL` is set in Railway environment variables
- Verify Redis service is linked to your app
- Check Railway logs for Redis service status

**Local Development**
- Start Redis: `redis-server`
- No password needed for local Redis
- Use `REDIS_HOST=localhost` and `REDIS_PORT=6379`
- Run migrations manually: `pnpm migrate:deploy`

See individual service directories for specific configurations.

## License

MIT
