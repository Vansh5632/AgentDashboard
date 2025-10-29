# Phase 2: Background Job Processing - Implementation Guide

## 🎯 What We Built

Phase 2 transforms your API from a slow, blocking system into a fast, responsive one by moving heavy AI processing into background workers.

### Architecture Overview

```
┌─────────────┐
│ ElevenLabs  │
│   Webhook   │
└──────┬──────┘
       │ POST /api/webhooks/elevenlabs/call-ended
       ▼
┌─────────────┐
│   API       │ ◄── Responds 202 Accepted in < 100ms
│  (Express)  │
└──────┬──────┘
       │ Adds job to queue
       ▼
┌─────────────┐
│   Redis     │ ◄── Job Queue (BullMQ)
│   Queue     │
└──────┬──────┘
       │ Worker picks up job
       ▼
┌─────────────┐
│   Worker    │ ◄── Background processing
│  (Node.js)  │
└──────┬──────┘
       │
       ├──► OpenAI (Summary + Embedding)
       ├──► Pinecone (Vector Storage)
       └──► PostgreSQL (CallLog)
```

## 📁 Files Created/Modified

### 1. **apps/api/routes/webhooks.ts** ✅
- Removed hardcoded `tenantId`
- Added database lookup to find tenant from `agent_id`
- Improved error handling
- Uses environment variables for Redis connection

### 2. **apps/worker/worker.ts** ✅
- Complete implementation with 5-step processing:
  1. Generate AI summary (OpenAI GPT-4)
  2. Generate embedding vector (OpenAI text-embedding-3-small)
  3. Store vector in Pinecone
  4. Save CallLog to PostgreSQL
  5. Detect if callback is needed
- Added `schedule-callback` job handler
- Graceful shutdown handling
- Concurrency and rate limiting

### 3. **apps/worker/utils/openai.ts** ✅
- `generateCallSummary()`: Uses GPT-4 to create concise summaries
- `generateEmbedding()`: Creates 1536-dimension vectors
- `detectCallbackNeeded()`: AI-powered callback detection
- Smart transcript parsing (handles multiple formats)

### 4. **apps/worker/utils/pinecone.ts** ✅
- `upsertCallVector()`: Stores embeddings with metadata
- `querySimilarCalls()`: Find similar calls by tenant
- `deleteCallVector()`: Cleanup utility
- `checkPineconeHealth()`: Health check on startup

### 5. **docker-compose.yml** ✅
- PostgreSQL service
- Redis service
- API service
- Worker service
- Health checks for all services
- Volume persistence

### 6. **apps/api/Dockerfile** ✅
- Multi-stage build (deps → builder → runner)
- Optimized for production
- Non-root user for security
- Health check included

### 7. **apps/worker/Dockerfile** ✅
- Multi-stage build
- Prisma Client generation
- Optimized for background processing

### 8. **.env.example** ✅
- Added `OPENAI_API_KEY`
- Added `PINECONE_API_KEY`
- Added `PINECONE_INDEX_NAME`
- Added `REDIS_HOST` and `REDIS_PORT`

## 🚀 Getting Started

### Prerequisites

1. **Install Dependencies** (already done)
   ```bash
   pnpm install
   ```

2. **Setup Environment Variables**
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add:
   - `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys
   - `PINECONE_API_KEY` - Get from https://app.pinecone.io
   - `PINECONE_INDEX_NAME` - Create an index in Pinecone (dimension: 1536)
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `JWT_SECRET` - A random secret string
   - `ENCRYPTION_KEY` - A 32-character random string

3. **Setup Pinecone Index**
   - Go to https://app.pinecone.io
   - Create a new index:
     - Name: `ai-agent-calls` (or your choice)
     - Dimensions: `1536`
     - Metric: `cosine`
     - Pod type: `p1.x1` or serverless

4. **Run Database Migrations**
   ```bash
   pnpm -F db exec prisma migrate dev
   ```

### Option 1: Local Development (Recommended for Testing)

1. **Start Redis**
   ```bash
   docker run --name ai-redis -p 6379:6379 -d redis:7-alpine
   ```

2. **Start Worker**
   ```bash
   pnpm -F worker dev
   ```

3. **Start API (in another terminal)**
   ```bash
   pnpm -F api dev
   ```

4. **Test the Webhook**
   ```bash
   curl -X POST http://localhost:3001/api/webhooks/elevenlabs/call-ended \
     -H "Content-Type: application/json" \
     -d '{
       "data": {
         "conversation_id": "test-123",
         "agent_id": "your-agent-id-from-db",
         "transcript": {
           "messages": [
             {"role": "agent", "content": "Hello, how can I help you?"},
             {"role": "user", "content": "I need help with my account"}
           ]
         }
       }
     }'
   ```

### Option 2: Docker Compose (Full Stack)

1. **Build and Start All Services**
   ```bash
   docker-compose up --build
   ```

2. **Run Migrations (first time only)**
   ```bash
   docker-compose exec api npx prisma migrate deploy
   ```

3. **View Logs**
   ```bash
   # All services
   docker-compose logs -f
   
   # Just worker
   docker-compose logs -f worker
   
   # Just API
   docker-compose logs -f api
   ```

4. **Stop Services**
   ```bash
   docker-compose down
   ```

5. **Stop and Remove Volumes** (fresh start)
   ```bash
   docker-compose down -v
   ```

## 🧪 Testing the System

### 1. Create a Tenant and Agent

First, create a user (which creates a tenant):
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "tenantName": "Test Company"
  }'
```

