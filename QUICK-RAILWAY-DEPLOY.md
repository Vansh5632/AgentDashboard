# 🚀 Railway Quick Deploy Commands

## Essential Commands for Your AI Agent Platform

### 1. Setup Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Create Project & Services
```bash
cd /home/vansh5632/Freelancing/ai_agent
railway new
railway add --service postgresql
railway add --service redis
```

### 3. Set Environment Variables (CRITICAL)
```bash
# Security
railway variables set JWT_SECRET "your-super-secure-jwt-secret-change-this"

# External APIs (REPLACE WITH YOUR ACTUAL KEYS)
railway variables set OPENAI_API_KEY "sk-proj-your-actual-openai-key"
railway variables set PINECONE_API_KEY "pcsk_your-actual-pinecone-key"
railway variables set PINECONE_INDEX_NAME "agent-memory"
railway variables set ELEVENLABS_API_KEY "sk_your-actual-elevenlabs-key"
railway variables set CALCOM_API_BASE_URL "https://api.cal.com/v1"

# Optional services
railway variables set GHL_API_KEY "your-ghl-key"
railway variables set N8N_WEBHOOK_URL "your-n8n-webhook"
```

### 4. Deploy Services
```bash
railway up
```

### 5. Run Database Migrations
```bash
railway shell
./migrate.sh
exit
```

### 6. Check Status
```bash
railway status
railway logs
railway domains
```

## 🎯 Your Services Will Be Available At:
- Web App: `https://your-web-app.railway.app`
- API: `https://your-api-app.railway.app/health`

---

**⚠️ IMPORTANT**: Replace the API keys above with your actual keys!