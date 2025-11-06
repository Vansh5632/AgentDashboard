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
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://...

# Redis (Choose ONE option)
# Option 1: Use REDIS_URL
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

See individual service directories for specific configurations.

## License

MIT