Then, get the agent_id from the database:
```bash
# Using Prisma Studio
pnpm -F db exec prisma studio

# Or query directly
psql $DATABASE_URL -c "SELECT id, name FROM \"AgentBot\";"
```

### 2. Send Test Webhook

```bash
curl -X POST http://localhost:3001/api/webhooks/elevenlabs/call-ended \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "conversation_id": "conv-test-001",
      "agent_id": "YOUR_AGENT_ID_HERE",
      "transcript": {
        "messages": [
          {"role": "agent", "content": "Good morning! Thank you for calling. How can I assist you today?"},
          {"role": "user", "content": "Hi, I am interested in your premium subscription plan."},
          {"role": "agent", "content": "Great choice! Let me walk you through the features..."},
          {"role": "user", "content": "That sounds good. Can someone call me back tomorrow to finalize?"},
          {"role": "agent", "content": "Absolutely! I will schedule a callback for tomorrow."}
        ]
      }
    }
  }'
```

### 3. Check the Results

**Worker Logs:**
```bash
# Local dev
# Check terminal where worker is running

# Docker
docker-compose logs worker
```

**Database:**
```bash
pnpm -F db exec prisma studio

# Check CallLog table for new entry
```

**Pinecone:**
- Log into https://app.pinecone.io
- Check your index for new vectors

## 📊 Monitoring

### Worker Status

The worker logs show each step:
- 📞 Job received
- 🤖 Generating AI summary
- 🔢 Generating embedding
- 📊 Storing to Pinecone
- 💾 Saving to PostgreSQL
- 📞 Checking callback need
- ✅ Job completed

### Queue Status

Check Redis queue:
```bash
# Connect to Redis
docker exec -it ai-redis redis-cli

# Check queue length
LLEN bull:call-processing:wait

# Check active jobs
LLEN bull:call-processing:active

# Check completed jobs
LLEN bull:call-processing:completed
```

## 🔧 Configuration

### Worker Concurrency

Edit `apps/worker/worker.ts`:
```typescript
const worker = new Worker('call-processing', async (job: Job) => {
  // ...
}, { 
  connection: redisConnection,
  concurrency: 5, // <-- Adjust this (default: 5)
  limiter: {
    max: 10,      // <-- Max jobs per duration
    duration: 1000, // <-- In milliseconds
  },
});
```

### Job Retry

BullMQ automatically retries failed jobs. Configure in webhook:
```typescript
await callProcessingQueue.add('process-transcript', data, {
  attempts: 3,          // Retry up to 3 times
  backoff: {
    type: 'exponential',
    delay: 2000,        // Start with 2s delay
  },
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 50,      // Keep last 50 failed jobs
});
```

## 🎯 Next Steps (Phase 3 Ideas)

1. **Cal.com Integration**: Implement actual callback scheduling
2. **Dashboard**: Build a UI to view call logs and analytics
3. **Real-time Updates**: Add WebSocket for live job status
4. **Advanced Analytics**: Use Pinecone to find similar calls and patterns
5. **Multi-language**: Add language detection and translation
6. **Sentiment Analysis**: Track customer satisfaction scores
7. **Custom Prompts**: Let users customize AI summary prompts per tenant

## 🐛 Troubleshooting

### Worker Not Processing Jobs

1. **Check Redis Connection**
   ```bash
   docker ps | grep redis
   # Should show running container
   ```

2. **Check Environment Variables**
   ```bash
   # In worker terminal
   echo $OPENAI_API_KEY
   echo $PINECONE_API_KEY
   ```

3. **Check Worker Logs**
   ```bash
   # Look for "Worker is running and listening for jobs..."
   ```

### "Agent Not Found" Error

- Verify `agent_id` exists in database
- Check AgentBot table: `SELECT * FROM "AgentBot";`

### OpenAI Errors

- Verify API key is valid
- Check quota: https://platform.openai.com/usage
- Ensure model access (GPT-4 requires separate access)

### Pinecone Errors

- Verify index exists and is ready
- Check dimension matches (1536 for text-embedding-3-small)
- Verify API key has write permissions

## 📝 Summary

You now have:
- ✅ Fast API that responds in < 100ms
- ✅ Background worker processing calls asynchronously
- ✅ OpenAI integration for summaries and embeddings
- ✅ Pinecone vector storage for semantic search
- ✅ Automatic callback detection
- ✅ Full Docker setup for easy deployment
- ✅ Production-ready error handling and retry logic

The "engine room" is complete! Your API is now scalable and your users won't experience any delays. 🚀
