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

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

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

Each service has a Dockerfile and railway.toml for deployment:

1. Create Railway project
2. Add PostgreSQL and Redis services
3. Deploy API, Worker, and Web services
4. Link database services to each app
5. Configure environment variables

See individual service directories for specific configurations.

## License

MIT
